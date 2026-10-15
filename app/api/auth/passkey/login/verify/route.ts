import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  publicKeyFromBase64Url,
  verifyAuthentication,
} from "@/lib/auth/webauthn";
import {
  getPasskeyByCredentialId,
  updatePasskeyCounter,
} from "@/lib/passkeys";
import { getUserById, publicUser } from "@/lib/users";
import { clientIp, recordUserLogin } from "@/lib/audit-log";
import { recordAuthPlaces } from "@/lib/auth-place";
import {
  getEntitlementForUser,
  publicEntitlement,
} from "@/lib/entitlements";
import { ensureUserAccessStub } from "@/lib/user-access";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      response?: AuthenticationResponseJSON;
    };

    if (!body.response?.id) {
      return NextResponse.json(
        { error: "Authentication response is required" },
        { status: 400 }
      );
    }

    const passkey = await getPasskeyByCredentialId(body.response.id);
    if (!passkey) {
      return NextResponse.json(
        { error: "Unknown passkey" },
        { status: 401 }
      );
    }

    const user = await getUserById(passkey.userId);
    if (!user || user.status === "disabled") {
      return NextResponse.json(
        { error: "Account unavailable" },
        { status: 403 }
      );
    }

    const verification = await verifyAuthentication({
      response: body.response,
      credential: {
        id: passkey.credentialId,
        publicKey: publicKeyFromBase64Url(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 401 }
      );
    }

    await updatePasskeyCounter(
      passkey.credentialId,
      verification.authenticationInfo.newCounter
    );

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
    console.error("[passkey/login/verify]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Passkey login failed",
      },
      { status: 400 }
    );
  }
}
