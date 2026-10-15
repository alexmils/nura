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
import {
  noteLoginFailure,
  noteLoginSuccess,
  precheckLogin,
  sessionAllowedForRole,
  surfaceForGate,
} from "@/lib/login-guard";
import { isStaffRole, normalizeGuardEmail } from "@/lib/login-guard-policy";

const INVALID = "Invalid email or password";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      gate?: string;
      "cf-turnstile-response"?: string;
    };

    const email = normalizeGuardEmail(body.email);
    const surface = await surfaceForGate(body.gate);
    const guard = await precheckLogin({ request, email, surface });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const turnstile = await verifyTurnstileToken({
      token: extractTurnstileToken(body),
      expectedAction: "login",
      remoteip: clientIp(request),
    });
    if (!turnstile.ok) {
      return NextResponse.json(
        { error: turnstile.error },
        { status: turnstile.status }
      );
    }

    const { password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const fail = async (
      outcome: "unknown_user" | "bad_password" | "staff_public" | "consumer_gate" | "disabled",
      status: number,
      error: string
    ) => {
      await noteLoginFailure({
        ip: guard.ip,
        email: guard.email,
        surface,
        outcome,
        whitelisted: guard.whitelisted,
      });
      return NextResponse.json({ error }, { status });
    };

    const user = await getUserByEmail(email);
    if (!user?.passwordHash) {
      return fail("unknown_user", 401, INVALID);
    }

    if (user.status === "disabled") {
      return fail("disabled", 403, "This account has been disabled");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return fail("bad_password", 401, INVALID);
    }

    const gateAccepted = surface === "operator";
    if (!sessionAllowedForRole(user.role, gateAccepted)) {
      return fail(
        isStaffRole(user.role) ? "staff_public" : "consumer_gate",
        401,
        INVALID
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
    await noteLoginSuccess({
      ip: guard.ip,
      email: guard.email,
      surface,
      whitelisted: guard.whitelisted,
    });

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
