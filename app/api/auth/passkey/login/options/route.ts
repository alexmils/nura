import { NextResponse } from "next/server";
import { createAuthenticationOptions } from "@/lib/auth/webauthn";
import { getUserByEmail } from "@/lib/users";
import { listPasskeysForUser } from "@/lib/passkeys";
import { precheckLogin, surfaceForGate } from "@/lib/login-guard";
import { normalizeGuardEmail } from "@/lib/login-guard-policy";

export async function POST(request: Request) {
  try {
    let email: string | undefined;
    let gate: string | undefined;
    try {
      const body = (await request.json()) as { email?: string; gate?: string };
      email = normalizeGuardEmail(body.email);
      gate = body.gate;
    } catch {
      /* empty body ok for discoverable passkeys */
    }

    const surface = await surfaceForGate(gate);
    const guard = await precheckLogin({ request, email, surface });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    let allowCredentialIds: string[] | undefined;
    if (email) {
      const user = await getUserByEmail(email);
      if (user && user.status !== "disabled") {
        const keys = await listPasskeysForUser(user.id);
        allowCredentialIds = keys.map((k) => k.credentialId);
      } else {
        // Avoid account enumeration — still return a challenge
        allowCredentialIds = [];
      }
    }

    const options = await createAuthenticationOptions({
      allowCredentialIds:
        allowCredentialIds && allowCredentialIds.length > 0
          ? allowCredentialIds
          : undefined,
    });

    return NextResponse.json({ options });
  } catch (err) {
    console.error("[passkey/login/options]", err);
    return NextResponse.json(
      { error: "Could not start passkey login" },
      { status: 500 }
    );
  }
}
