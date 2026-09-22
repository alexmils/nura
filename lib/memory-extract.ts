import type { UserRole } from "@/lib/roles";
import { withRlsSession } from "@/lib/rls";
import {
  claimThreadMemoryExtract,
  clearThreadMemoryExtractClaim,
  createMemory,
  getClientProfile,
  getThread,
  listMemories,
  listMessages,
  upsertClientProfile,
  type ClientProfile,
  type ClientProfilePatch,
} from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { getLlmRuntimeConfig } from "@/lib/platform-settings";
import type { Memory, ProtocolPhase, SessionKind } from "@/lib/types";

export const MEMORY_EXTRACT_MAX_NOTES = 5;
export const MEMORY_EXTRACT_TITLE_MAX = 80;
export const MEMORY_EXTRACT_BODY_MAX = 280;
/** Messages from the closed thread sent to the extractor (newest kept if over). */
export const MEMORY_EXTRACT_MESSAGE_LIMIT = 40;

export type ExtractedMemoryNote = { title: string; body: string };

export type MemoryExtractResult = {
  notes: ExtractedMemoryNote[];
  profilePatch: ClientProfilePatch;
  skipReason?: string;
};

const CRISIS_RE =
  /\b(suicid|kill\s+myself|end\s+my\s+life|self[- ]?harm|want\s+to\s+die)\b/i;

/**
 * True when a guided thread is in proper closure and extract has not claimed yet.
 * Idempotency is the DB claim (`memory_extracted_at`), not a transition-only gate:
 * if extract fails and clears the claim, a later PATCH while still closed can retry.
 */
export function shouldScheduleMemoryExtract(input: {
  memoryFlagEnabled: boolean;
  mode: SessionKind;
  previousPhase: ProtocolPhase;
  previousIncomplete: boolean;
  nextPhase: ProtocolPhase;
  nextIncomplete: boolean;
  alreadyExtracted: boolean;
}): boolean {
  if (!input.memoryFlagEnabled) return false;
  if (input.mode !== "guided") return false;
  if (input.alreadyExtracted) return false;
  return input.nextPhase === "closure" && input.nextIncomplete === false;
}

export function normalizeMemoryTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function bodyPrefixKey(body: string, len = 80): string {
  return body.trim().toLowerCase().slice(0, len).replace(/\s+/g, " ");
}

export function isDuplicateMemoryNote(
  note: ExtractedMemoryNote,
  existing: { title: string; body: string }[]
): boolean {
  const titleKey = normalizeMemoryTitle(note.title);
  const bodyKey = bodyPrefixKey(note.body);
  if (!titleKey || !bodyKey) return true;
  return existing.some((m) => {
    if (normalizeMemoryTitle(m.title) === titleKey) return true;
    const other = bodyPrefixKey(m.body);
    if (!other) return false;
    if (other === bodyKey) return true;
    // Near-duplicate starts: one note is a longer version of the other.
    if (bodyKey.startsWith(other) || other.startsWith(bodyKey)) return true;
    return false;
  });
}

function stripBannedCopy(text: string): string {
  return text
    .replace(/\u2014/g, ",")
    .replace(/\bBLS\b/gi, "set")
    .trim();
}

function looksLikeCrisisContent(text: string): boolean {
  return CRISIS_RE.test(text);
}

function asOptionalString(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = stripBannedCopy(v).slice(0, max);
  return t.length ? t : undefined;
}

