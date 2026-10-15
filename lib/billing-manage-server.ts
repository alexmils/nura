import type Stripe from "stripe";
import { shouldOfferBillingPortal } from "@/lib/checkout-rules";
import type {
  BillingManagePaymentMethod,
  BillingManageSnapshot,
} from "@/lib/billing-manage-types";
import {
  getSubscriptionByUserId,
  mapStripeSubscriptionWithConfig,
  syncSubscriptionFromStripe,
} from "@/lib/stripe-admin";
import { resolveStripeClient } from "@/lib/stripe";

export type { BillingManagePaymentMethod, BillingManageSnapshot };

export async function requireManageableSubscription(userId: string) {
  const sub = await getSubscriptionByUserId(userId);
  if (!sub?.stripe_subscription_id) {
    return { error: "No subscription on file", status: 400 as const };
  }
  if (!shouldOfferBillingPortal({ status: sub.status })) {
    return { error: "Nothing to manage for this account", status: 400 as const };
  }
  const resolved = await resolveStripeClient({
    livemode: sub.stripe_livemode,
    objectId: sub.stripe_subscription_id,
  });
  if (!resolved) {
    return { error: "Billing is not configured", status: 503 as const };
  }
  return { sub, resolved };
}

export function paymentMethodFromStripe(
  pm: Stripe.PaymentMethod | null | undefined
): BillingManagePaymentMethod | null {
  if (!pm || pm.type !== "card" || !pm.card) return null;
  return {
    brand: pm.card.brand ?? null,
    last4: pm.card.last4 ?? null,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
  };
}

export async function loadBillingManageSnapshot(
  userId: string
): Promise<
  | { ok: true; snapshot: BillingManageSnapshot; sub: NonNullable<Awaited<ReturnType<typeof getSubscriptionByUserId>>> }
  | { ok: false; error: string; status: number }
> {
  const ctx = await requireManageableSubscription(userId);
  if ("error" in ctx) {
    return { ok: false, error: ctx.error, status: ctx.status };
  }
  const { sub, resolved } = ctx;
  const stripeSub = await resolved.stripe.subscriptions.retrieve(
    sub.stripe_subscription_id!,
    { expand: ["default_payment_method"] }
  );
  const periodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000).toISOString()
    : null;
  const trialEnd = stripeSub.trial_end
    ? new Date(stripeSub.trial_end * 1000).toISOString()
    : null;
  const defaultPm =
    stripeSub.default_payment_method &&
    typeof stripeSub.default_payment_method !== "string"
      ? stripeSub.default_payment_method
      : null;

  const mapped = await mapStripeSubscriptionWithConfig(
    stripeSub,
    resolved.livemode
  );
  await syncSubscriptionFromStripe({
    userId,
    ...mapped,
    stripeLivemode: resolved.livemode,
  });

  return {
    ok: true,
    sub,
    snapshot: {
      plan: sub.plan,
      status: sub.status,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      accessEndsAt: stripeSub.cancel_at_period_end ? periodEnd : null,
      trialEndsAt: trialEnd,
      renewsAt: periodEnd,
      paymentMethod: paymentMethodFromStripe(defaultPm),
      stripeSubscriptionId: stripeSub.id,
    },
  };
}

export async function syncSubscriptionFromStripeObject(
  userId: string,
  stripeSub: Stripe.Subscription,
  livemode: boolean
) {
  const mapped = await mapStripeSubscriptionWithConfig(stripeSub, livemode);
  const created =
    typeof stripeSub.created === "number" ? stripeSub.created : undefined;
  await syncSubscriptionFromStripe({
    userId,
    ...mapped,
    stripeLivemode: livemode,
    eventCreatedAt: created,
  });
}
