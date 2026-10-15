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
import { clientIp, recordUserLogin } from "@/lib/audit-log";
import { recordAuthPlaces } from "@/lib/auth-place";
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
      expectedAction: "reset-password",
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

    const consumed = await consumeAuthToken(token, "reset");
    if (!consumed) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    const user = await getUserById(consumed.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);
    await setUserPassword(user.id, passwordHash);

    try {
      await sendTemplateEmail(user.email, "password_changed", {
        name: user.name ?? user.email.split("@")[0],
        loginUrl: await getAppUrl("/app/login"),
      });
    } catch (err) {
      console.warn("[auth/reset-password] confirmation email failed:", err);
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
    await recordAuthPlaces(request, user.id, false);

    return NextResponse.json({ user: publicUser({ ...user, passwordHash }) });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