/** Parse + harden model JSON into capped notes and a safe profile patch. */
export function parseMemoryExtractPayload(
  raw: string,
  existing: { title: string; body: string }[]
): MemoryExtractResult {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return { notes: [], profilePatch: {}, skipReason: "no_json" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  } catch {
    return { notes: [], profilePatch: {}, skipReason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { notes: [], profilePatch: {}, skipReason: "invalid_json" };
  }
  const o = parsed as Record<string, unknown>;
  const skipReason =
    typeof o.skipReason === "string" && o.skipReason.trim()
      ? o.skipReason.trim().slice(0, 120)
      : undefined;

  const notes: ExtractedMemoryNote[] = [];
  const seen: { title: string; body: string }[] = [...existing];
  const rawNotes = Array.isArray(o.notes) ? o.notes : [];
  for (const item of rawNotes) {
    if (notes.length >= MEMORY_EXTRACT_MAX_NOTES) break;
    if (!item || typeof item !== "object") continue;
    const n = item as Record<string, unknown>;
    const title = asOptionalString(n.title, MEMORY_EXTRACT_TITLE_MAX);
    const body = asOptionalString(n.body, MEMORY_EXTRACT_BODY_MAX);
    if (!title || !body) continue;
    if (looksLikeCrisisContent(`${title} ${body}`)) continue;
    const note = { title, body };
    if (isDuplicateMemoryNote(note, seen)) continue;
    notes.push(note);
    seen.push(note);
  }

  const profileRaw =
    o.profilePatch && typeof o.profilePatch === "object"
      ? (o.profilePatch as Record<string, unknown>)
      : {};
  const profilePatch: ClientProfilePatch = {};
  const presentingProblem = asOptionalString(profileRaw.presentingProblem, 280);
  const historyNotes = asOptionalString(profileRaw.historyNotes, 500);
  const triggers = asOptionalString(profileRaw.triggers, 280);
  const resources = asOptionalString(profileRaw.resources, 280);
  const goals = asOptionalString(profileRaw.goals, 280);
  if (presentingProblem && !looksLikeCrisisContent(presentingProblem)) {
    profilePatch.presentingProblem = presentingProblem;
  }
  if (historyNotes && !looksLikeCrisisContent(historyNotes)) {
    profilePatch.historyNotes = historyNotes;
  }
  if (triggers && !looksLikeCrisisContent(triggers)) {
    profilePatch.triggers = triggers;
  }
  if (resources && !looksLikeCrisisContent(resources)) {
    profilePatch.resources = resources;
  }
  if (goals && !looksLikeCrisisContent(goals)) {
    profilePatch.goals = goals;
  }

  return { notes, profilePatch, skipReason };
}

/**
 * Merge extract profile fields without wiping intake: fill empty fields, or
 * append a short delta when the new text is not already contained.
 */
export function mergeProfilePatchFromExtract(
  existing: ClientProfile | null,
  patch: ClientProfilePatch
): ClientProfilePatch {
  const out: ClientProfilePatch = {};
  const keys = [
    "presentingProblem",
    "historyNotes",
    "triggers",
    "resources",
    "goals",
  ] as const;
  for (const key of keys) {
    const next = patch[key]?.trim();
    if (!next) continue;
    const prev = existing?.[key]?.trim() ?? "";
    if (!prev) {
      out[key] = next;
      continue;
    }
    if (prev.toLowerCase().includes(next.toLowerCase())) continue;
    if (next.toLowerCase().includes(prev.toLowerCase())) {
      out[key] = next;
      continue;
    }
    const merged = `${prev} ${next}`.trim().slice(0, key === "historyNotes" ? 500 : 280);
    out[key] = merged;
  }
  return out;
}

export function memoryExtractSystemPrompt(): string {
  return `You extract durable account memory from a closed AI agent-guided EMDR support session.
Return ONLY one JSON object (no markdown) with this shape:
{
  "notes": [{"title": string, "body": string}],
  "profilePatch": {
    "presentingProblem": string|null,
    "historyNotes": string|null,
    "triggers": string|null,
    "resources": string|null,
    "goals": string|null
  },
  "skipReason": string|null
}

Rules:
- Max ${MEMORY_EXTRACT_MAX_NOTES} notes. Title ≤${MEMORY_EXTRACT_TITLE_MAX} chars. Body ≤${MEMORY_EXTRACT_BODY_MAX} chars.
- Store stable facts useful next session: themes, goals, preferred resources, high-level targets, what helped.
- Do NOT store crisis or suicidal detail, graphic trauma narrative, full chat transcripts, or raw scale readings as notes.
- Do NOT invent facts. Prefer fewer accurate notes. Use skipReason when nothing durable is worth saving.
- No em dash characters. Never write the acronym BLS.
- profilePatch fields are short; null when unchanged or unknown. Never invent risk fields.`;
}

function formatTranscript(
  messages: { role: string; content: string }[]
): string {
  return messages
    .map((m) => `${m.role === "agent" ? "guide" : "user"}: ${m.content}`)
    .join("\n")
    .slice(0, 12000);
}

/**
 * Run extract inside an active RLS session (caller must be in withRlsSession).
 * Empty transcripts still claim (no LLM): nothing durable to store, and we must
 * not loop schedule → no claim → schedule on every later PATCH.
 */
export async function runSessionMemoryExtract(input: {
  userId: string;
  threadId: string;
}): Promise<{
  wroteNotes: number;
  patchedProfile: boolean;
  skippedEmpty?: boolean;
}> {
  const thread = await getThread(input.threadId);
  if (!thread || thread.mode !== "guided") {
    return { wroteNotes: 0, patchedProfile: false };
  }
  if (thread.phase !== "closure" || thread.incomplete) {
    return { wroteNotes: 0, patchedProfile: false };
  }

  const allMessages = await listMessages(input.threadId);
  const recent = allMessages.slice(-MEMORY_EXTRACT_MESSAGE_LIMIT);
  const hasUserMessage = recent.some((m) => m.role === "user");

  const claimed = await claimThreadMemoryExtract(input.threadId);
  if (!claimed) {
    return { wroteNotes: 0, patchedProfile: false };
  }

  if (!hasUserMessage) {
    return { wroteNotes: 0, patchedProfile: false, skippedEmpty: true };
  }

  try {
    const existing = await listMemories();
    const profile = await getClientProfile(input.userId);
    const settings = await getLlmRuntimeConfig();

    const userBlock = [
      `Thread title: ${thread.title}`,
      thread.target ? `Target: ${thread.target}` : null,
      profile
        ? `Existing profile:\n${JSON.stringify({
            presentingProblem: profile.presentingProblem ?? null,
            historyNotes: profile.historyNotes ?? null,
            triggers: profile.triggers ?? null,
            resources: profile.resources ?? null,
            goals: profile.goals ?? null,
          })}`
        : "Existing profile: none",
      existing.length
        ? `Existing memory note titles:\n${existing
            .slice(0, 40)
            .map((m) => `- ${m.title}`)
            .join("\n")}`
        : "Existing memory notes: none",
      "",
      "Transcript (oldest to newest):",
      formatTranscript(recent),
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await chatCompletion(
      settings,
      [
        { role: "system", content: memoryExtractSystemPrompt() },
        { role: "user", content: userBlock },
      ],
      { userId: input.userId, purpose: "memory_extract" }
    );

    const parsed = parseMemoryExtractPayload(raw, existing);
    let wroteNotes = 0;
    for (const note of parsed.notes) {
      await createMemory(note.title, note.body, { source: "session" });
      wroteNotes += 1;
    }

    const merged = mergeProfilePatchFromExtract(profile, parsed.profilePatch);
    let patchedProfile = false;
    if (Object.keys(merged).length > 0) {
      await upsertClientProfile(merged, input.userId);
      patchedProfile = true;
    }

    return { wroteNotes, patchedProfile };
  } catch (err) {
    // Clear so a later PATCH while still closed can re-schedule (claim is the
    // only idempotency gate). Same-txn rollback also undoes the claim.
    await clearThreadMemoryExtractClaim(input.threadId).catch(() => undefined);
    throw err;
  }
}

async function runExtractWithRls(input: {
  userId: string;
  role: UserRole;
  threadId: string;
}): Promise<void> {
  await withRlsSession({ userId: input.userId, role: input.role }, () =>
    runSessionMemoryExtract({
      userId: input.userId,
      threadId: input.threadId,
    })
  );
}

/**
 * Fire-and-forget extract after guided closure. Defers to the next tick so the
 * outer withAuth transaction can commit (avoids waiting on the thread row lock).
 * Re-enters RLS because the request ALS context ends when the HTTP handler returns.
 */
export function scheduleSessionMemoryExtract(input: {
  userId: string;
  role: UserRole;
  threadId: string;
}): void {
  setImmediate(() => {
    void runExtractWithRls(input).catch((err) => {
      console.warn("[memory-extract] failed:", err);
    });
  });
}

/** Test helper: type for Memory list without pulling UI. */
export type ExistingMemoryForDedup = Pick<Memory, "title" | "body">;
