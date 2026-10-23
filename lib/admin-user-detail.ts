import { ensureSchemaReady, getPool } from "@/lib/db";
import { getUserById } from "@/lib/users";
import type { UserStatus } from "@/lib/users";
import { getUserLlmUsage } from "@/lib/llm-usage";
import {
  healLastLoginFromEvents,
  listUserAuthEvents,
  resolveLastLoginAt,
  type UserAuthEvent,
} from "@/lib/audit-log";
import {
  listBillingEventsForUser,
  type BillingEvent,
} from "@/lib/billing-events";
import {
  describeCancelFeedback,
  getLatestCancelFeedbackForUser,
} from "@/lib/subscription-cancel-feedback";
import { listRetentionEventsForUser } from "@/lib/subscription-retention";
import { getUserAgentHealth, type UserAgentHealth } from "@/lib/agent-health";

export type AdminUserLoginEvent = UserAuthEvent;

export type AdminUserPaymentEvent = {
  id: string;
  eventType: string;
  status: string;
  amountCents: number;
  currency: string;
  description: string | null;
  occurredAt: string;
  livemode: boolean | null;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  statsExcluded: boolean;
  plan: string;
  subscriptionStatus: string;
  amountCents: number;
  currency: string;
  renewsAt: string | null;
  trialEndsAt: string | null;
  accessTier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeLivemode: boolean | null;
  lastStripeEventAt: string | null;
  threadCount: number;
  messageCount: number;
  llmCallCount: number;
  llmTotalTokens: number;
  llmPromptTokens: number;
  llmCompletionTokens: number;
  llmCostUsdMicros: number;
  loginHistory: AdminUserLoginEvent[];
  paymentHistory: AdminUserPaymentEvent[];
  /** Shown when subscription exists but no payment rows yet. */
  paymentHistoryNote: string | null;
  latestCancelFeedback: {
    at: string;
    summary: string;
    labels: string[];
    comment: string | null;
  } | null;
  retentionEvents: {
    action: string;
    at: string;
    reasonIds: string[];
    comment: string | null;
  }[];
  /** Guided threads (messages, sets, stuck flag) and interpreter failures. */
  agentHealth: UserAgentHealth;
};

function mapPayment(ev: BillingEvent): AdminUserPaymentEvent {
  return {
    id: ev.id,
    eventType: ev.eventType,
    status: ev.status,
    amountCents: ev.amountCents,
    currency: ev.currency,
    description: ev.description,
    occurredAt: ev.occurredAt,
    livemode: ev.livemode,
  };
}

export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetail | null> {
  await ensureSchemaReady();
  const user = await getUserById(userId);
  if (!user) return null;

  const pool = getPool();
  const [
    threads,
    messages,
    sub,
    llm,
    loginHistory,
    paymentHistory,
    excluded,
    cancelFeedback,
    retentionEvents,
    agentHealth,
  ] = await Promise.all([
      pool.query<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM threads WHERE user_id = $1",
        [userId]
      ),
      pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE t.user_id = $1`,
        [userId]
      ),
      pool.query<{
        plan: string | null;
        status: string | null;
        amount_cents: number | null;
        currency: string | null;
        renews_at: string | null;
        trial_ends_at: string | null;
        access_tier: string | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        stripe_livemode: boolean | null;
        last_stripe_event_at: string | null;
      }>(
        `SELECT plan, status, amount_cents, currency, renews_at, trial_ends_at,
                access_tier, stripe_customer_id, stripe_subscription_id,
                stripe_livemode, last_stripe_event_at
         FROM subscriptions WHERE user_id = $1`,
        [userId]
      ),
      getUserLlmUsage(userId),
      listUserAuthEvents(userId, 40),
      listBillingEventsForUser(userId, 40),
      pool.query<{ stats_excluded: boolean }>(
        `SELECT COALESCE(stats_excluded, FALSE) AS stats_excluded
         FROM users WHERE id = $1`,
        [userId]
      ),
      getLatestCancelFeedbackForUser(userId),
      listRetentionEventsForUser(userId, 8),
      getUserAgentHealth(userId),
    ]);

  const latestLoginEvent =
    loginHistory.find((e) => e.action === "user.login")?.createdAt ?? null;
  let lastLoginAt = resolveLastLoginAt(user.lastLoginAt, latestLoginEvent);

  if (!user.lastLoginAt && latestLoginEvent) {
    const healed = await healLastLoginFromEvents(userId);
    lastLoginAt = resolveLastLoginAt(healed, latestLoginEvent);
  }

  const subRow = sub.rows[0];
  const plan = subRow?.plan ?? "free";
  const subscriptionStatus = subRow?.status ?? "none";
  const hasStripeLink = Boolean(
    subRow?.stripe_customer_id || subRow?.stripe_subscription_id
  );

  let paymentHistoryNote: string | null = null;
  if (paymentHistory.length === 0) {
    if (hasStripeLink || subscriptionStatus === "trialing") {
      paymentHistoryNote =
        "No payment events stored yet. New Stripe invoices and checkouts will appear here after the next successful webhook.";
    } else if (subscriptionStatus !== "none" && plan !== "free") {
      paymentHistoryNote =
        "Subscription exists, but no Stripe payment events are stored for this user yet.";
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt,
    emailVerified: user.emailVerified,
    hasPassword: Boolean(user.passwordHash),
    statsExcluded: Boolean(excluded.rows[0]?.stats_excluded),
    plan,
    subscriptionStatus,
    amountCents: subRow?.amount_cents ?? 0,
    currency: (subRow?.currency ?? "USD").toUpperCase(),
    renewsAt: subRow?.renews_at
      ? new Date(subRow.renews_at).toISOString()
      : null,
    trialEndsAt: subRow?.trial_ends_at
      ? new Date(subRow.trial_ends_at).toISOString()
      : null,
    accessTier: subRow?.access_tier ?? "none",
    stripeCustomerId: subRow?.stripe_customer_id ?? null,
    stripeSubscriptionId: subRow?.stripe_subscription_id ?? null,
    stripeLivemode:
      typeof subRow?.stripe_livemode === "boolean"
        ? subRow.stripe_livemode
        : null,
    lastStripeEventAt: subRow?.last_stripe_event_at
      ? new Date(subRow.last_stripe_event_at).toISOString()
      : null,
    threadCount: threads.rows[0]?.c ?? 0,
    messageCount: messages.rows[0]?.c ?? 0,
    llmCallCount: llm.callCount,
    llmTotalTokens: llm.totalTokens,
    llmPromptTokens: llm.promptTokens,
    llmCompletionTokens: llm.completionTokens,
    llmCostUsdMicros: llm.costUsdMicros,
    loginHistory,
    paymentHistory: paymentHistory.map(mapPayment),
    paymentHistoryNote,
    latestCancelFeedback: cancelFeedback
      ? {
          at: cancelFeedback.createdAt,
          ...describeCancelFeedback(cancelFeedback),
          comment: cancelFeedback.comment,
        }
      : null,
    retentionEvents,
    agentHealth,
  };
}
