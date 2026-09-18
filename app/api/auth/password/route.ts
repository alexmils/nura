import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveSessionUser } from "@/lib/auth/refresh-session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordChangeError } from "@/lib/auth/password-change";
import { getUserById, publicUser, setUserPassword } from "@/lib/users";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";

/**
 * Set or change the signed-in user's password.
 *
 * Google-only accounts have no password, so this sets one on the same user row.
 * They can then sign in with email + password and keep the same account.
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

    const body = (await request.json()) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : null;
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    const user = await getUserById(resolved.userId);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const existingHash = user.passwordHash;
    const hasPassword = Boolean(existingHash);

    let currentPasswordMatches: boolean | undefined;
    if (existingHash && currentPassword) {
      currentPasswordMatches = await verifyPassword(
        currentPassword,
        existingHash
      );
    }

    const error = passwordChangeError({
      hasPassword,
      currentPassword,
      currentPasswordMatches,
      newPassword,
    });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await setUserPassword(user.id, passwordHash);

    await writeAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "user.password_set",
      detail: {
        email: user.email,
        source: "settings",
        mode: hasPassword ? "change" : "set",
      },
      ip: clientIp(request),
    });

    try {
      await sendTemplateEmail(user.email, "password_changed", {
        name: user.name ?? user.email.split("@")[0],
        loginUrl: await getAppUrl("/app/login"),
      });
    } catch (err) {
      console.warn("[auth/password] confirmation email failed:", err);
    }

    return NextResponse.json({
      user: publicUser({ ...user, passwordHash }),
    });
  } catch (err) {
    console.error("[auth/password]", err);
    return NextResponse.json(
      { error: "Could not update password" },
      { status: 500 }
    );
  }
}
