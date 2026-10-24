/**
 * Stripe side of the win-back offer: build the trial Checkout, then finish it
 * (webhook or success page, whichever lands first; both are idempotent).
 */
import type Stripe from "stripe";
import {
  activeStripeLivemode,
  getStripe,
  getStripeConfig,
  priceIdForPlan,
  resolveStripeClient,
  stripePriceIdsFromConfig,
} from "@/lib/stripe";
import {
  getSubscriptionByUserId,
  mapStripeSubscription,
  syncSubscriptionFromStripe,
} from "@/lib/stripe-admin";
import { getUserById, markOnboardingCompleted } from "@/lib/users";
import { getPublicAppUrl } from "@/lib/platform-settings";
import {
  buildReactivationCheckoutParams,
  oldSubscriptionAction,
  toElementsReactivationParams,
  reactivationState,
  type ReactivationState,
} from "@/lib/reactivation-rules";
import {
  applyReactivationExtension,
  extensionMarker,
  extensionTrialEnd,
  isExtendableSubscription,
} from "@/lib/reactivation-extend";
import {
  consumeReactivationOffer,
  offerAllowsExtension,
  releaseReactivationOffer,
  markReactivationOpened,
  reactivationOfferById,
  reactivationOfferByToken,
  recordReactivationCheckout,
  type ReactivationOffer,
} from "@/lib/reactivation";
import { recordBillingEvent } from "@/lib/billing-events";
import { activeStripeCredentials } from "@/lib/stripe-config";
import { CHECKOUT_ELEMENTS_API_VERSION } from "@/lib/checkout-page";

export type ReactivationView = {
  state: ReactivationState;
  offer: ReactivationOffer | null;
  email: string | null;
  /** Member's name for the greeting (may be empty). */
  name?: string | null;
  /** state "extend": when the next payment is due now, and after the gift. */
  nextChargeAt?: string | null;
  extendedChargeAt?: string | null;
};

const unix = (iso: string | Date | null | undefined) =>
  iso ? Math.floor(new Date(iso).getTime() / 1000) : null;

/** Resolve a token to what the page should show. Marks the link opened. */
export async function loadReactivation(token: string): Promise<ReactivationView> {
  const offer = await reactivationOfferByToken(token).catch(() => null);
  if (!offer) return { state: "invalid", offer: null, email: null };
  const sub = await getSubscriptionByUserId(offer.userId);
  const subLike = sub
    ? { status: sub.status, cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end) }
    : null;
  const allowExtend =
    isExtendableSubscription(subLike) && Boolean(sub?.stripe_subscription_id)
      ? await offerAllowsExtension(offer.id).catch(() => false)
      : false;
  const state = reactivationState({ offer, subscription: subLike, allowExtend });
  if (state === "valid" || state === "extend") await markReactivationOpened(offer.id).catch(() => {});
  const user = await getUserById(offer.userId);
  const view: ReactivationView = {
    state,
    offer,
    email: user?.email ?? null,
    name: user?.name ?? null,
  };
  if (state === "extend" && sub) {
    const shape = {
      status: sub.status,
      currentPeriodEnd: unix(sub.renews_at),
      trialEnd: unix(sub.trial_ends_at),
    };
    const due = sub.status === "trialing" && shape.trialEnd ? shape.trialEnd : shape.currentPeriodEnd;
    view.nextChargeAt = due ? new Date(due * 1000).toISOString() : null;
    view.extendedChargeAt = new Date(extensionTrialEnd(shape) * 1000).toISOString();
  }
  return view;
}

export class ReactivationError extends Error {
  constructor(
    public code: ReactivationState | "not_configured" | "wrong_account" | "no_price" | "extend_failed" | "test_live",
    public status: number
  ) {
    super(code);
  }
}

/**
 * Test links (admin "Send test email") belong to a real member's account.
 * Clicking through is fine against the Stripe sandbox; in live mode it would
 * move a real customer's payment or start a real subscription, so refuse.
 */
