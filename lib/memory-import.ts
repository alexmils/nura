export type ImportSource = "chatgpt" | "claude" | "nura" | "plain";

export interface ImportCandidate {
  id: string;
  title: string;
  body: string;
  bodyPreview: string;
}

export interface ImportParseResult {
  source: ImportSource;
  candidates: ImportCandidate[];
}

export const IMPORT_MAX_NOTES = 40;
export const IMPORT_BODY_MAX_CHARS = 4000;
export const IMPORT_TITLE_MAX_CHARS = 120;

const UNRECOGNIZED =
  "This file isn’t a ChatGPT or Claude export we recognize.";

function clampTitle(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "Imported note";
  return t.length > IMPORT_TITLE_MAX_CHARS
    ? `${t.slice(0, IMPORT_TITLE_MAX_CHARS - 1)}…`
    : t;
}

function clampBody(raw: string): string {
  const b = raw.replace(/\r\n/g, "\n").trim();
  if (b.length <= IMPORT_BODY_MAX_CHARS) return b;
  return `${b.slice(0, IMPORT_BODY_MAX_CHARS - 1)}…`;
}

function preview(body: string): string {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length > 120 ? `${one.slice(0, 119)}…` : one;
}

function candidate(
  id: string,
  title: string,
  body: string
): ImportCandidate | null {
  const t = clampTitle(title);
  const b = clampBody(body);
  if (!b) return null;
  return { id, title: t, body: b, bodyPreview: preview(b) };
}

function chatgptPartsText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof p === "string" ? p : ""))
    .filter(Boolean)
    .join("\n");
}

function flattenChatgptConversation(conv: Record<string, unknown>): string {
  const mapping = conv.mapping as
    | Record<
        string,
        {
          parent?: string | null;
          message?: {
            author?: { role?: string };
            content?: { parts?: unknown };
          };
        }
      >
    | undefined;
  if (!mapping || typeof mapping !== "object") return "";

  let nodeId =
    typeof conv.current_node === "string" ? conv.current_node : null;
  if (!nodeId) {
    // Fallback: pick any leaf (no children) with a message
    for (const [id, node] of Object.entries(mapping)) {
      const children = (node as { children?: string[] }).children;
      if (!children?.length && node.message) {
        nodeId = id;
        break;
      }
    }
  }

  const path: string[] = [];
  const seen = new Set<string>();
  while (nodeId && !seen.has(nodeId)) {
    seen.add(nodeId);
    const node = mapping[nodeId];
    if (!node) break;
    const role = node.message?.author?.role;
    if (role === "user") {
      const text = chatgptPartsText(node.message?.content?.parts);
      if (text.trim()) path.push(text.trim());
    }
    nodeId = node.parent ?? null;
  }
  return path.reverse().join("\n\n");
}

function isChatgptExport(data: unknown): data is Record<string, unknown>[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return (
    first != null &&
    typeof first === "object" &&
    "mapping" in first &&
    typeof (first as { mapping: unknown }).mapping === "object"
  );
}

function isClaudeExport(data: unknown): data is Record<string, unknown>[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return (
    first != null &&
    typeof first === "object" &&
    Array.isArray((first as { chat_messages?: unknown }).chat_messages)
  );
}

function parseNuraNotes(data: unknown): ImportCandidate[] | null {
  let list: unknown[] | null = null;
  if (Array.isArray(data)) {
    list = data;
  } else if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { notes?: unknown }).notes)
  ) {
    list = (data as { notes: unknown[] }).notes;
  }
  if (!list?.length) return null;
  const out: ImportCandidate[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object") continue;
    const title = String((item as { title?: unknown }).title ?? "");
    const body = String((item as { body?: unknown }).body ?? "");
    const c = candidate(`nura-${i}`, title || `Note ${i + 1}`, body);
    if (c) out.push(c);
  }
  return out.length ? out : null;
}

function parseChatgpt(data: Record<string, unknown>[]): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  data.forEach((conv, i) => {
    const title = String(conv.title ?? `ChatGPT chat ${i + 1}`);
    const body = flattenChatgptConversation(conv);
    const id = String(conv.conversation_id ?? conv.id ?? `chatgpt-${i}`);
    const c = candidate(id, title, body);
    if (c) out.push(c);
  });
  return out;
}

function parseClaude(data: Record<string, unknown>[]): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  data.forEach((conv, i) => {
    const title = String(conv.name ?? `Claude chat ${i + 1}`);
    const messages = conv.chat_messages as
      | { sender?: string; text?: string }[]
      | undefined;
    const userParts = (messages ?? [])
      .filter((m) => m.sender === "human" && typeof m.text === "string")
      .map((m) => (m.text as string).trim())
      .filter(Boolean);
    const id = String(conv.uuid ?? `claude-${i}`);
    const c = candidate(id, title, userParts.join("\n\n"));
    if (c) out.push(c);
  });
  return out;
}

function parsePlainText(text: string): ImportCandidate[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  const nl = trimmed.indexOf("\n");
  const first = nl === -1 ? trimmed : trimmed.slice(0, nl);
  const rest = nl === -1 ? trimmed : trimmed.slice(nl + 1).trim();
  const title = first.length <= 80 ? first : "Imported note";
  const body = first.length <= 80 && rest ? rest : trimmed;
  const c = candidate("plain-0", title, body);
  return c ? [c] : [];
}

function parseJsonPayload(raw: string): ImportParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(UNRECOGNIZED);
  }

  const nura = parseNuraNotes(data);
  if (nura) return { source: "nura", candidates: nura };

  if (isClaudeExport(data)) {
    const candidates = parseClaude(data);
    if (!candidates.length) throw new Error(UNRECOGNIZED);
    return { source: "claude", candidates };
  }

  if (isChatgptExport(data)) {
    const candidates = parseChatgpt(data);
    if (!candidates.length) throw new Error(UNRECOGNIZED);
    return { source: "chatgpt", candidates };
  }

  throw new Error(UNRECOGNIZED);
}

/** Parse JSON text, plain text, or UTF-8 bytes of conversations.json. */
export function parseImportText(
  fileName: string,
  text: string
): ImportParseResult {
  const lower = fileName.toLowerCase();
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) throw new Error(UNRECOGNIZED);

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return { source: "plain", candidates: parsePlainText(trimmed) };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonPayload(trimmed);
  }

  if (lower.endsWith(".json")) {
    return parseJsonPayload(trimmed);
  }

  return { source: "plain", candidates: parsePlainText(trimmed) };
}

/**
 * Find conversations.json (or similar) inside a ZIP ArrayBuffer using fflate.
 * Caller should pass unzipSync from fflate to keep this module Node-testable without ZIP.
 */
export function pickConversationsJsonFromZip(
  files: Record<string, Uint8Array>
): { fileName: string; text: string } | null {
  const decoder = new TextDecoder("utf-8");
  const entries = Object.keys(files).filter(
    (k) => !k.endsWith("/") && !k.includes("__MACOSX")
  );
  const preferred = entries.find((k) =>
    /(^|\/)conversations\.json$/i.test(k)
  );
  const jsonFiles = preferred
    ? [preferred]
    : entries.filter((k) => k.toLowerCase().endsWith(".json"));

  for (const name of jsonFiles) {
    const bytes = files[name];
    if (!bytes?.length) continue;
    const text = decoder.decode(bytes);
    try {
      parseImportText(name, text);
      return { fileName: name, text };
    } catch {
      continue;
    }
  }
  return null;
}
