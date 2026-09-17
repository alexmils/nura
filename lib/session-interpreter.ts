import type { ProtocolPhase, Thread } from "./types";
import { PHASE_ORDER } from "./protocol";

export type DistressLevel = "ok" | "elevated" | "overwhelm";

/**
 * What the user says about the last set. `done` = it finished, `stopped` =
 * something cut it short, `repeat` = run the same set again, `unfocused` =
 * they were distracted and want it again rather than moving on.
 */
export type SetReport = "done" | "stopped" | "repeat" | "unfocused";

export type SessionInterpretation = {
  suds: number | null;
  voc: number | null;
  target: string | null;
  negativeCognition: string | null;
  positiveCognition: string | null;
  suggestedPhase: ProtocolPhase | null;
  distress: DistressLevel;
  /**
   * True only when the user is outside the window of tolerance: flooding,
   * dissociation, feeling unreal or unsafe, losing the present. A high SUD
   * (even 10) is a normal processing baseline and must NOT set this.
   */
  outOfWindow: boolean;
  /** What the user reports about the last set, if anything. */
  setReport: SetReport | null;
  needsGrounding: boolean;
  summary: string;
  userFacingHint: string | null;
  presentingProblem: string | null;
  historyNotes: string | null;
  triggers: string | null;
  resources: string | null;
  goals: string | null;
  riskFlag: boolean;
  riskNotes: string | null;
  intakeComplete: boolean;
  /** True when the guide should start a bilateral set after this turn. */
  startSet: boolean;
};

export const EMPTY_INTERPRETATION: SessionInterpretation = {
  suds: null,
  voc: null,
  target: null,
  negativeCognition: null,
  positiveCognition: null,
  suggestedPhase: null,
  distress: "ok",
  outOfWindow: false,
  setReport: null,
  needsGrounding: false,
  summary: "",
  userFacingHint: null,
  presentingProblem: null,
  historyNotes: null,
  triggers: null,
  resources: null,
  goals: null,
  riskFlag: false,
  riskNotes: null,
  intakeComplete: false,
  startSet: false,
};

const PHASE_SET = new Set<string>(PHASE_ORDER);
const SET_REPORTS = new Set<string>(["done", "stopped", "repeat", "unfocused"]);

/** Processing phases where a set runs and a stopped set must not advance. */
const PROCESSING_PHASES = new Set<ProtocolPhase>([
  "desensitization",
  "installation",
  "body_scan",
]);

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < min || n > max) return null;
  return n;
}

function asTrimmedString(value: unknown, maxLen = 280): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

function asPhase(value: unknown): ProtocolPhase | null {
  if (typeof value !== "string") return null;
  return PHASE_SET.has(value) ? (value as ProtocolPhase) : null;
}

function asSetReport(value: unknown): SetReport | null {
  if (typeof value !== "string") return null;
  return SET_REPORTS.has(value) ? (value as SetReport) : null;
}

function asDistress(value: unknown): DistressLevel {
  if (value === "elevated" || value === "overwhelm" || value === "ok") {
    return value;
  }
  return "ok";
}

/** Extract first JSON object from model output (allows markdown fences). */
export function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseSessionInterpretation(
  raw: unknown
): SessionInterpretation {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INTERPRETATION };
  const o = raw as Record<string, unknown>;
  const distress = asDistress(o.distress);
  const riskFlag = Boolean(o.riskFlag);
  return {
    suds: clampInt(o.suds, 0, 10),
    voc: clampInt(o.voc, 0, 7),
    target: asTrimmedString(o.target),
    negativeCognition: asTrimmedString(o.negativeCognition),
    positiveCognition: asTrimmedString(o.positiveCognition),
    suggestedPhase: asPhase(o.suggestedPhase),
    distress,
    outOfWindow: Boolean(o.outOfWindow),
    setReport: asSetReport(o.setReport),
    needsGrounding: Boolean(o.needsGrounding) || riskFlag,
    summary: asTrimmedString(o.summary, 400) ?? "",
    userFacingHint: asTrimmedString(o.userFacingHint, 200),
    presentingProblem: asTrimmedString(o.presentingProblem, 400),
    historyNotes: asTrimmedString(o.historyNotes, 600),
    triggers: asTrimmedString(o.triggers, 400),
    resources: asTrimmedString(o.resources, 400),
    goals: asTrimmedString(o.goals, 400),
    riskFlag,
    riskNotes: asTrimmedString(o.riskNotes, 400),
    intakeComplete: Boolean(o.intakeComplete),
    startSet: Boolean(o.startSet),
  };
}

