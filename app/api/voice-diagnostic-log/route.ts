/**
 * TEMPORARY diagnostic sink for the iOS voice investigation.
 * See public/voice-diagnostic.html. It only echoes the phone's speech log into
 * the dev server terminal so an agent can read it. No persistence, no DB.
 * DELETE this file together with public/voice-diagnostic.html when done.
 */

const MAX_CHARS = 20_000;

export async function POST(request: Request) {
  let body = "";
  try {
    body = await request.text();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!body.trim()) return new Response(null, { status: 204 });

  // Single line per payload so the file stays readable.
  const flat = body.replace(/\s*\n\s*/g, " | ").slice(0, MAX_CHARS);
  const entry = `${new Date().toISOString()} ${flat}\n`;

  console.log(`[voice-diag] ${flat}`);
  try {
    const { appendFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    appendFileSync(join(process.cwd(), "voice-diag.log"), entry, "utf8");
  } catch {
    /* the terminal log above is the fallback */
  }
  return new Response(null, { status: 204 });
}
