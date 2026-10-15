import { NextResponse } from "next/server";
import { clientIp } from "@/lib/audit-log";
import { subscribeNewsletter } from "@/lib/newsletter";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/turnstile";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile-shared";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const gate = await verifyTurnstileToken({
    token: extractTurnstileToken(body),
    expectedAction: "newsletter",
    remoteip: clientIp(request),
  });
  if (!gate.success) {
    return NextResponse.json(
      { error: "Complete the check and try again." },
      { status: 400 }
    );
  }

  const result = await subscribeNewsletter({
    email: typeof body.email === "string" ? body.email : "",
    marketingEmailOptIn: body.marketingEmailOptIn === true,
    ip: clientIp(request),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, field: TURNSTILE_TOKEN_FIELD });
}
