/**
 * Win-back for someone who is still paying (only for links generated from a
 * confirmed problem report, see lib/problem-reports.ts).
 *
 * Mechanism: push the next billing date of the EXISTING Stripe subscription
 * back by 30 days by setting `trial_end` with `proration_behavior: "none"`.
 *   - No checkout, no new subscription, no card prompt.
 *   - No double charge: the period they already paid for is kept, and the
 *     next invoice simply lands 30 days later (the billing cycle restarts at
 *     the new date). No proration credit or charge is created.
 *   - Works the same for monthly, yearly and someone still in a trial.
 *   - Entitlements: Stripe reports the subscription as "trialing" until the
 *     new date; metadata nura_trial_kind = "reactivation" (synced by the
 *     webhook into subscriptions.trial_kind) gives full access, no trial caps.
 *
 * A coupon (100% off once) would give a free YEAR on a yearly plan, and a
 * balance credit is plan-priced rather than "30 days", so neither was used.
 *
 * No DB access here so tests can pin it with a mocked Stripe client.
 */
import type Stripe from "stripe";
import { REACTIVATION_TRIAL_DAYS, REACTIVATION_TRIAL_KIND } from "./reactivation-rules";

const DAY_S = 24 * 60 * 60;
/** Stripe refuses trial_end more than 730 days out. */
const MAX_TRIAL_AHEAD_S = 730 * DAY_S;

/** Marker stored as the offer's checkout_session_id when it was redeemed this way. */
export const REACTIVATION_EXTEND_PREFIX = "extend:";

export function extensionMarker(subscriptionId: string): string {
  return `${REACTIVATION_EXTEND_PREFIX}${subscriptionId}`;
}

export function isExtensionMarker(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(REACTIVATION_EXTEND_PREFIX);
}

export type ExtendableSubscription = {
  status?: string | null;
  cancelAtPeriodEnd?: boolean | null;
};

/** A paying (or trialing) subscription that is not scheduled to cancel. */
export function isExtendableSubscription(sub: ExtendableSubscription | null | undefined): boolean {
  if (!sub) return false;
  return (sub.status === "active" || sub.status === "trialing") && !sub.cancelAtPeriodEnd;
}

/**
 * New trial_end (unix seconds): 30 days after the date the next payment was
 * due (trial end while trialing, otherwise the current period end), never
 * earlier than 30 days from now.
 */
export function extensionTrialEnd(
  input: {
    status?: string | null;
    currentPeriodEnd?: number | null;
    trialEnd?: number | null;
  },
  now: Date = new Date(),
  days: number = REACTIVATION_TRIAL_DAYS
): number {
  const nowS = Math.floor(now.getTime() / 1000);
  const due =
    input.status === "trialing" && input.trialEnd
      ? input.trialEnd
      : input.currentPeriodEnd ?? nowS;
  const base = Math.max(due, nowS);
  return Math.min(base + days * DAY_S, nowS + MAX_TRIAL_AHEAD_S);
}

/** Date the next payment was going to happen (unix seconds), for the page. */
export function currentNextChargeUnix(input: {
  status?: string | null;
  currentPeriodEnd?: number | null;
  trialEnd?: number | null;
}): number | null {
  if (input.status === "trialing" && input.trialEnd) return input.trialEnd;
  return input.currentPeriodEnd ?? null;
}

export function buildReactivationExtendParams(input: {
  offerId: string;
  trialEnd: number;
  now?: Date;
}): Stripe.SubscriptionUpdateParams {
  return {
    trial_end: input.trialEnd,
    proration_behavior: "none",
    metadata: {
      nura_trial_kind: REACTIVATION_TRIAL_KIND,
      reactivation_offer_id: input.offerId,
      nura_reactivation_extended_at: (input.now ?? new Date()).toISOString(),
    },
  };
}

type SubLike = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  metadata?: Record<string, string> | null;
};

export type StripeSubscriptionsLike = {
  subscriptions: {
    retrieve(id: string): Promise<SubLike>;
    update(
      id: string,
      params: Stripe.SubscriptionUpdateParams,
      options?: { idempotencyKey?: string }
    ): Promise<SubLike>;
  };
};

export type ExtendResult =
  | { ok: true; subscription: SubLike; trialEnd: number; alreadyApplied: boolean; previousChargeAt: number | null }
  | { ok: false; reason: "not_extendable"; status: string };

/**
 * Apply the 30 free days to the live subscription. Idempotent: if this offer
 * was already applied (metadata says so) nothing is changed again, and the
 * Stripe idempotency key stops a retried request from extending twice.
 */
export async function applyReactivationExtension(input: {
  stripe: StripeSubscriptionsLike;
  subscriptionId: string;
  offerId: string;
  now?: Date;
}): Promise<ExtendResult> {
  const sub = await input.stripe.subscriptions.retrieve(input.subscriptionId);
  if (sub.metadata?.reactivation_offer_id === input.offerId && sub.metadata?.nura_reactivation_extended_at) {
    return {
      ok: true,
      subscription: sub,
      trialEnd: sub.trial_end ?? extensionTrialEnd({ status: sub.status, currentPeriodEnd: sub.current_period_end }, input.now),
      alreadyApplied: true,
      previousChargeAt: null,
    };
  }
  if (!isExtendableSubscription({ status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end })) {
    return { ok: false, reason: "not_extendable", status: sub.status };
  }
  const previousChargeAt = currentNextChargeUnix({
    status: sub.status,
    currentPeriodEnd: sub.current_period_end,
    trialEnd: sub.trial_end,
  });
  const trialEnd = extensionTrialEnd(
    { status: sub.status, currentPeriodEnd: sub.current_period_end, trialEnd: sub.trial_end },
    input.now
  );
  const updated = await input.stripe.subscriptions.update(
    sub.id,
    buildReactivationExtendParams({ offerId: input.offerId, trialEnd, now: input.now }),
    { idempotencyKey: `reactivation-extend:${input.offerId}` }
  );
  return { ok: true, subscription: updated, trialEnd, alreadyApplied: false, previousChargeAt };
}
