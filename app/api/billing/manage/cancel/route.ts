import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  loadBillingManageSnapshot,
  requireManageableSubscription,
  syncSubscriptionFromStripeObject,
} from "@/lib/billing-manage-server";
import { getEntitlementForUser, publicEntitlement } from "@/lib/entitlements";
import { runSubscriptionCancelAdminEffects } from "@/lib/subscription-cancel-effects";
import {
  formatCancelReasonSummary,
  parseCancelFeedbackBody,
} from "@/lib/subscription-cancel-reasons";
import { saveSubscriptionCancelFeedback } from "@/lib/subscription-cancel-feedback";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  let feedback: ReturnType<typeof parseCancelFeedbackBody>;
  try {
    const body = await request.json().catch(() => null);
    feedback = parseCancelFeedbackBody(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Pick at least one reason";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ctx = await requireManageableSubscription(auth.user.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { sub, resolved } = ctx;
  try {
    const updated = await resolved.stripe.subscriptions.update(
      sub.stripe_subscription_id!,
      { cancel_at_period_end: true }
    );
    await syncSubscriptionFromStripeObject(
      auth.user.id,
      updated,
      resolved.livemode
    );
    const periodEnd =
      typeof updated.current_period_end === "number"
        ? new Date(updated.current_period_end * 1000)
        : null;
    await saveSubscriptionCancelFeedback({
      userId: auth.user.id,
      stripeSubscriptionId: updated.id,
      reasonIds: feedback.reasonIds,
      comment: feedback.comment,
    });
    const reasonSummary = formatCancelReasonSummary(
      feedback.reasonIds,
      feedback.comment
    );
    await runSubscriptionCancelAdminEffects({
      userId: auth.user.id,
      stripeEventId: `manage.cancel:${updated.id}:${updated.current_period_end ?? "none"}`,
      stripeSubscriptionId: updated.id,
      eventType: "billing.manage.cancel",
      plan: sub.plan,
      accessEndsAt: periodEnd,
      keepsAccess: true,
      livemode: resolved.livemode,
      occurredAt: new Date(),
      reasonSummary,
    }).catch((err) =>
      console.error("[billing/manage/cancel] admin notify", err)
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
    console.error("[billing/manage/cancel]", err);
    return NextResponse.json(
      { error: "Could not schedule cancellation" },
      { status: 500 }
    );
  }
}
