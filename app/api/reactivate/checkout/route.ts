import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createReactivationCheckout,
  ReactivationError,
} from "@/lib/reactivation-stripe";
import { isPlausibleReactivationToken } from "@/lib/reactivation-rules";

/**
 * Public: the token in the link is the credential (unguessable, one-use,
 * expiring). A signed-in session for a different account is refused so a
 * forwarded link cannot be redeemed into the wrong account.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; ui?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!isPlausibleReactivationToken(token)) {
    return NextResponse.json({ error: "This link is not valid", code: "invalid" }, { status: 404 });
  }
  const session = await getSession().catch(() => null);
  try {
    const result = await createReactivationCheckout({
      token,
      sessionUserId: session?.sub ?? null,
      ui: body.ui === "elements" ? "elements" : "hosted",
    });
    if (result.kind === "elements") {
      return NextResponse.json({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
      });
    }
    return NextResponse.json({ url: result.url });
  } catch (err) {
    if (err instanceof ReactivationError) {
      const messages: Record<string, string> = {
        invalid: "This link is not valid",
        used: "This link has already been used",
        expired: "This link has expired",
        already_active: "Your plan is already active",
        extend_failed: "We could not add your free days right now. Try again in a moment.",
        extend: "This offer is not available",
        wrong_account: "This link belongs to a different account. Sign out and open it again.",
        not_configured: "Checkout is not available right now",
        no_price: "Checkout is not available right now",
        test_live: "This is a test link. Test links only work while payments run in test mode.",
      };
      return NextResponse.json(
        { error: messages[err.code] ?? "Checkout failed", code: err.code },
        { status: err.status }
      );
    }
    console.error("[reactivate/checkout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
