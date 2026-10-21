import { recordBillingEvent } from "@/lib/billing-events";
import { dispatchConversion } from "@/lib/conversions/dispatch";
import { notifyAdminsOfTrial } from "@/lib/email/admin-payment-notify";
import { sendTrialStartedEmail } from "@/lib/email/billing-customer";
import { ensureSchemaReady, getPool } from "@/lib/db";
import type { mapStripeSubscription } from "@/lib/stripe-admin";

type MappedSubscription = ReturnType<typeof mapStripeSubscription>;

export async function trialStartedBillingEventExists(
  subscriptionId: string
): Promise<boolean> {
  if (!subscriptionId) return false;
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM billing_events
     WHERE subscription_id = $1 AND status = 'trial_started'
     LIMIT 1`,
    [subscriptionId]
  );
  return Boolean(rows[0]);
}

/**
 * Trial emails + admin ping after Checkout. Webhook and `/api/billing/status`
 * (return URL without a reachable webhook) both call this once per subscription.
 */
export async function runCheckoutTrialEffects(input: {
  userId: string;
  /** Stripe Checkout session — also the shared event id for StartTrial. */
  checkoutSessionId: string;
  dedupStripeEventId: string;
  mapped: Pick<
    MappedSubscription,
    | "plan"
    | "status"
    | "trialEndsAt"
    | "amountCents"
    | "currency"
    | "stripeSubscriptionId"
  >;
  sessionAmountCents: number;
  currency?: string | null;
  livemode: boolean;
  occurredAt?: Date | string | number | null;
}): Promise<{ ran: boolean; reason?: string }> {
  const subId = input.mapped.stripeSubscriptionId;
  if (!subId) return { ran: false, reason: "no subscription" };

  const amountCents = input.sessionAmountCents ?? input.mapped.amountCents ?? 0;
  const isTrial =
    input.mapped.status === "trialing" || amountCents === 0;
  if (!isTrial) return { ran: false, reason: "not trial" };

  if (await trialStartedBillingEventExists(subId)) {
    return { ran: false, reason: "already recorded" };
  }

  const { recorded } = await recordBillingEvent({
    userId: input.userId,
    stripeEventId: input.dedupStripeEventId,
    eventType: "checkout.session.completed",
    status: "trial_started",
    amountCents,
    currency: input.currency ?? input.mapped.currency,
    description: `Checkout · ${input.mapped.plan} trial started`,
    subscriptionId: subId,
    livemode: input.livemode,
    occurredAt: input.occurredAt,
  });

  if (!recorded) {
    return { ran: false, reason: "dedup race" };
  }

  // The browser fires StartTrial on the Checkout return page, but a closed tab,
  // a lost redirect, or the sessionStorage once-key silently drops it. Report
  // it from here instead: the Stripe webhook always runs, and the shared
  // `trial:<session>` id lets Meta dedupe the two copies when both arrive.
  // GA4 is excluded — the browser already mirrors start_trial there, and GA4
  // has no dedupe key for custom events.
  const occurredAt =
    typeof input.occurredAt === "number"
      ? new Date(input.occurredAt * 1000)
      : input.occurredAt
        ? new Date(input.occurredAt)
        : new Date();
  await dispatchConversion({
    kind: "start_trial",
    userId: input.userId,
    transactionId: `trial:${input.checkoutSessionId}`,
    valueCents: input.mapped.amountCents,
    currency: input.currency ?? input.mapped.currency,
    plan: input.mapped.plan,
    occurredAt,
    channels: ["meta", "google_ads"],
  });

  await notifyAdminsOfTrial({
    userId: input.userId,
    plan: input.mapped.plan,
    amountCents,
    currency: input.currency ?? input.mapped.currency,
    trialEndsAt: input.mapped.trialEndsAt,
    livemode: input.livemode,
  });
  await sendTrialStartedEmail({
    userId: input.userId,
    plan: input.mapped.plan,
    amountCents: input.mapped.amountCents ?? 0,
    currency: input.currency ?? input.mapped.currency,
    trialEndsAt: input.mapped.trialEndsAt,
    livemode: input.livemode,
    stripeEventId: input.dedupStripeEventId,
  });

  return { ran: true };
}
