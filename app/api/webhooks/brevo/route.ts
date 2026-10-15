import { NextResponse } from "next/server";
import {
  applyBrevoOptOut,
  brevoEventsFromBody,
  brevoWebhookAuthorized,
  isBrevoOptOutEvent,
} from "@/lib/brevo-webhook";
import { getEmailConfig } from "@/lib/email/status";

export async function POST(request: Request) {
  const { brevoWebhookSecret } = await getEmailConfig();
  if (!brevoWebhookAuthorized(request, brevoWebhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const events = brevoEventsFromBody(body);
  let applied = 0;
  for (const event of events) {
    if (!isBrevoOptOutEvent(event.event) || !event.email) continue;
    await applyBrevoOptOut(event.email);
    applied += 1;
  }
  return NextResponse.json({ ok: true, applied });
}
