import { NextResponse } from "next/server";
import { clientIp } from "@/lib/audit-log";
import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { getPlatformSettings } from "@/lib/platform-settings";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/turnstile";

/**
 * Public contact form (the Contact CTA template). Sends one mail to the
 * operator's support inbox with the visitor's address as Reply-To. No
 * account, no database row — the mailbox is the queue.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Per-process speed bump; the honeypot is the real bot filter. */
const recent = new Map<string, number[]>();

function overLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  // Keep the map from growing without bound on a long-lived process.
  if (recent.size > 5000) {
    for (const [key, list] of recent) {
      if (!list.some((at) => now - at < WINDOW_MS)) recent.delete(key);
    }
  }
  return false;
}

const clean = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Could not read the message." }, { status: 400 });
  }

  // Hidden field: filled means a bot. Answer as if it worked.
  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const ip = clientIp(request);
  if (ip && overLimit(ip)) {
    return NextResponse.json(
      { error: "Too many messages from this connection. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 40);
  const service = clean(body.service, 80).replace(/[\r\n]+/g, " ");
  const message = clean(body.message, 4000);

  if (!name) {
    return NextResponse.json({ error: "Add your name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json(
      { error: "Write a short message so we know how to help." },
      { status: 400 }
    );
  }

  // Turnstile after cheap validation, so obvious junk never reaches siteverify.
  const gate = await verifyTurnstileToken({
    token: extractTurnstileToken(body),
    expectedAction: "contact",
    remoteip: ip,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const settings = await getPlatformSettings();
  const to = settings.supportEmail.trim() || BRAND_SUPPORT_EMAIL;
  const subject = `[Contact] ${service || "General"} — ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    service ? `About: ${service}` : null,
    "",
    message,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1d3323;line-height:1.6">
      <h2 style="margin:0 0 12px;font-size:18px">New contact message</h2>
      <p style="margin:0 0 4px"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin:0 0 4px"><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${phone ? `<p style="margin:0 0 4px"><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
      ${service ? `<p style="margin:0 0 4px"><strong>About:</strong> ${escapeHtml(service)}</p>` : ""}
      <hr style="border:0;border-top:1px solid #dcebc4;margin:16px 0" />
      <p style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</p>
    </div>
  `.trim();

  try {
    await sendEmail({ to, subject, text, html, replyTo: email });
  } catch (error) {
    console.error("[contact] could not send message", error);
    return NextResponse.json(
      { error: `Could not send right now. Write to ${to} and we'll pick it up.` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
