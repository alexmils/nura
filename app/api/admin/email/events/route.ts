import { NextResponse } from "next/server";
import {
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import { listEmailEvents, type EmailEventStatus } from "@/lib/email-events";
import type { EmailLogAudience } from "@/lib/email/template-labels";

export async function GET(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      200,
      Math.max(1, Number(searchParams.get("limit") ?? 50))
    );
    const status = searchParams.get("status") as EmailEventStatus | null;
    const audienceParam = searchParams.get("audience");
    const audience: EmailLogAudience | undefined =
      audienceParam === "admin" || audienceParam === "user"
        ? audienceParam
        : undefined;
    const days = searchParams.get("days")
      ? Number(searchParams.get("days"))
      : undefined;

    const events = await listEmailEvents({
      limit,
      status: status === "sent" || status === "failed" ? status : undefined,
      audience,
      days,
    });
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[admin/email/events]", err);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
