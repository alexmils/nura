import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveSessionUser } from "@/lib/auth/refresh-session";
import {
  createAuthToken,
  latestAuthTokenAt,
} from "@/lib/auth/tokens";
import {
  resetEmailThrottled,
  RESET_EMAIL_ALREADY_SENT,
  RESET_EMAIL_FAILED,
  RESET_EMAIL_SENT,
} from "@/lib/auth/password-reset";
import { getUserById } from "@/lib/users";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";

/**
 * Send a password reset link to the signed-in account's own email.
 *
 * This is the in-app path for accounts created with Google: they have no
 * password yet, so Settings cannot ask for a current one, and the person may
 * already be signed in with Google when they want a password.
 *
 * Session-guarded and always addressed to the session owner, so it cannot be
 * used to mail an arbitrary address (no Turnstile needed, same as other
 * authenticated settings actions).
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await resolveSessionUser(session);
    if (!resolved) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(resolved.userId);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const lastRequestAt = await latestAuthTokenAt(user.id, "reset");
    if (resetEmailThrottled(lastRequestAt)) {
      return NextResponse.json({
        message: RESET_EMAIL_ALREADY_SENT,
        throttled: true,
      });
    }

    const raw = await createAuthToken(user.id, "reset");
    const resetUrl = await getAppUrl(
      `/app/reset-password?token=${encodeURIComponent(raw)}`
    );

    try {
      await sendTemplateEmail(user.email, "password_reset", {
        name: user.name ?? user.email.split("@")[0],
        resetUrl,
        expiresIn: "1 hour",
      });
    } catch (err) {
      console.error("[auth/request-password-reset] email failed:", err);
      return NextResponse.json(
        { error: RESET_EMAIL_FAILED },
        { status: 503 }
      );
    }

    await writeAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "user.password_reset_requested",
      detail: { email: user.email, source: "settings" },
      ip: clientIp(request),
    });

    return NextResponse.json({ message: RESET_EMAIL_SENT });
  } catch (err) {
    console.error("[auth/request-password-reset]", err);
    return NextResponse.json({ error: RESET_EMAIL_FAILED }, { status: 500 });
  }
}
