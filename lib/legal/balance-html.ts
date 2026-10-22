/**
 * Make exported legal HTML well-formed before it goes into
 * dangerouslySetInnerHTML. Termly exports leave tags open or close them out of
 * order; in the server-rendered page the browser's parser then carries an open
 * <strong> past the legal body into the footer, and React reports a hydration
 * mismatch. A closing tag that matches an open one closes everything opened
 * inside it; a stray closing tag is dropped; anything still open is closed at
 * the end.
 */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);

export function balanceHtml(html: string): string {
  const out: string[] = [];
  const stack: string[] = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push(html.slice(last, m.index));
    last = re.lastIndex;
    const tag = m[2]?.toLowerCase();
    if (!tag) {
      out.push(m[0]);
      continue;
    }
    if (m[1]) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }
    out.push(m[0]);
    if (VOID.has(tag) || m[0].endsWith("/>")) continue;
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}>`, last);
      const stop = end < 0 ? html.length : end + tag.length + 3;
      out.push(html.slice(last, end < 0 ? html.length : end), `</${tag}>`);
      last = stop;
      re.lastIndex = stop;
      continue;
    }
    stack.push(tag);
  }
  out.push(html.slice(last));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}
