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

/** Trialing subs often keep the card on the customer, not on the subscription. */
export async function resolveDefaultCardPaymentMethod(
  stripe: Stripe,
  input: {
    subscription: Stripe.Subscription;
    customerId: string | null;
  }
): Promise<Stripe.PaymentMethod | null> {
  const subPm = input.subscription.default_payment_method;
  if (subPm && typeof subPm !== "string" && subPm.type === "card") {
    return subPm;
  }
  if (typeof subPm === "string") {
    try {
      const pm = await stripe.paymentMethods.retrieve(subPm);
      if (pm.type === "card") return pm;
    } catch {
      /* fall through */
    }
  }

  const customerId = input.customerId;
  if (!customerId) return null;

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer && !customer.deleted) {
      const inv = customer.invoice_settings?.default_payment_method;
      if (inv && typeof inv !== "string" && inv.type === "card") {
        return inv;
      }
      if (typeof inv === "string") {
        const pm = await stripe.paymentMethods.retrieve(inv);
        if (pm.type === "card") return pm;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    const card = list.data[0];
    if (card?.type === "card") return card;
  } catch {
    /* no card */
  }

  return null;
}

/** Copy customer card onto the subscription so renewals and Manage billing agree. */
export async function attachResolvedPaymentMethodToSubscription(
  stripe: Stripe,
  input: {
    subscriptionId: string;
    customerId: string | null;
    paymentMethodId: string | null;
    subscriptionHasDefault: boolean;
  }
): Promise<void> {
  if (!input.paymentMethodId || input.subscriptionHasDefault) return;
  try {
    await stripe.subscriptions.update(input.subscriptionId, {
      default_payment_method: input.paymentMethodId,
    });
    if (input.customerId) {
      await stripe.customers.update(input.customerId, {
        invoice_settings: { default_payment_method: input.paymentMethodId },
      });
    }
  } catch (err) {
    console.error("[billing/manage] attach default_payment_method", err);
  }
}

export async function syncSubscriptionDefaultPaymentMethod(
  stripe: Stripe,
  subscriptionId: string,
  customerId: string | null
): Promise<void> {
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  });
  const pm = await resolveDefaultCardPaymentMethod(stripe, {
    subscription: stripeSub,
    customerId,
  });
  await attachResolvedPaymentMethodToSubscription(stripe, {
    subscriptionId,
    customerId,
    paymentMethodId: pm?.id ?? null,
    subscriptionHasDefault: Boolean(stripeSub.default_payment_method),
  });
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
  const defaultPm = await resolveDefaultCardPaymentMethod(resolved.stripe, {
    subscription: stripeSub,
    customerId: sub.stripe_customer_id,
  });

  await attachResolvedPaymentMethodToSubscription(resolved.stripe, {
    subscriptionId: sub.stripe_subscription_id!,
    customerId: sub.stripe_customer_id,
    paymentMethodId: defaultPm?.id ?? null,
    subscriptionHasDefault: Boolean(stripeSub.default_payment_method),
  });

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
