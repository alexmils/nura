import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  planIdFromStripePriceId,
  type StripePriceIds,
} from "@/lib/billing-constants";
import { getStripeConfig, stripePriceIdsFromConfig } from "@/lib/stripe";

export type SyncSubscriptionInput = {
  userId: string;
  plan: string;
  status: string;
  amountCents: number;
  currency?: string;
  renewsAt?: string | null;
  trialEndsAt?: string | null;
  accessTier?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  /** true = live Stripe account; false = test/sandbox. */
  stripeLivemode?: boolean | null;
  eventCreatedAt?: number | null;
  cancelAtPeriodEnd?: boolean;
  /** Subscription metadata nura_trial_kind, e.g. "reactivation". */
  trialKind?: string | null;
};

function accessTierForStatus(status: string, explicit?: string): string {
  if (explicit) return explicit;
  if (status === "legacy") return "legacy";
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  return "none";
}

export async function syncSubscriptionFromStripe(input: SyncSubscriptionInput) {
  await ensureSchemaReady();
  const accessTier = accessTierForStatus(input.status, input.accessTier);
  const eventAt = input.eventCreatedAt
    ? new Date(input.eventCreatedAt * 1000).toISOString()
    : null;

  // Refuse to clobber a live subscription with a different (often older) sub id.
  {
    const { rows } = await getPool().query<{
      stripe_subscription_id: string | null;
      status: string;
      last_stripe_event_at: string | null;
    }>(
      `SELECT stripe_subscription_id, status, last_stripe_event_at
       FROM subscriptions WHERE user_id = $1`,
      [input.userId]
    );
    const current = rows[0];
    if (current) {
      const sameSub =
        !input.stripeSubscriptionId ||
        !current.stripe_subscription_id ||
        current.stripe_subscription_id === input.stripeSubscriptionId;
      const live =
        current.status === "active" || current.status === "trialing";
      if (
        !sameSub &&
        live &&
        (input.status === "canceled" ||
          input.status === "incomplete" ||
          input.status === "past_due" ||
          input.status === "none" ||
          input.status === "unpaid")
      ) {
        return { skipped: true as const };
      }
      if (
        sameSub &&
        eventAt &&
        current.last_stripe_event_at &&
        new Date(current.last_stripe_event_at).getTime() >
          new Date(eventAt).getTime()
      ) {
        return { skipped: true as const };
      }
    }
  }

  const { rowCount } = await getPool().query(
    `INSERT INTO subscriptions (
       user_id, plan, status, amount_cents, currency, renews_at, trial_ends_at,
       access_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id,
       stripe_livemode, last_stripe_event_at, cancel_at_period_end, trial_kind, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       amount_cents = EXCLUDED.amount_cents,
       currency = EXCLUDED.currency,
       renews_at = EXCLUDED.renews_at,
       trial_ends_at = EXCLUDED.trial_ends_at,
       access_tier = EXCLUDED.access_tier,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       trial_kind = CASE
         WHEN EXCLUDED.stripe_subscription_id IS NOT NULL
           AND EXCLUDED.stripe_subscription_id IS DISTINCT FROM subscriptions.stripe_subscription_id
         THEN EXCLUDED.trial_kind
         ELSE COALESCE(EXCLUDED.trial_kind, subscriptions.trial_kind)
       END,
       stripe_customer_id = CASE
         WHEN EXCLUDED.stripe_livemode IS DISTINCT FROM subscriptions.stripe_livemode
           AND EXCLUDED.stripe_livemode IS NOT NULL
           AND EXCLUDED.stripe_customer_id IS NOT NULL
         THEN EXCLUDED.stripe_customer_id
         ELSE COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id)
       END,
       stripe_subscription_id = CASE
         WHEN EXCLUDED.stripe_livemode IS DISTINCT FROM subscriptions.stripe_livemode
           AND EXCLUDED.stripe_livemode IS NOT NULL
         THEN EXCLUDED.stripe_subscription_id
         ELSE COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id)
       END,
       stripe_price_id = CASE
         WHEN EXCLUDED.stripe_livemode IS DISTINCT FROM subscriptions.stripe_livemode
           AND EXCLUDED.stripe_livemode IS NOT NULL
         THEN EXCLUDED.stripe_price_id
         ELSE COALESCE(EXCLUDED.stripe_price_id, subscriptions.stripe_price_id)
       END,
       stripe_livemode = COALESCE(EXCLUDED.stripe_livemode, subscriptions.stripe_livemode),
       last_stripe_event_at = COALESCE(EXCLUDED.last_stripe_event_at, subscriptions.last_stripe_event_at),
       updated_at = NOW()
     WHERE
       EXCLUDED.last_stripe_event_at IS NULL
       OR subscriptions.last_stripe_event_at IS NULL
       OR subscriptions.last_stripe_event_at <= EXCLUDED.last_stripe_event_at`,
    [
      input.userId,
      input.plan,
      input.status,
      input.amountCents,
      input.currency ?? "USD",
      input.renewsAt ?? null,
      input.trialEndsAt ?? null,
      accessTier,
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
      input.stripePriceId ?? null,
      typeof input.stripeLivemode === "boolean" ? input.stripeLivemode : null,
      eventAt,
      Boolean(input.cancelAtPeriodEnd),
      input.trialKind ?? null,
    ]
  );
  return { skipped: (rowCount ?? 0) === 0 ? (true as const) : (false as const) };
}

