import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  loadBillingManageSnapshot,
  requireManageableSubscription,
  syncSubscriptionFromStripeObject,
} from "@/lib/billing-manage-server";
import { resolveStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  let sessionId = "";
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json({ error: "Missing session" }, { status: 400 });
    }
    sessionId = body.sessionId.trim();
  } catch {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  const ctx = await requireManageableSubscription(auth.user.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const resolved = await resolveStripeClient({ objectId: sessionId });
  if (!resolved) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 }
    );
  }

  try {
    const session = await resolved.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });
    if (session.mode !== "setup") {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    if (
      session.client_reference_id !== auth.user.id &&
      session.metadata?.user_id !== auth.user.id
    ) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const setupIntent =
      session.setup_intent && typeof session.setup_intent !== "string"
        ? session.setup_intent
        : null;
    const paymentMethodId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "No payment method on session" },
        { status: 400 }
      );
    }

    const customerId = ctx.sub.stripe_customer_id;
    if (customerId) {
      await resolved.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    const updated = await resolved.stripe.subscriptions.update(
      ctx.sub.stripe_subscription_id!,
      { default_payment_method: paymentMethodId }
    );
    await syncSubscriptionFromStripeObject(
      auth.user.id,
      updated,
      resolved.livemode
    );

    const snapshot = await loadBillingManageSnapshot(auth.user.id);
    return NextResponse.json({
      ok: true,
      manage: snapshot.ok ? snapshot.snapshot : null,
    });
  } catch (err) {
    console.error("[billing/manage/setup-complete]", err);
    return NextResponse.json(
      { error: "Could not save payment method" },
      { status: 500 }
    );
  }
}
