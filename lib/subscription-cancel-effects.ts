import { recordBillingEvent, type BillingEventStatus } from "@/lib/billing-events";
import { notifyAdminsOfSubscriptionCancel } from "@/lib/email/admin-payment-notify";
import { ensureSchemaReady, getPool } from "@/lib/db";

const SCHEDULED_STATUS: BillingEventStatus = "subscription_cancel_scheduled";
const ENDED_STATUS: BillingEventStatus = "subscription_canceled";

export async function subscriptionCancelBillingEventExists(
  subscriptionId: string,
  status: BillingEventStatus
): Promise<boolean> {
  if (!subscriptionId) return false;
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM billing_events
     WHERE subscription_id = $1 AND status = $2
     LIMIT 1`,
    [subscriptionId, status]
  );
  return Boolean(rows[0]);
}

/** Admin activity bell + operator email when a subscription is canceled or scheduled to end. */
export async function runSubscriptionCancelAdminEffects(input: {
  userId: string;
  stripeEventId: string;
  stripeSubscriptionId: string;
  eventType: string;
  plan?: string | null;
  accessEndsAt: Date | null;
  keepsAccess: boolean;
  livemode: boolean;
  occurredAt?: Date | string | number | null;
}): Promise<{ ran: boolean; reason?: string }> {
  const subId = input.stripeSubscriptionId;
  if (!subId) return { ran: false, reason: "no subscription" };

  const status: BillingEventStatus = input.keepsAccess
    ? SCHEDULED_STATUS
    : ENDED_STATUS;

  if (await subscriptionCancelBillingEventExists(subId, status)) {
    return { ran: false, reason: "already recorded" };
  }

  const endLabel =
    input.accessEndsAt && !Number.isNaN(input.accessEndsAt.getTime())
      ? input.accessEndsAt.toISOString()
      : null;

  const { recorded } = await recordBillingEvent({
    userId: input.userId,
    stripeEventId: input.stripeEventId,
    eventType: input.eventType,
    status,
    amountCents: 0,
    currency: "USD",
    description: endLabel,
    subscriptionId: subId,
    livemode: input.livemode,
    occurredAt: input.occurredAt,
  });

  if (!recorded) {
    return { ran: false, reason: "dedup race" };
  }

  await notifyAdminsOfSubscriptionCancel({
    userId: input.userId,
    plan: input.plan,
    accessEndsAt: input.accessEndsAt,
    keepsAccess: input.keepsAccess,
    livemode: input.livemode,
  });

  return { ran: true };
}

export async function clearSubscriptionCancelScheduledActivity(
  stripeSubscriptionId: string
): Promise<void> {
  if (!stripeSubscriptionId) return;
  await ensureSchemaReady();
  await getPool().query(
    `DELETE FROM billing_events
     WHERE subscription_id = $1 AND status = $2`,
    [stripeSubscriptionId, SCHEDULED_STATUS]
  );
}
