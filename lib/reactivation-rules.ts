/**
 * Win-back reactivation: pure rules (no DB, no Stripe client) so tests can pin
 * them. DB access lives in lib/reactivation.ts, the Stripe side effects in
 * lib/reactivation-stripe.ts.
 *
 * Token design: a random 256-bit token lives only in the link; the database
 * keeps its SHA-256 hash (same pattern as review invites). Single use, expiry
 * and "sent/used" status need state anyway, so a stateless HMAC token would
 * still need a used-marker table. A row per offer gives revocation (a new link
 * replaces the old unused one) and admin status for free, and needs no new
 * signing secret.
 */
import { createHash, randomBytes } from "crypto";
import type Stripe from "stripe";
import {
  isBillingPlanId,
  planIdFromStripePriceId,
  type BillingPlanId,
  type StripePriceIds,
} from "./billing-constants";

export const REACTIVATION_TRIAL_DAYS = 30;
export const REACTIVATION_LINK_DAYS = 30;
export const REACTIVATION_TRIAL_KIND = "reactivation";
export const REACTIVATION_PATH = "/reactivate";

const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newReactivationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReactivationToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function isPlausibleReactivationToken(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = value.trim();
  return (
    t.length >= MIN_TOKEN_LENGTH &&
    t.length <= MAX_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(t)
  );
}

export function reactivationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REACTIVATION_LINK_DAYS * DAY_MS);
}

export function reactivationLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${REACTIVATION_PATH}?token=${encodeURIComponent(token)}`;
}

export type ReactivationOfferLike = {
  expiresAt: string | Date;
  usedAt: string | Date | null;
};

export type ReactivationSubLike = {
  status?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  trialKind?: string | null;
};

export type ReactivationState =
  | "invalid"
  | "used"
  | "expired"
  | "already_active"
  | "valid";

/** What the /reactivate page shows for a token. */
export function reactivationState(input: {
  offer: ReactivationOfferLike | null;
  subscription?: ReactivationSubLike | null;
  now?: Date;
}): ReactivationState {
  const { offer } = input;
  if (!offer) return "invalid";
  if (offer.usedAt) return "used";
  const now = (input.now ?? new Date()).getTime();
  if (new Date(offer.expiresAt).getTime() <= now) return "expired";
  const sub = input.subscription;
  // Someone who already pays (and is not leaving) must not be handed a free
  // month on top. A scheduled cancel is exactly the win-back case, so it stays.
  if (
    sub &&
    (sub.status === "active" || sub.status === "trialing") &&
    !sub.cancelAtPeriodEnd
  ) {
    return "already_active";
  }
  return "valid";
}

/** The plan the person had before; yearly (the site default) when unknown. */
export function previousPlan(
  input: { stripePriceId?: string | null; plan?: string | null },
  priceIds: StripePriceIds
): BillingPlanId {
  const fromPrice = planIdFromStripePriceId(input.stripePriceId ?? null, priceIds);
  if (isBillingPlanId(fromPrice)) return fromPrice;
  if (isBillingPlanId(input.plan)) return input.plan;
  return "yearly";
}

/**
 * What happens to the old Stripe subscription once the new trial checkout
 * completes. A past_due / unpaid / incomplete subscription would keep dunning
 * the card and its later events could overwrite the new trial, so it is
 * cancelled and its open invoices voided (the debt is forgiven, that is the
 * offer). A trial or plan with a scheduled cancel is cancelled too: the new
 * 30-day trial replaces it. A canceled one is left alone.
 */
export type OldSubscriptionAction = "none" | "cancel_and_void";

export function oldSubscriptionAction(status: string | null | undefined): OldSubscriptionAction {
  switch (status) {
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "trialing":
    case "active":
      return "cancel_and_void";
    default:
      return "none";
  }
}

export function buildReactivationCheckoutParams(input: {
  userId: string;
  email: string;
  plan: BillingPlanId;
  priceId: string;
  customerId: string;
  offerId: string;
  token: string;
  baseUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const base = input.baseUrl.replace(/\/+$/, "");
  const t = encodeURIComponent(input.token);
  return {
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.userId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${base}${REACTIVATION_PATH}?token=${t}&status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${REACTIVATION_PATH}?token=${t}&status=canceled`,
    payment_method_collection: "always",
    allow_promotion_codes: false,
    subscription_data: {
      trial_period_days: REACTIVATION_TRIAL_DAYS,
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      metadata: {
        user_id: input.userId,
        user_email: input.email,
        plan: input.plan,
        nura_trial_kind: REACTIVATION_TRIAL_KIND,
        reactivation_offer_id: input.offerId,
      },
    },
    metadata: {
      user_id: input.userId,
      plan: input.plan,
      reactivation_offer_id: input.offerId,
    },
  };
}

/** First charge date the page and the report show: now + 30 days. */
export function firstChargeDate(trialEndUnix: number | null | undefined, now = new Date()): Date {
  if (trialEndUnix && Number.isFinite(trialEndUnix)) return new Date(trialEndUnix * 1000);
  return new Date(now.getTime() + REACTIVATION_TRIAL_DAYS * DAY_MS);
}

/**
 * Who gets offered a win-back link: used guided mode but never got a single
 * set to run (the stuck-interpreter bug), and is no longer paying: canceled,
 * past due, unpaid, incomplete, a trial that ended, or a scheduled cancel.
 */
export function isReactivationCandidate(input: {
  role: string;
  guidedThreads: number;
  guidedSessionsUsed: number;
  totalGuidedSets: number;
  status: string | null;
  accessTier?: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | Date | null;
  now?: Date;
}): boolean {
  if (input.role !== "user") return false;
  const usedGuided = input.guidedThreads > 0 || input.guidedSessionsUsed > 0;
  if (!usedGuided || input.totalGuidedSets > 0) return false;
  const now = (input.now ?? new Date()).getTime();
  const status = input.status ?? "none";
  if (["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired"].includes(status)) {
    return true;
  }
  if ((status === "trialing" || status === "active") && input.cancelAtPeriodEnd) return true;
  if (status === "trialing" && input.trialEndsAt && new Date(input.trialEndsAt).getTime() < now) {
    return true;
  }
  if (input.accessTier === "blocked") return true;
  return false;
}

export type ReactivationLinkStatus = "none" | "generated" | "sent" | "opened" | "used" | "expired";

export function reactivationLinkStatus(
  offer: {
    createdAt: string | Date;
    expiresAt: string | Date;
    sentAt: string | Date | null;
    openedAt: string | Date | null;
    usedAt: string | Date | null;
  } | null,
  now = new Date()
): ReactivationLinkStatus {
  if (!offer) return "none";
  if (offer.usedAt) return "used";
  if (new Date(offer.expiresAt).getTime() <= now.getTime()) return "expired";
  if (offer.openedAt) return "opened";
  if (offer.sentAt) return "sent";
  return "generated";
}
