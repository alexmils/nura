import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { consumeAuthToken } from "@/lib/auth/tokens";
import {
  hashPassword,
  validatePassword,
} from "@/lib/auth/password";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { getUserById, publicUser, setUserPassword } from "@/lib/users";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import { clientIp, recordUserLogin, writeAuditEvent } from "@/lib/audit-log";
import { recordAuthPlaces } from "@/lib/auth-place";
import { grantInvitedUserLegacyAccess } from "@/lib/user-access";
import { isStaffRole } from "@/lib/login-guard-policy";
import {
  getEntitlementForUser,
  publicEntitlement,
} from "@/lib/entitlements";
import { resolveAccessRedirect } from "@/lib/access-gate";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
      "cf-turnstile-response"?: string;
    };

    const gate = await verifyTurnstileToken({
      token: extractTurnstileToken(body),
      expectedAction: "create-password",
      remoteip: clientIp(request),
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const consumed = await consumeAuthToken(token, "invite");
    if (!consumed) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 400 }
      );
    }

    const user = await getUserById(consumed.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.passwordHash) {
      return NextResponse.json(
        { error: "Password already set. Sign in or reset your password." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    await setUserPassword(user.id, passwordHash);

    if (user.role === "user") {
      await grantInvitedUserLegacyAccess(user.id);
    }

    await writeAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "user.password_set",
      detail: { email: user.email, source: "invite" },
      ip: clientIp(request),
    });

    try {
      await sendTemplateEmail(user.email, "welcome", {
        name: user.name ?? user.email.split("@")[0],
        loginUrl: await getAppUrl("/app/login"),
      });
    } catch (err) {
      console.warn("[auth/create-password] welcome email failed:", err);
    }

    if (isStaffRole(user.role)) {
      return NextResponse.json({ operatorSignIn: true });
    }

    const sessionToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
    });
    const jar = await cookies();
    jar.set(sessionCookieOptions(sessionToken));

    await recordUserLogin(user.id, clientIp(request));
    await recordAuthPlaces(request, user.id, true);

    const refreshed = await getUserById(user.id);
    const entitlement = await getEntitlementForUser({
      userId: user.id,
      role: user.role,
      onboardingCompletedAt: refreshed?.onboardingCompletedAt ?? null,
    });
    const redirectTo = resolveAccessRedirect({
      role: user.role,
      needsOnboarding: entitlement.needsOnboarding,
      needsPayment: entitlement.needsPayment,
      canUseApp: entitlement.canUseApp,
    });

    return NextResponse.json({
      user: publicUser(refreshed ?? { ...user, passwordHash }),
      entitlement: publicEntitlement(entitlement),
      redirectTo,
    });
  } catch (err) {
    console.error("[auth/create-password]", err);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
