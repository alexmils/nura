/** Block parser for RichArticle text (pure; shared by the renderer and tests). */

export type Block =
  | { kind: "h1" | "h2" | "h3" | "p" | "note"; text: string }
  | { kind: "ul"; items: string[] };

/** Splits article text into blocks. */
export function parseArticle(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0] ?? "";
    if (lines.every((line) => line.startsWith("- "))) {
      out.push({ kind: "ul", items: lines.map((line) => line.slice(2).trim()) });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(first);
    if (heading && lines.length === 1) {
      const level = heading[1]?.length ?? 2;
      out.push({ kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text: heading[2] ?? "" });
      continue;
    }
    if (first.startsWith(">")) {
      out.push({
        kind: "note",
        text: lines.map((line) => line.replace(/^>\s?/, "")).join(" "),
      });
      continue;
    }
    out.push({ kind: "p", text: lines.join(" ") });
  }
  return out;
}
