import { NextResponse } from "next/server";
import {
  applyBrevoBounce,
  applyBrevoOptOut,
  brevoEventsFromBody,
  brevoWebhookAuthorized,
  isBrevoBounceEvent,
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
  let optedOut = 0;
  let bounced = 0;
  for (const event of events) {
    if (!event.email) continue;
    if (isBrevoOptOutEvent(event.event)) {
      await applyBrevoOptOut(event.email);
      optedOut += 1;
    } else if (isBrevoBounceEvent(event.event)) {
      await applyBrevoBounce(event.email);
      bounced += 1;
    }
  }
  return NextResponse.json({
    ok: true,
    applied: optedOut + bounced,
    optedOut,
    bounced,
  });
}
