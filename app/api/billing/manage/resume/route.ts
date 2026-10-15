import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  loadBillingManageSnapshot,
  requireManageableSubscription,
  syncSubscriptionFromStripeObject,
} from "@/lib/billing-manage-server";
import { clearSubscriptionCancelNotice } from "@/lib/email/billing-customer";
import { getEntitlementForUser, publicEntitlement } from "@/lib/entitlements";
import { runSubscriptionResumeAdminEffects } from "@/lib/subscription-cancel-effects";

export async function POST() {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const ctx = await requireManageableSubscription(auth.user.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { sub, resolved } = ctx;
  try {
    const updated = await resolved.stripe.subscriptions.update(
      sub.stripe_subscription_id!,
      { cancel_at_period_end: false }
    );
    await clearSubscriptionCancelNotice(
      auth.user.id,
      sub.stripe_subscription_id!
    );
    await syncSubscriptionFromStripeObject(
      auth.user.id,
      updated,
      resolved.livemode
    );
    const renewsAt =
      typeof updated.current_period_end === "number"
        ? new Date(updated.current_period_end * 1000)
        : null;
    await runSubscriptionResumeAdminEffects({
      userId: auth.user.id,
      stripeEventId: `manage.resume:${updated.id}:${Date.now()}`,
      stripeSubscriptionId: updated.id,
      eventType: "billing.manage.resume",
      plan: sub.plan,
      renewsAt,
      livemode: resolved.livemode,
      occurredAt: new Date(),
    }).catch((err) =>
      console.error("[billing/manage/resume] admin notify", err)
    );
    const entitlement = await getEntitlementForUser({
      userId: auth.user.id,
      role: auth.user.role,
      onboardingCompletedAt: auth.user.onboardingCompletedAt,
    });
    const snapshot = await loadBillingManageSnapshot(auth.user.id);
    return NextResponse.json({
      ok: true,
      entitlement: publicEntitlement(entitlement),
      manage: snapshot.ok ? snapshot.snapshot : null,
    });
  } catch (err) {
    console.error("[billing/manage/resume]", err);
    return NextResponse.json(
      { error: "Could not resume subscription" },
      { status: 500 }
    );
  }
}