export async function markStripeEventProcessed(
  eventId: string,
  eventType: string
): Promise<boolean> {
  await ensureSchemaReady();
  const { rowCount } = await getPool().query(
    `INSERT INTO stripe_webhook_events (event_id, event_type, processed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType]
  );
  return (rowCount ?? 0) > 0;
}

/** Release a claimed event so Stripe can retry after a failed handler. */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await ensureSchemaReady();
  await getPool().query(
    `DELETE FROM stripe_webhook_events WHERE event_id = $1`,
    [eventId]
  );
}

export async function getSubscriptionByUserId(userId: string) {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    plan: string;
    status: string;
    amount_cents: number;
    currency: string;
    renews_at: string | null;
    trial_ends_at: string | null;
    access_tier: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    stripe_livemode: boolean | null;
    cancel_at_period_end?: boolean | null;
    trial_kind?: string | null;
  }>(`SELECT * FROM subscriptions WHERE user_id = $1`, [userId]);
  return rows[0] ?? null;
}

export async function findUserIdByStripeCustomer(
  customerId: string
): Promise<string | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ user_id: string }>(
    `SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId]
  );
  return rows[0]?.user_id ?? null;
}

export function mapStripeSubscription(
  sub: {
    id: string;
    status: string;
    customer: string | { id: string };
    items: {
      data: {
        price?: {
          id?: string;
          unit_amount?: number | null;
          currency?: string;
        } | null;
      }[];
    };
    current_period_end?: number | null;
    trial_end?: number | null;
    cancel_at_period_end?: boolean;
    metadata?: {
      user_id?: string;
      user_email?: string;
      plan?: string;
      nura_trial_kind?: string;
    };
  },
  priceIds: StripePriceIds = {}
) {
  const price = sub.items.data[0]?.price;
  const priceId = price?.id ?? null;
  const planFromPrice = planIdFromStripePriceId(priceId, priceIds);
  const status = sub.status;
  const plan =
    status === "active" || status === "trialing"
      ? planFromPrice === "pro"
        ? "pro"
        : planFromPrice
      : "free";

  return {
    plan,
    status,
    amountCents: price?.unit_amount ?? 0,
    currency: (price?.currency ?? "usd").toUpperCase(),
    renewsAt: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    trialEndsAt: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    stripeCustomerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    trialKind: sub.metadata?.nura_trial_kind?.trim() || null,
  };
}

export async function mapStripeSubscriptionWithConfig(
  sub: Parameters<typeof mapStripeSubscription>[0],
  livemode?: boolean | null
) {
  const cfg = await getStripeConfig();
  const creds =
    typeof livemode === "boolean"
      ? livemode
        ? cfg.live
        : cfg.sandbox
      : undefined;
  return mapStripeSubscription(
    sub,
    creds ? stripePriceIdsFromConfig(creds) : stripePriceIdsFromConfig(cfg)
  );
}

export type AdminBillingRow = {
  userId: string;
  email: string;
  name: string | null;
  plan: string;
  status: string;
  amountCents: number;
  currency: string;
  renewsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export async function listAdminBilling(limit = 100): Promise<AdminBillingRow[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    user_id: string;
    email: string;
    name: string | null;
    plan: string;
    status: string;
    amount_cents: number;
    currency: string;
    renews_at: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }>(
    `SELECT u.id AS user_id, u.email, u.name,
            COALESCE(s.plan, 'free') AS plan,
            COALESCE(s.status, 'none') AS status,
            COALESCE(s.amount_cents, 0) AS amount_cents,
            COALESCE(s.currency, 'USD') AS currency,
            s.renews_at,
            s.stripe_customer_id,
            s.stripe_subscription_id
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     ORDER BY s.amount_cents DESC NULLS LAST, u.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    status: r.status,
    amountCents: r.amount_cents,
    currency: r.currency,
    renewsAt: r.renews_at ? new Date(r.renews_at).toISOString() : null,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
  }));
}