async function refuseLiveTestOffer(offer: ReactivationOffer): Promise<void> {
  const existing = await getSubscriptionByUserId(offer.userId);
  if (existing?.stripe_livemode === true || (await activeStripeLivemode())) {
    throw new ReactivationError("test_live", 409);
  }
}

export type ReactivationCheckoutResult =
  | { kind: "redirect"; url: string; sessionId: string }
  | { kind: "elements"; clientSecret: string; publishableKey: string; sessionId: string };

/**
 * Create the 30-day-trial Checkout Session for an offer token. `ui:
 * "elements"` returns a client secret for the on-site payment form (same
 * session settings as /checkout); without a publishable key it falls back to
 * the hosted page. An "extend" offer never needs a payment form.
 */
export async function createReactivationCheckout(input: {
  token: string;
  sessionUserId?: string | null;
  ui?: "elements" | "hosted";
}): Promise<ReactivationCheckoutResult> {
  const view = await loadReactivation(input.token);
  if (view.offer?.isTest && (view.state === "extend" || view.state === "valid")) {
    await refuseLiveTestOffer(view.offer);
  }
  if (view.state === "extend" && view.offer) {
    // Still paying: no checkout, the next 30 days are added to the plan.
    if (input.sessionUserId && input.sessionUserId !== view.offer.userId) {
      throw new ReactivationError("wrong_account", 403);
    }
    await redeemReactivationExtension(view.offer);
    const base = (await getPublicAppUrl()).replace(/\/+$/, "");
    return {
      kind: "redirect",
      url: `${base}/reactivate?token=${encodeURIComponent(input.token)}&status=extended`,
      sessionId: "",
    };
  }
  if (view.state !== "valid" || !view.offer) {
    throw new ReactivationError(view.state, view.state === "invalid" ? 404 : 409);
  }
  const offer = view.offer;
  if (input.sessionUserId && input.sessionUserId !== offer.userId) {
    throw new ReactivationError("wrong_account", 403);
  }
  const user = await getUserById(offer.userId);
  if (!user) throw new ReactivationError("invalid", 404);

  const stripe = await getStripe();
  if (!stripe) throw new ReactivationError("not_configured", 503);
  const priceId = await priceIdForPlan(offer.plan);
  if (!priceId) throw new ReactivationError("no_price", 503);

  const activeLivemode = await activeStripeLivemode();
  const existing = await getSubscriptionByUserId(user.id);
  const storedLivemode = existing?.stripe_livemode ?? null;

  // Reuse the customer (card on file, invoice history) when it lives on the
  // Stripe account Checkout runs on; otherwise make one there.
  let customerId: string | null = null;
  if (existing?.stripe_customer_id) {
    if (typeof storedLivemode === "boolean") {
      if (storedLivemode === activeLivemode) customerId = existing.stripe_customer_id;
    } else {
      const resolved = await resolveStripeClient({ objectId: existing.stripe_customer_id });
      if (resolved && resolved.livemode === activeLivemode) customerId = existing.stripe_customer_id;
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await syncSubscriptionFromStripe({
      userId: user.id,
      plan: existing?.plan ?? "free",
      status: existing?.status ?? "incomplete",
      amountCents: existing?.amount_cents ?? 0,
      currency: existing?.currency ?? "USD",
      accessTier: existing?.access_tier ?? "none",
      stripeCustomerId: customerId,
      stripeSubscriptionId:
        storedLivemode === activeLivemode ? existing?.stripe_subscription_id : null,
      stripeLivemode: activeLivemode,
    });
  }

  const sameEnvOldSub =
    existing?.stripe_subscription_id &&
    (storedLivemode === null || storedLivemode === activeLivemode)
      ? existing.stripe_subscription_id
      : null;

  const params = buildReactivationCheckoutParams({
    userId: user.id,
    email: user.email,
    plan: offer.plan,
    priceId,
    customerId,
    offerId: offer.id,
    token: input.token,
    baseUrl: await getPublicAppUrl(),
  });
  const publishableKey =
    input.ui === "elements"
      ? activeStripeCredentials(await getStripeConfig()).publishableKey.trim()
      : "";
  const session = publishableKey
    ? await stripe.checkout.sessions.create(toElementsReactivationParams(params), {
        apiVersion: CHECKOUT_ELEMENTS_API_VERSION,
      })
    : await stripe.checkout.sessions.create(params);
  await recordReactivationCheckout({
    id: offer.id,
    checkoutSessionId: session.id,
    oldSubscriptionId: sameEnvOldSub,
    oldStatus: existing?.status ?? null,
  });
  if (publishableKey) {
    if (!session.client_secret) throw new ReactivationError("not_configured", 500);
    return {
      kind: "elements",
      clientSecret: session.client_secret,
      publishableKey,
      sessionId: session.id,
    };
  }
  if (!session.url) throw new ReactivationError("not_configured", 500);
  return { kind: "redirect", url: session.url, sessionId: session.id };
}

type CheckoutSessionLike = {
  id: string;
  status?: string | null;
  mode?: string | null;
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  subscription?: string | Stripe.Subscription | null;
  metadata?: Stripe.Metadata | null;
};

export type FinalizeResult =
  | { ok: false; reason: "not_reactivation" | "not_complete" | "offer_missing" | "no_subscription" }
  | {
      ok: true;
      claimed: boolean;
      userId: string;
      subscriptionId: string;
      trialEnd: number | null;
      oldSubscriptionCanceled: string | null;
    };

/**
 * Finish a completed reactivation Checkout: sync the new trial (full access),
 * consume the offer, and retire the old subscription. Safe to call twice.
 */
export async function finalizeReactivationCheckout(input: {
  stripe: Stripe;
  session: CheckoutSessionLike;
  livemode: boolean;
  eventCreatedAt?: number | null;
  stripeEventId?: string | null;
}): Promise<FinalizeResult> {
  const offerId = input.session.metadata?.reactivation_offer_id;
  if (!offerId) return { ok: false, reason: "not_reactivation" };
  if (input.session.status && input.session.status !== "complete") {
    return { ok: false, reason: "not_complete" };
  }
  const offer = await reactivationOfferById(offerId);
  if (!offer) return { ok: false, reason: "offer_missing" };
  const subId =
    typeof input.session.subscription === "string"
      ? input.session.subscription
      : input.session.subscription?.id;
  if (!subId) return { ok: false, reason: "no_subscription" };

  const cfg = await getStripeConfig();
  const priceIds = stripePriceIdsFromConfig(input.livemode ? cfg.live : cfg.sandbox);
  const sub = await input.stripe.subscriptions.retrieve(subId);
  const mapped = mapStripeSubscription(sub, priceIds);
  await syncSubscriptionFromStripe({
    userId: offer.userId,
    ...mapped,
    stripeLivemode: input.livemode,
    eventCreatedAt: input.eventCreatedAt ?? null,
  });
  await markOnboardingCompleted(offer.userId);

  const { claimed } = await consumeReactivationOffer({
    id: offer.id,
    checkoutSessionId: input.session.id,
    newSubscriptionId: subId,
  });

  let oldSubscriptionCanceled: string | null = null;
  const oldId = offer.oldSubscriptionId;
  if (claimed && oldId && oldId !== subId) {
    try {
      const old = await input.stripe.subscriptions.retrieve(oldId);
      if (oldSubscriptionAction(old.status) === "cancel_and_void") {
        await input.stripe.subscriptions.cancel(oldId, { invoice_now: false, prorate: false });
        const open = await input.stripe.invoices.list({ subscription: oldId, status: "open", limit: 20 });
        for (const inv of open.data) {
          if (inv.id) await input.stripe.invoices.voidInvoice(inv.id);
        }
        oldSubscriptionCanceled = oldId;
      }
    } catch (err) {
      console.error("[reactivation] retire old subscription", oldId, err);
    }
  }

  if (claimed) {
    await recordBillingEvent({
      userId: offer.userId,
      stripeEventId: `reactivation:${input.session.id}`,
      eventType: "reactivation.trial_started",
      status: "checkout",
      amountCents: 0,
      currency: mapped.currency,
      description: `Win-back trial (30 days) - ${mapped.plan}`,
      subscriptionId: subId,
      livemode: input.livemode,
      occurredAt: input.eventCreatedAt ?? Math.floor(Date.now() / 1000),
    }).catch((err) => console.error("[reactivation] billing event", err));
  }

  return {
    ok: true,
    claimed,
    userId: offer.userId,
    subscriptionId: subId,
    trialEnd: sub.trial_end ?? null,
    oldSubscriptionCanceled,
  };
}

/** Success page: confirm with Stripe directly (works before the webhook). */
export async function finalizeFromSuccessRedirect(input: {
  token: string;
  sessionId: string;
}): Promise<FinalizeResult | null> {
  const offer = await reactivationOfferByToken(input.token);
  if (!offer || !input.sessionId.startsWith("cs_")) return null;
  const resolved = await resolveStripeClient({ objectId: input.sessionId });
  if (!resolved) return null;
  const session = await resolved.stripe.checkout.sessions.retrieve(input.sessionId);
  if (session.metadata?.reactivation_offer_id !== offer.id) return null;
  return finalizeReactivationCheckout({
    stripe: resolved.stripe,
    session,
    livemode: resolved.livemode,
  });
}

/**
 * Redeem a problem-report win-back for someone still paying: claim the offer
 * (one redemption per person, atomic), then move the next payment of the
 * existing subscription 30 days later (lib/reactivation-extend.ts). If the
 * Stripe step fails the claim is released so the link still works.
 */
export async function redeemReactivationExtension(
  offer: ReactivationOffer
): Promise<{ trialEnd: number; subscriptionId: string }> {
  const existing = await getSubscriptionByUserId(offer.userId);
  const subId = existing?.stripe_subscription_id;
  if (!subId) throw new ReactivationError("already_active", 409);
  const resolved = await resolveStripeClient({
    livemode: existing?.stripe_livemode ?? null,
    objectId: subId,
  });
  if (!resolved) throw new ReactivationError("not_configured", 503);

  const marker = extensionMarker(subId);
  const { claimed } = await consumeReactivationOffer({
    id: offer.id,
    checkoutSessionId: marker,
    newSubscriptionId: subId,
  });
  if (!claimed) throw new ReactivationError("used", 409);

  try {
    const result = await applyReactivationExtension({
      stripe: resolved.stripe,
      subscriptionId: subId,
      offerId: offer.id,
    });
    if (!result.ok) {
      await releaseReactivationOffer(offer.id, marker);
      throw new ReactivationError("extend_failed", 409);
    }
    const cfg = await getStripeConfig();
    const priceIds = stripePriceIdsFromConfig(resolved.livemode ? cfg.live : cfg.sandbox);
    const mapped = mapStripeSubscription(
      result.subscription as unknown as Parameters<typeof mapStripeSubscription>[0],
      priceIds
    );
    await syncSubscriptionFromStripe({
      userId: offer.userId,
      ...mapped,
      stripeLivemode: resolved.livemode,
    });
    if (!result.alreadyApplied) {
      await recordBillingEvent({
        userId: offer.userId,
        stripeEventId: `reactivation-extend:${offer.id}`,
        eventType: "reactivation.extended",
        status: "trial_started",
        amountCents: 0,
        currency: mapped.currency,
        description: `Win-back: next payment moved 30 days (${mapped.plan})`,
        subscriptionId: subId,
        livemode: resolved.livemode,
        occurredAt: Math.floor(Date.now() / 1000),
      }).catch((err) => console.error("[reactivation] billing event", err));
    }
    return { trialEnd: result.trialEnd, subscriptionId: subId };
  } catch (err) {
    if (err instanceof ReactivationError) throw err;
    console.error("[reactivation] extend failed", offer.id, err);
    await releaseReactivationOffer(offer.id, marker).catch(() => {});
    throw new ReactivationError("extend_failed", 502);
  }
}
