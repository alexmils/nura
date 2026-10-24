/**
 * Win-back reactivation offers: storage and the admin candidate list.
 * Rules (token, state, checkout params) are in lib/reactivation-rules.ts.
 */
import { randomUUID } from "crypto";
import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  hashReactivationToken,
  isPlausibleReactivationToken,
  isReactivationCandidate,
  newReactivationToken,
  previousPlan,
  reactivationExpiry,
  reactivationLinkStatus,
  offerSourceAllowsExtension,
  type ReactivationLinkStatus,
  type ReactivationOfferSource,
} from "@/lib/reactivation-rules";
import type { BillingPlanId } from "@/lib/billing-constants";
import { getStripeConfig, stripePriceIdsFromConfig } from "@/lib/stripe";
import { sqlRowCountsInStats } from "@/lib/stats-scope";

export type ReactivationOffer = {
  id: string;
  userId: string;
  plan: BillingPlanId;
  createdAt: string;
  expiresAt: string;
  sentAt: string | null;
  openedAt: string | null;
  checkoutSessionId: string | null;
  usedAt: string | null;
  newSubscriptionId: string | null;
  oldSubscriptionId: string | null;
  oldStatus: string | null;
};

type OfferRow = {
  id: string;
  user_id: string;
  plan: string;
  created_at: Date;
  expires_at: Date;
  sent_at: Date | null;
  opened_at: Date | null;
  checkout_session_id: string | null;
  used_at: Date | null;
  new_subscription_id: string | null;
  old_subscription_id: string | null;
  old_status: string | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

function rowToOffer(r: OfferRow): ReactivationOffer {
  return {
    id: r.id,
    userId: r.user_id,
    plan: r.plan as BillingPlanId,
    createdAt: new Date(r.created_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
    sentAt: iso(r.sent_at),
    openedAt: iso(r.opened_at),
    checkoutSessionId: r.checkout_session_id,
    usedAt: iso(r.used_at),
    newSubscriptionId: r.new_subscription_id,
    oldSubscriptionId: r.old_subscription_id,
    oldStatus: r.old_status,
  };
}

/** The plan a user had before, judged against the Stripe env that billed it. */
export async function previousPlanForUser(userId: string): Promise<BillingPlanId> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    plan: string | null;
    stripe_price_id: string | null;
    stripe_livemode: boolean | null;
  }>(
    `SELECT plan, stripe_price_id, stripe_livemode FROM subscriptions WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  const cfg = await getStripeConfig();
  const creds = row?.stripe_livemode === true ? cfg.live : row?.stripe_livemode === false ? cfg.sandbox : cfg;
  return previousPlan(
    { stripePriceId: row?.stripe_price_id, plan: row?.plan },
    stripePriceIdsFromConfig(creds)
  );
}

/**
 * Mint a link. One open offer per user: a new link replaces the unused old
 * one, so re-sending is safe. Used offers are kept for the admin status.
 */
export async function createReactivationOffer(input: {
  userId: string;
  createdBy: string | null;
  /** Who minted it; null/"winback_tab" keeps the original rules. */
  source?: ReactivationOfferSource | null;
  now?: Date;
}): Promise<{ token: string; offer: ReactivationOffer }> {
  await ensureSchemaReady();
  const pool = getPool();
  const token = newReactivationToken();
  const plan = await previousPlanForUser(input.userId);
  const expiresAt = reactivationExpiry(input.now);
  await pool.query(
    `DELETE FROM reactivation_offers WHERE user_id = $1 AND used_at IS NULL`,
    [input.userId]
  );
  const { rows } = await pool.query<OfferRow>(
    `INSERT INTO reactivation_offers (id, user_id, token_hash, plan, created_by, expires_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [randomUUID(), input.userId, hashReactivationToken(token), plan, input.createdBy, expiresAt, input.source ?? null]
  );
  return { token, offer: rowToOffer(rows[0]) };
}

export async function reactivationOfferByToken(
  raw: string | null | undefined
): Promise<ReactivationOffer | null> {
  if (!isPlausibleReactivationToken(raw)) return null;
  await ensureSchemaReady();
  const { rows } = await getPool().query<OfferRow>(
    `SELECT * FROM reactivation_offers WHERE token_hash = $1`,
    [hashReactivationToken(raw)]
  );
  return rows[0] ? rowToOffer(rows[0]) : null;
}

export async function reactivationOfferById(id: string): Promise<ReactivationOffer | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<OfferRow>(
    `SELECT * FROM reactivation_offers WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToOffer(rows[0]) : null;
}

export async function markReactivationOpened(id: string): Promise<void> {
  await getPool().query(
    `UPDATE reactivation_offers SET opened_at = COALESCE(opened_at, NOW()) WHERE id = $1`,
    [id]
  );
}

export async function markReactivationSent(id: string): Promise<void> {
  await ensureSchemaReady();
  await getPool().query(
    `UPDATE reactivation_offers SET sent_at = COALESCE(sent_at, NOW()) WHERE id = $1`,
    [id]
  );
}

export async function recordReactivationCheckout(input: {
  id: string;
  checkoutSessionId: string;
  oldSubscriptionId: string | null;
  oldStatus: string | null;
}): Promise<void> {
  await getPool().query(
    `UPDATE reactivation_offers
     SET checkout_session_id = $2, old_subscription_id = $3, old_status = $4
     WHERE id = $1 AND used_at IS NULL`,
    [input.id, input.checkoutSessionId, input.oldSubscriptionId, input.oldStatus]
  );
}

/**
 * Consume the offer. Atomic: only the first caller (webhook or success page,
 * whichever lands first) gets `claimed: true`; the link is dead after that.
 */
export async function consumeReactivationOffer(input: {
  id: string;
  checkoutSessionId: string;
  newSubscriptionId: string;
}): Promise<{ claimed: boolean; offer: ReactivationOffer | null }> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<OfferRow>(
    `UPDATE reactivation_offers
     SET used_at = NOW(), checkout_session_id = $2, new_subscription_id = $3
     WHERE id = $1 AND used_at IS NULL
     RETURNING *`,
    [input.id, input.checkoutSessionId, input.newSubscriptionId]
  );
  if (rows[0]) return { claimed: true, offer: rowToOffer(rows[0]) };
  return { claimed: false, offer: await reactivationOfferById(input.id) };
}

/**
 * Links minted from a problem report or the admin single-user page may
 * extend a paying subscription (lib/reactivation-extend.ts). Win-back tab
 * links keep the original "already active" rule.
 */
export async function offerAllowsExtension(offerId: string): Promise<boolean> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ source: string | null; from_report: boolean }>(
    `SELECT o.source,
            EXISTS (SELECT 1 FROM problem_reports pr WHERE pr.reactivation_offer_id = o.id) AS from_report
     FROM reactivation_offers o WHERE o.id = $1`,
    [offerId]
  );
  const row = rows[0];
  return Boolean(row && (row.from_report || offerSourceAllowsExtension(row.source)));
}

/** Undo a claim whose Stripe step failed, so the person can try again. */
export async function releaseReactivationOffer(id: string, checkoutSessionId: string): Promise<void> {
  await getPool().query(
    `UPDATE reactivation_offers
     SET used_at = NULL, checkout_session_id = NULL, new_subscription_id = NULL
     WHERE id = $1 AND checkout_session_id = $2`,
    [id, checkoutSessionId]
  );
}

export type ReactivationCandidate = {
  userId: string;
  email: string;
  name: string | null;
  status: string | null;
  plan: BillingPlanId;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  guidedThreads: number;
  guidedMessages: number;
  guidedSessionsUsed: number;
  linkStatus: ReactivationLinkStatus;
  offer: ReactivationOffer | null;
};

/** Users the stuck-ball bug cost: guided mode, zero sets, no longer paying. */
export async function listReactivationCandidates(now = new Date()): Promise<ReactivationCandidate[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string | null;
    access_tier: string | null;
    cancel_at_period_end: boolean | null;
    trial_ends_at: Date | null;
    guided_threads: string;
    guided_messages: string;
    total_sets: string;
    guided_sessions_used: number | null;
  }>(
    `SELECT u.id, u.email, u.name, u.role,
            s.status, s.access_tier, s.cancel_at_period_end, s.trial_ends_at,
            COALESCE(g.guided_threads, 0) AS guided_threads,
            COALESCE(g.guided_messages, 0) AS guided_messages,
            COALESCE(g.total_sets, 0) AS total_sets,
            tu.guided_sessions_used
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN trial_usage tu ON tu.user_id = u.id
     LEFT JOIN (
       SELECT t.user_id,
              COUNT(DISTINCT t.id) AS guided_threads,
              COUNT(m.id) FILTER (WHERE m.role = 'user') AS guided_messages,
              COALESCE(MAX(t.set_count), 0) AS total_sets
       FROM threads t
       LEFT JOIN messages m ON m.thread_id = t.id
       WHERE t.mode = 'guided'
       GROUP BY t.user_id
     ) g ON g.user_id = u.id
     WHERE u.role = 'user'
       AND (COALESCE(g.guided_threads, 0) > 0 OR COALESCE(tu.guided_sessions_used, 0) > 0)
       AND ${sqlRowCountsInStats("u.id")}
     ORDER BY u.created_at DESC`
  );
  // Someone who already redeemed a link stays listed (status "used") even
  // though their new trial makes them no longer a candidate.
  const { rows: offered } = await getPool().query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM reactivation_offers`
  );
  const hasOffer = new Set(offered.map((o) => o.user_id));
  const candidates = rows.filter((r) =>
    hasOffer.has(r.id) ||
    isReactivationCandidate({
      role: r.role,
      guidedThreads: Number(r.guided_threads),
      guidedSessionsUsed: Number(r.guided_sessions_used ?? 0),
      totalGuidedSets: Number(r.total_sets),
      status: r.status,
      accessTier: r.access_tier,
      cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
      trialEndsAt: r.trial_ends_at,
      now,
    })
  );
  if (candidates.length === 0) return [];
  const ids = candidates.map((c) => c.id);
  const { rows: offerRows } = await getPool().query<OfferRow>(
    `SELECT DISTINCT ON (user_id) * FROM reactivation_offers
     WHERE user_id = ANY($1) ORDER BY user_id, created_at DESC`,
    [ids]
  );
  const byUser = new Map(offerRows.map((o) => [o.user_id, rowToOffer(o)]));
  const out: ReactivationCandidate[] = [];
  for (const c of candidates) {
    const offer = byUser.get(c.id) ?? null;
    out.push({
      userId: c.id,
      email: c.email,
      name: c.name,
      status: c.status,
      plan: offer?.plan ?? (await previousPlanForUser(c.id)),
      cancelAtPeriodEnd: Boolean(c.cancel_at_period_end),
      trialEndsAt: iso(c.trial_ends_at),
      guidedThreads: Number(c.guided_threads),
      guidedMessages: Number(c.guided_messages),
      guidedSessionsUsed: Number(c.guided_sessions_used ?? 0),
      linkStatus: reactivationLinkStatus(offer, now),
      offer,
    });
  }
  return out;
}
