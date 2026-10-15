import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  isBillingPlanId,
  type BillingPlanId,
} from "@/lib/billing-constants";
import {
  loadBillingManageSnapshot,
  requireManageableSubscription,
  syncSubscriptionFromStripeObject,
} from "@/lib/billing-manage-server";
import { priceIdForPlan } from "@/lib/stripe";
import { getEntitlementForUser, publicEntitlement } from "@/lib/entitlements";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  let plan: BillingPlanId = "yearly";
  try {
    const body = (await request.json()) as { plan?: unknown };
    if (!isBillingPlanId(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    plan = body.plan;
  } catch {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const ctx = await requireManageableSubscription(auth.user.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const priceId = await priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Plan ${plan} is not configured` },
      { status: 503 }
    );
  }

  const { sub, resolved } = ctx;
  if (sub.status !== "active" && sub.status !== "trialing") {
    return NextResponse.json(
      { error: "Update your payment method first" },
      { status: 400 }
    );
  }

  try {
    const current = await resolved.stripe.subscriptions.retrieve(
      sub.stripe_subscription_id!
    );
    const itemId = current.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json(
        { error: "Subscription has no billable item" },
        { status: 500 }
      );
    }
    const updated = await resolved.stripe.subscriptions.update(
      sub.stripe_subscription_id!,
      {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: {
          ...current.metadata,
          plan,
          user_id: auth.user.id,
          user_email: auth.user.email,
        },
      }
    );
    await syncSubscriptionFromStripeObject(
      auth.user.id,
      updated,
      resolved.livemode
    );
    const entitlement = await getEntitlementForUser({
      userId: auth.user.id,
      role: auth.user.role,
      onboardingCompletedAt: auth.user.onboardingCompletedAt,
    });
    const snapshot = await loadBillingManageSnapshot(auth.user.id);
    return NextResponse.json({
      ok: true,
      plan,
      entitlement: publicEntitlement(entitlement),
      manage: snapshot.ok ? snapshot.snapshot : null,
    });
  } catch (err) {
    console.error("[billing/manage/plan]", err);
    return NextResponse.json(
      { error: "Could not change plan" },
      { status: 500 }
    );
  }
}