export function interpreterSystemPrompt(phase: ProtocolPhase): string {
  return `You are an EMDR session interpreter for a self-help app. English only.
Analyze the latest user message in context of the current phase and thread state.
Return ONLY a single JSON object (no markdown, no prose) with this exact shape:
{
  "suds": number|null,
  "voc": number|null,
  "target": string|null,
  "negativeCognition": string|null,
  "positiveCognition": string|null,
  "suggestedPhase": "intake"|"grounding"|"assessment"|"desensitization"|"installation"|"body_scan"|"closure"|null,
  "distress": "ok"|"elevated"|"overwhelm",
  "outOfWindow": boolean,
  "setReport": "done"|"stopped"|"repeat"|"unfocused"|null,
  "needsGrounding": boolean,
  "summary": string,
  "userFacingHint": string|null,
  "presentingProblem": string|null,
  "historyNotes": string|null,
  "triggers": string|null,
  "resources": string|null,
  "goals": string|null,
  "riskFlag": boolean,
  "riskNotes": string|null,
  "intakeComplete": boolean,
  "startSet": boolean
}

Rules:
- suds is 0-10 disturbance; voc is 0-7 validity of positive cognition. Use null if not clearly stated.
- Extract target/NC/PC only when the user clearly names them; do not invent.
- During intake: fill presentingProblem/historyNotes/triggers/resources/goals when the user shares them; set intakeComplete true only when a concrete starting target is agreed AND safety screening is OK (no crisis).
- riskFlag true if suicidality, active crisis, severe dissociation, or feels unsafe — also set riskNotes briefly.
- outOfWindow true ONLY for flooding, dissociation, feeling unreal, feeling unsafe, or losing contact with the present. A high SUDs (8-10) alone is NOT outOfWindow: it is the normal starting baseline for a target and processing must be allowed to start. Never set outOfWindow just because a number is high. If unsure, false.
- setReport describes the last set the user is talking about: "done" (it finished), "stopped" (something interrupted it or they cut it short), "repeat" (they want the same set again), "unfocused" (they were distracted and want it again rather than moving on). null when they are not reporting on a set.
- A set that was stopped or that the user wants again does NOT move the phase forward and is NOT read for SUDs/VoC: it is simply run again. Treat "again", "repeat", "I wasn't focused", "it stopped", "something interrupted me" as setReport, not as progress.
- suggestedPhase: only when the conversation clearly warrants advancing or returning (e.g. intakeComplete → grounding; SUDs 0-1 in desensitization → installation; outOfWindow → grounding). Assessment does NOT need suggestedPhase to reach desensitization: once a target and SUDs are known the app advances and starts the set. Prefer null if unsure.
- needsGrounding true if the user asks for safe place or wants to pause. Do not set it from a high SUDs number.
- startSet: true when a set should begin now — the phase is (or this turn advances to) desensitization, installation, or body_scan; riskFlag is false; outOfWindow is false; and the user is ready to continue, go with that, begin, or repeat the set. A high SUDs (up to 10) does NOT block the first set and does NOT delay it. Never true during intake, grounding, assessment, or closure. Prefer false if unsure.
- summary: one short clinical note for the guide agent (not shown verbatim to user unless needed).
- userFacingHint: optional one short line the guide may use; null if none.
- Current phase is ${phase}. Do not output anything except JSON.`;
}

