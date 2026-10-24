import { ensureSchemaReady, getPool } from "@/lib/db";

export type BillingEventStatus =
  | "succeeded"
  | "failed"
  | "checkout"
  | "trial_started"
  | "subscription_cancel_scheduled"
  | "subscription_canceled"
  | "subscription_resumed";

export type BillingEvent = {
  id: string;
  userId: string;
  stripeEventId: string | null;
  eventType: string;
  status: BillingEventStatus;
  amountCents: number;
  currency: string;
  description: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
  livemode: boolean | null;
  occurredAt: string;
};

export type RecordBillingEventInput = {
  userId: string;
  stripeEventId?: string | null;
  eventType: string;
  status: BillingEventStatus;
  amountCents?: number;
  currency?: string;
  description?: string | null;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  livemode?: boolean | null;
  occurredAt?: Date | string | number | null;
};

/** Re-export client-safe labels for server callers (prefer `@/lib/billing-event-format` in shared UI). */
export {
  describeInvoicePayment,
  paymentStatusLabel,
} from "@/lib/billing-event-format";

function toIso(value: Date | string | number | null | undefined): string {
  if (value == null) return new Date().toISOString();
  if (typeof value === "number") {
    // Stripe event.created is unix seconds
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export async function recordBillingEvent(
  input: RecordBillingEventInput
): Promise<{ recorded: boolean; id: string }> {
  await ensureSchemaReady();
  const id = crypto.randomUUID();
  const occurredAt = toIso(input.occurredAt);

  if (input.stripeEventId) {
    const { rowCount } = await getPool().query(
      `INSERT INTO billing_events (
         id, user_id, stripe_event_id, event_type, status, amount_cents, currency,
         description, invoice_id, subscription_id, livemode, occurred_at, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [
        id,
        input.userId,
        input.stripeEventId,
        input.eventType,
        input.status,
        input.amountCents ?? 0,
        (input.currency ?? "USD").toUpperCase(),
        input.description ?? null,
        input.invoiceId ?? null,
        input.subscriptionId ?? null,
        typeof input.livemode === "boolean" ? input.livemode : null,
        occurredAt,
      ]
    );
    return { recorded: (rowCount ?? 0) > 0, id };
  }

  await getPool().query(
    `INSERT INTO billing_events (
       id, user_id, stripe_event_id, event_type, status, amount_cents, currency,
       description, invoice_id, subscription_id, livemode, occurred_at, created_at
     ) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
    [
      id,
      input.userId,
      input.eventType,
      input.status,
      input.amountCents ?? 0,
      (input.currency ?? "USD").toUpperCase(),
      input.description ?? null,
      input.invoiceId ?? null,
      input.subscriptionId ?? null,
      typeof input.livemode === "boolean" ? input.livemode : null,
      occurredAt,
    ]
  );
  return { recorded: true, id };
}

export async function countBillingEventsForUser(userId: string): Promise<number> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM billing_events WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.c ?? 0;
}

export async function listBillingEventsForUser(
  userId: string,
  limit = 50,
  offset = 0
): Promise<BillingEvent[]> {
  await ensureSchemaReady();
  const capped = Math.min(100, Math.max(1, limit));
  const skip = Math.max(0, Math.floor(offset));
  const { rows } = await getPool().query<{
    id: string;
    user_id: string;
    stripe_event_id: string | null;
    event_type: string;
    status: string;
    amount_cents: number;
    currency: string;
    description: string | null;
    invoice_id: string | null;
    subscription_id: string | null;
    livemode: boolean | null;
    occurred_at: string;
  }>(
    `SELECT id, user_id, stripe_event_id, event_type, status, amount_cents, currency,
            description, invoice_id, subscription_id, livemode, occurred_at
     FROM billing_events
     WHERE user_id = $1
     ORDER BY occurred_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, capped, skip]
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    stripeEventId: r.stripe_event_id,
    eventType: r.event_type,
    status: r.status as BillingEventStatus,
    amountCents: r.amount_cents,
    currency: r.currency,
    description: r.description,
    invoiceId: r.invoice_id,
    subscriptionId: r.subscription_id,
    livemode: r.livemode,
    occurredAt: new Date(r.occurred_at).toISOString(),
  }));
}
