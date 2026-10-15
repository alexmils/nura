import type Stripe from "stripe";
import { ensureSchemaReady, getPool } from "@/lib/db";
import type { SubscriptionCancelReasonId } from "@/lib/subscription-cancel-reasons";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";
import { resolveStripeClient } from "@/lib/stripe";
import {
  mapStripeSubscriptionWithConfig,
  syncSubscriptionFromStripe,
} from "@/lib/stripe-admin";
import {
  RETENTION_DISCOUNT_PERCENT,
  RETENTION_ELIGIBLE_PLAN,
  retentionReasonsEligible,
  type RetentionAction,
  type RetentionOfferStats,
} from "@/lib/subscription-retention-shared";

export {
  RETENTION_DISCOUNT_PERCENT,
  RETENTION_ELIGIBLE_PLAN,
  RETENTION_TRIGGER_REASON,
  retentionReasonsEligible,
  halfDisplayPrice,
  retentionOfferCopy,
  defaultMonthlyDisplayPrice,
  formatRetentionActionLabel,
  type RetentionAction,
  type RetentionOfferStats,
} from "@/lib/subscription-retention-shared";

const COUPON_ID = "nura_retention_monthly_50_once";

export async function userAcceptedRetentionBefore(
  userId: string
): Promise<boolean> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM subscription_retention_events
     WHERE user_id = $1 AND action = 'accepted'
     LIMIT 1`,
    [userId]
  );
  return Boolean(rows[0]);
}

export async function retentionOfferEligible(input: {
  userId: string;
  plan: string;
  reasonIds: SubscriptionCancelReasonId[];
}): Promise<boolean> {
  if (input.plan !== RETENTION_ELIGIBLE_PLAN) return false;
  if (!retentionReasonsEligible(input.reasonIds)) return false;
  if (await userAcceptedRetentionBefore(input.userId)) return false;
  const sub = await getSubscriptionByUserId(input.userId);
  if (!sub?.stripe_subscription_id) return false;
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  return true;
}

export async function recordRetentionEvent(input: {
  userId: string;
  stripeSubscriptionId: string | null;
  plan: string;
  action: RetentionAction;
  reasonIds?: string[];
  comment?: string | null;
}): Promise<void> {
  await ensureSchemaReady();
  await getPool().query(
    `INSERT INTO subscription_retention_events (
       id, user_id, stripe_subscription_id, plan, action, reason_ids, comment, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [
      crypto.randomUUID(),
      input.userId,
      input.stripeSubscriptionId,
      input.plan,
      input.action,
      input.reasonIds ?? [],
      input.comment?.trim() || null,
    ]
  );
}

async function ensureRetentionCoupon(stripe: Stripe): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(COUPON_ID);
    if (existing.valid) return COUPON_ID;
  } catch {
    /* create below */
  }
  await stripe.coupons.create({
    id: COUPON_ID,
    percent_off: RETENTION_DISCOUNT_PERCENT,
    duration: "once",
    name: "Nura retention 50% off one month",
  });
  return COUPON_ID;
}

export async function applyRetentionDiscount(input: {
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sub = await getSubscriptionByUserId(input.userId);
  if (!sub?.stripe_subscription_id) {
    return { ok: false, error: "No subscription" };
  }
  if (sub.plan !== RETENTION_ELIGIBLE_PLAN) {
    return { ok: false, error: "Offer is for monthly plans only" };
  }
  if (await userAcceptedRetentionBefore(input.userId)) {
    return { ok: false, error: "Offer already used" };
  }

  const resolved = await resolveStripeClient({
    livemode: sub.stripe_livemode,
    objectId: sub.stripe_subscription_id,
  });
  if (!resolved) {
    return { ok: false, error: "Billing is not configured" };
  }

  try {
    const couponId = await ensureRetentionCoupon(resolved.stripe);
    const current = await resolved.stripe.subscriptions.retrieve(
      sub.stripe_subscription_id
    );
    const updated = await resolved.stripe.subscriptions.update(
      sub.stripe_subscription_id,
      {
        cancel_at_period_end: false,
        discounts: [{ coupon: couponId }],
        metadata: {
          ...(current.metadata ?? {}),
          retention_50_applied: "1",
        },
      }
    );
    const mapped = await mapStripeSubscriptionWithConfig(
      updated,
      resolved.livemode
    );
    await syncSubscriptionFromStripe({
      userId: input.userId,
      ...mapped,
      stripeLivemode: resolved.livemode,
      eventCreatedAt:
        typeof updated.created === "number" ? updated.created : undefined,
    });
    return { ok: true };
  } catch (err) {
    console.error("[retention] apply coupon", err);
    return { ok: false, error: "Could not apply discount" };
  }
}

export async function getRetentionOfferStats(): Promise<RetentionOfferStats> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ action: string; c: number }>(
    `SELECT action, COUNT(*)::int AS c
     FROM subscription_retention_events
     WHERE plan = $1
     GROUP BY action`,
    [RETENTION_ELIGIBLE_PLAN]
  );
  const map = new Map(rows.map((r) => [r.action, r.c]));
  const offered = map.get("offered") ?? 0;
  const accepted = map.get("accepted") ?? 0;
  const declined = map.get("declined") ?? 0;
  const decided = accepted + declined;
  return {
    offered,
    accepted,
    declined,
    acceptanceRate: decided > 0 ? Math.round((accepted / decided) * 100) : null,
  };
}

export type RetentionEventRow = {
  action: RetentionAction;
  at: string;
  reasonIds: string[];
  comment: string | null;
};

export async function listRetentionEventsForUser(
  userId: string,
  limit = 10
): Promise<RetentionEventRow[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    action: string;
    reason_ids: string[];
    comment: string | null;
    created_at: string;
  }>(
    `SELECT action, reason_ids, comment, created_at
     FROM subscription_retention_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => ({
    action: r.action as RetentionAction,
    at: new Date(r.created_at).toISOString(),
    reasonIds: r.reason_ids ?? [],
    comment: r.comment,
  }));
}
