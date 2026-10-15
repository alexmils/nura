import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getUserByEmail, publicUser } from "@/lib/users";
import { clientIp, recordUserLogin } from "@/lib/audit-log";
import { recordAuthPlaces } from "@/lib/auth-place";
import {
  getEntitlementForUser,
  publicEntitlement,
} from "@/lib/entitlements";
import { ensureUserAccessStub } from "@/lib/user-access";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      "cf-turnstile-response"?: string;
    };

    const gate = await verifyTurnstileToken({
      token: extractTurnstileToken(body),
      expectedAction: "login",
      remoteip: clientIp(request),
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const { email, password } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);
    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status === "disabled") {
      return NextResponse.json(
        { error: "This account has been disabled" },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
    });

    const jar = await cookies();
    jar.set(sessionCookieOptions(token));

    await recordUserLogin(user.id, clientIp(request));
    await recordAuthPlaces(request, user.id, false);

    if (user.role === "user") {
      await ensureUserAccessStub(user.id);
    }

    const entitlement = await getEntitlementForUser({
      userId: user.id,
      role: user.role,
      onboardingCompletedAt: user.onboardingCompletedAt,
    });

    return NextResponse.json({
      user: publicUser(user),
      entitlement: publicEntitlement(entitlement),
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