export function interpretationContextBlock(
  interp: SessionInterpretation
): string {
  const lines = [
    "Structured interpretation of the latest user turn (for your guidance only):",
    `- distress: ${interp.distress}`,
    `- outOfWindow: ${interp.outOfWindow}`,
    `- needsGrounding: ${interp.needsGrounding}`,
    `- riskFlag: ${interp.riskFlag}`,
    `- intakeComplete: ${interp.intakeComplete}`,
    `- startSet: ${interp.startSet}`,
    interp.setReport ? `- setReport: ${interp.setReport}` : null,
    interp.suds != null ? `- suds: ${interp.suds}` : null,
    interp.voc != null ? `- voc: ${interp.voc}` : null,
    interp.target ? `- target: ${interp.target}` : null,
    interp.negativeCognition
      ? `- negativeCognition: ${interp.negativeCognition}`
      : null,
    interp.positiveCognition
      ? `- positiveCognition: ${interp.positiveCognition}`
      : null,
    interp.presentingProblem
      ? `- presentingProblem: ${interp.presentingProblem}`
      : null,
    interp.historyNotes ? `- historyNotes: ${interp.historyNotes}` : null,
    interp.triggers ? `- triggers: ${interp.triggers}` : null,
    interp.resources ? `- resources: ${interp.resources}` : null,
    interp.goals ? `- goals: ${interp.goals}` : null,
    interp.riskNotes ? `- riskNotes: ${interp.riskNotes}` : null,
    interp.suggestedPhase
      ? `- suggestedPhase: ${interp.suggestedPhase}`
      : null,
    interp.summary ? `- summary: ${interp.summary}` : null,
    interp.userFacingHint
      ? `- userFacingHint: ${interp.userFacingHint}`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function threadPatchFromInterpretation(
  thread: Thread,
  interp: SessionInterpretation
): Partial<Omit<Thread, "id" | "createdAt">> {
  const patch: Partial<Omit<Thread, "id" | "createdAt">> = {};

  if (interp.suds != null) patch.suds = interp.suds;
  if (interp.voc != null) patch.voc = interp.voc;
  if (interp.target) patch.target = interp.target;
  if (interp.negativeCognition) {
    patch.negativeCognition = interp.negativeCognition;
  }
  if (interp.positiveCognition) {
    patch.positiveCognition = interp.positiveCognition;
  }

  // Grounding is forced only by real out-of-window signals (flooding,
  // dissociation, felt unsafety) or by a red flag. A high SUDs is the normal
  // baseline a target starts from, so the number alone must never send the
  // session back to grounding: that would lock the person in a chat loop and
  // delay the set that actually lowers the distress.
  if (interp.riskFlag) {
    patch.phase = "grounding";
    patch.incomplete = true;
    return patch;
  }
  if (interp.outOfWindow || (interp.needsGrounding && thread.phase !== "intake")) {
    patch.phase = "grounding";
    patch.incomplete = true;
    return patch;
  }

  if (interp.intakeComplete) {
    patch.intakeComplete = true;
  }

  const inProcessing = PROCESSING_PHASES.has(thread.phase);

  // A set that was stopped early, or one the user wants again because they were
  // not focused, is simply repeated: the phase holds and nothing is read from
  // it. Advancing here would move on from work that never happened.
  if (
    inProcessing &&
    (interp.setReport === "stopped" ||
      interp.setReport === "repeat" ||
      interp.setReport === "unfocused")
  ) {
    return patch;
  }

  // Assessment is done once a target and a baseline SUDs exist, whatever that
  // SUDs is (10 included). This is deterministic so the first set never depends
  // on the model choosing to emit a phase.
  if (
    thread.phase === "assessment" &&
    Boolean(interp.target || thread.target) &&
    interp.suds != null
  ) {
    patch.phase = "desensitization";
    return patch;
  }

  if (interp.suggestedPhase) {
    // Intake may only advance to grounding when complete + target exists
    if (thread.phase === "intake") {
      const hasTarget = Boolean(interp.target || thread.target);
      if (
        interp.intakeComplete &&
        hasTarget &&
        !interp.riskFlag &&
        (interp.suggestedPhase === "grounding" ||
          interp.suggestedPhase === "assessment")
      ) {
        patch.phase = "grounding";
        patch.intakeComplete = true;
      }
      // else stay in intake
    } else {
      patch.phase = interp.suggestedPhase;
    }
  } else {
    // Heuristic phase advances when interpreter left suggestedPhase null
    if (thread.phase === "intake") {
      const hasTarget = Boolean(interp.target || thread.target);
      if (interp.intakeComplete && hasTarget && !interp.riskFlag) {
        patch.phase = "grounding";
        patch.intakeComplete = true;
      }
    } else if (
      thread.phase === "grounding" &&
      (interp.target || interp.negativeCognition)
    ) {
      patch.phase = "assessment";
    } else if (
      // Assessment → desensitization is handled above, before suggestedPhase.
      thread.phase === "desensitization" &&
      interp.suds != null &&
      interp.suds <= 1
    ) {
      patch.phase = "installation";
    } else if (
      thread.phase === "installation" &&
      interp.voc != null &&
      interp.voc >= 7
    ) {
      patch.phase = "body_scan";
    }
  }

  return patch;
}

/** Build a client_profiles upsert patch from an interpretation. */
export function clientProfilePatchFromInterpretation(
  interp: SessionInterpretation,
  hadCompletedIntake: boolean
): {
  presentingProblem?: string;
  historyNotes?: string;
  triggers?: string;
  resources?: string;
  goals?: string;
  riskNotes?: string;
  redFlag?: boolean;
  intakeCompletedAt?: string;
} {
  const patch: ReturnType<typeof clientProfilePatchFromInterpretation> = {};
  if (interp.presentingProblem) patch.presentingProblem = interp.presentingProblem;
  if (interp.historyNotes) patch.historyNotes = interp.historyNotes;
  if (interp.triggers) patch.triggers = interp.triggers;
  if (interp.resources) patch.resources = interp.resources;
  if (interp.goals) patch.goals = interp.goals;
  if (interp.riskNotes) patch.riskNotes = interp.riskNotes;
  if (interp.riskFlag) patch.redFlag = true;
  if (interp.intakeComplete && !hadCompletedIntake) {
    patch.intakeCompletedAt = new Date().toISOString();
  }
  return patch;
}
