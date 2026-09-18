import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  consumeBlsSeconds,
  PaymentRequiredError,
  TrialLimitError,
} from "@/lib/trial-usage";
import { publicEntitlement } from "@/lib/entitlements";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    seconds?: unknown;
  };
  const seconds =
    typeof body.seconds === "number" && Number.isFinite(body.seconds)
      ? Math.max(0, Math.floor(body.seconds))
      : 0;

  try {
    const result = await consumeBlsSeconds({
      userId: auth.user.id,
      role: auth.user.role,
      onboardingCompletedAt: auth.user.onboardingCompletedAt,
      seconds: seconds || 1,
    });
    return NextResponse.json({
      granted: result.granted,
      entitlement: publicEntitlement(result.entitlement),
    });
  } catch (err) {
    if (err instanceof PaymentRequiredError || err instanceof TrialLimitError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          entitlement: publicEntitlement(err.entitlement),
        },
        { status: 402 }
      );
    }
    console.error("[billing/bls-lease]", err);
    return NextResponse.json({ error: "Self-guided set time lease failed" }, { status: 500 });
  }
}
