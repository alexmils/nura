import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  hashPassword,
  validatePassword,
} from "@/lib/auth/password";
import {
  createUser,
  getUserByEmail,
  publicUser,
  setUserPassword,
} from "@/lib/users";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import { notifyAdminsOfSignup } from "@/lib/email/admin-payment-notify";
import { LOGIN_PATH } from "@/lib/app-base";
import { ensureUserAccessStub } from "@/lib/user-access";
import { persistAttributionFromCookie } from "@/lib/attribution-server";
import {
  getEntitlementForUser,
  publicEntitlement,
} from "@/lib/entitlements";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      "cf-turnstile-response"?: string;
    };

    const gate = await verifyTurnstileToken({
      token: extractTurnstileToken(body),
      expectedAction: "signup",
      remoteip: clientIp(request),
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const name = body.name?.trim() || undefined;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 }
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    const user = await createUser(email, name, "user");
    const passwordHash = await hashPassword(password);
    await setUserPassword(user.id, passwordHash);
    await ensureUserAccessStub(user.id);
    // Stash the ad click that brought them here; the charge lands days later.
    await persistAttributionFromCookie(
      user.id,
      request.headers.get("cookie")
    );

    try {
      await sendTemplateEmail(user.email, "welcome", {
        name: user.name ?? user.email.split("@")[0],
        loginUrl: await getAppUrl(LOGIN_PATH),
      });
    } catch (err) {
      console.warn("[auth/register] welcome email failed:", err);
    }

    void notifyAdminsOfSignup({
      userId: user.id,
      email: user.email,
      name: name ?? user.name,
      source: "email",
    });

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: name ?? user.name ?? undefined,
      role: "user",
    });
    const jar = await cookies();
    jar.set(sessionCookieOptions(token));

    await writeAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "user.created",
      detail: { source: "self_register" },
      ip: clientIp(request),
    });

    const entitlement = await getEntitlementForUser({
      userId: user.id,
      role: "user",
      onboardingCompletedAt: null,
    });

    return NextResponse.json({
      user: publicUser({
        ...user,
        name: name ?? user.name,
        passwordHash,
        emailVerified: true,
        role: "user",
        onboardingCompletedAt: null,
      }),
      entitlement: publicEntitlement(entitlement),
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json(
      { error: "Could not create account" },
      { status: 500 }
    );
  }
}
