import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { clientIp } from "@/lib/audit-log";
import { syncBrevoContactForUser } from "@/lib/email/brevo-contacts";
import { setMarketingEmailPreference } from "@/lib/marketing-email-preference";
import { getUserById } from "@/lib/users";

export async function GET() {
  return withAuth(async (ctx) => {
    const user = await getUserById(ctx.user.id);
    return NextResponse.json({
      optedIn: Boolean(user?.marketingEmailOptIn),
      updatedAt: user?.marketingEmailOptInAt ?? null,
    });
  });
}

export async function POST(request: Request) {
  return withAuth(async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as {
      optedIn?: boolean;
    };
    if (typeof body.optedIn !== "boolean") {
      return NextResponse.json({ error: "optedIn is required" }, { status: 400 });
    }
    const user = await setMarketingEmailPreference({
      userId: ctx.user.id,
      optedIn: body.optedIn,
      source: "settings",
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    void syncBrevoContactForUser(ctx.user.id).catch((err) =>
      console.error("[brevo] settings sync", err)
    );
    return NextResponse.json({
      optedIn: Boolean(user?.marketingEmailOptIn),
      updatedAt: user?.marketingEmailOptInAt ?? null,
    });
  });
}
