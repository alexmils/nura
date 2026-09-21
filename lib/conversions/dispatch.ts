/**
 * Server-side conversion delivery.
 *
 * The paid funnel collects money on Stripe's servers days after the ad click,
 * so nothing a browser tag does can report the purchase. This module is the
 * only place that knows about it.
 *
 * Two rules hold everywhere below: a missing credential or a missing click id
 * skips a channel rather than failing the caller, and a `transaction_id` is
 * delivered to each channel at most once, so a Stripe webhook retry cannot
 * double-count a charge.
 */

import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  googleClickId,
  type AttributionSnapshot,
} from "@/lib/attribution";
import { getUserAttribution } from "@/lib/attribution-server";
import { getUserById } from "@/lib/users";
import { loadConversionConfig, type ConversionConfig } from "./config";
import { sendGa4Event } from "./ga4";
import { sendMetaCapiEvent } from "./meta";
import { uploadClickConversion } from "./google-ads";
import { centsToUnits, type GoogleClickIdField } from "./payloads";
import {
  failed,
  skipped,
  summarizeResults,
  type ChannelResult,
  type ConversionChannel,
} from "./types";

export type ConversionKind =
  | "purchase"
  | "start_trial"
  | "begin_checkout"
  | "sign_up"
  | "generate_lead";

/** GA4 uses the kind verbatim; Meta keeps its own standard event names. */
const META_EVENT_NAMES: Partial<Record<ConversionKind, string>> = {
  purchase: "Purchase",
  start_trial: "StartTrial",
  begin_checkout: "InitiateCheckout",
  sign_up: "CompleteRegistration",
  generate_lead: "Lead",
};

export type DispatchConversionInput = {
  kind: ConversionKind;
  userId: string;
  /** Stable per-charge id (the Stripe invoice id) — the dedupe key. */
  transactionId: string;
  valueCents?: number | null;
  currency?: string | null;
  plan?: string | null;
  occurredAt?: Date;
  sourceUrl?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  /** Defaults to every channel; used by the admin test action. */
  channels?: ConversionChannel[];
  /** Ask Google to validate without recording (setup check). */
  validateOnly?: boolean;
  /**
   * Probe only. A real charge always leans on stored attribution; the admin
   * test action runs for an account that has no captured click, so it supplies
   * identifiers that exercise the transport instead of skipping the channel.
   */
  probe?: { gaClientId: string; clickId?: string };
};

export type DispatchConversionResult = {
  transactionId: string;
  kind: ConversionKind;
  channels: ChannelResult[];
};

const ALL_CHANNELS: ConversionChannel[] = ["ga4", "meta", "google_ads"];

/**
 * Claim (channel, transaction) so only the first webhook delivery sends it.
 * A row left in `failed` stays claimable, so a genuine outage retries later.
 */
async function claimDispatch(input: {
  userId: string;
  channel: ConversionChannel;
  kind: ConversionKind;
  transactionId: string;
  valueCents?: number | null;
  currency?: string | null;
}): Promise<boolean> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO conversion_dispatches (
       id, user_id, channel, event_name, transaction_id, status,
       value_cents, currency
     ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
     ON CONFLICT (channel, transaction_id) DO UPDATE
       SET status = 'pending', detail = NULL, created_at = NOW()
       WHERE conversion_dispatches.status = 'failed'
     RETURNING id`,
    [
      crypto.randomUUID(),
      input.userId,
      input.channel,
      input.kind,
      input.transactionId,
      input.valueCents ?? null,
      input.currency ?? null,
    ]
  );
  return rows.length > 0;
}

async function finishDispatch(
  transactionId: string,
  result: ChannelResult
): Promise<void> {
  await getPool().query(
    `UPDATE conversion_dispatches
       SET status = $3, detail = $4
     WHERE channel = $1 AND transaction_id = $2`,
    [result.channel, transactionId, result.status, result.detail ?? null]
  );
}

function googleClickIdField(
  snapshot: AttributionSnapshot | null
): { id: string; field: GoogleClickIdField } | null {
  const id = googleClickId(snapshot);
  if (!id || !snapshot) return null;
  const field: GoogleClickIdField = snapshot.gclid
    ? "gclid"
    : snapshot.gbraid
      ? "gbraid"
      : "wbraid";
  return { id, field };
}

/** Plan name plus the identifiers GA4 needs to build an item breakdown. */
function planItems(plan: string | null | undefined, valueCents?: number | null) {
  if (!plan) return undefined;
  return [
    {
      item_id: plan,
      item_name: plan,
      ...(typeof valueCents === "number"
        ? { price: centsToUnits(valueCents), quantity: 1 }
        : {}),
    },
  ];
}

async function runChannel(
  channel: ConversionChannel,
  input: DispatchConversionInput,
  ctx: {
    attribution: AttributionSnapshot | null;
    config: ConversionConfig;
    email?: string | null;
  }
): Promise<ChannelResult> {
  const { attribution, config, email } = ctx;
  const occurredAt = input.occurredAt ?? new Date();
  const marketingDenied = attribution?.consent?.marketing === false;

  if (channel === "ga4") {
    if (!config.ga4) {
      return skipped("ga4", "not configured — needs the Measurement Protocol API secret");
    }
    const clientId = attribution?.gaClientId || input.probe?.gaClientId;
    if (!clientId) return skipped("ga4", "no GA4 client_id captured");
    const params: Record<string, unknown> = {
      transaction_id: input.transactionId,
      ...(input.plan ? { plan: input.plan } : {}),
      ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
      ...(typeof input.valueCents === "number"
        ? { value: centsToUnits(input.valueCents) }
        : {}),
      ...(attribution?.gclid ? { gclid: attribution.gclid } : {}),
    };
    const items = planItems(input.plan, input.valueCents);
    if (items) params.items = items;
    return sendGa4Event({
      config: config.ga4,
      clientId,
      userId: input.userId,
      name: input.kind,
      params,
      occurredAt,
    });
  }

  if (channel === "meta") {
    if (!config.meta) {
      return skipped("meta", "not configured — needs the Pixel ID and the access token");
    }
    if (marketingDenied) return skipped("meta", "marketing consent declined");
    const eventName = META_EVENT_NAMES[input.kind];
    if (!eventName) return skipped("meta", `no Meta event for ${input.kind}`);
    return sendMetaCapiEvent({
      config: config.meta,
      eventName,
      eventId: input.transactionId,
      occurredAt,
      sourceUrl: input.sourceUrl ?? attribution?.landingPage ?? null,
      valueCents: input.valueCents,
      currency: input.currency,
      plan: input.plan,
      email: email ?? null,
      externalId: input.userId,
      fbp: attribution?.fbp ?? null,
      fbc: attribution?.fbc ?? null,
      clientIp: input.clientIp ?? null,
      userAgent: input.userAgent ?? null,
    });
  }

  // google_ads — the only channel that credits the exact click.
  if (!config.googleAds) {
    return skipped(
      "google_ads",
      "not configured — needs the customer ID, conversion action ID, developer token and OAuth credentials"
    );
  }
  if (marketingDenied) return skipped("google_ads", "marketing consent declined");
  const probeClickId = input.probe?.clickId;
  const click =
    googleClickIdField(attribution) ??
    (probeClickId ? { id: probeClickId, field: "gclid" as const } : null);
  if (!click) return skipped("google_ads", "no gclid/gbraid/wbraid captured");
  return uploadClickConversion({
    config: config.googleAds,
    clickId: click.id,
    clickIdField: click.field,
    occurredAt,
    valueCents: input.valueCents,
    currency: input.currency,
    orderId: input.transactionId,
    validateOnly: input.validateOnly,
  });
}

/**
 * Deliver one conversion to every configured ad platform.
 * Never throws: the Stripe webhook must keep returning 200.
 */
export async function dispatchConversion(
  input: DispatchConversionInput
): Promise<DispatchConversionResult> {
  const channels = input.channels?.length ? input.channels : ALL_CHANNELS;
  const results: ChannelResult[] = [];

  try {
    await ensureSchemaReady();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[conversions] schema unavailable", detail);
    return {
      transactionId: input.transactionId,
      kind: input.kind,
      channels: channels.map((channel) =>
        failed(channel, `schema unavailable: ${detail}`)
      ),
    };
  }

  // Reads Admin → SEO → Connections, falling back to env per field. It never
  // throws: an unreadable settings row must not silence a charge.
  const config: ConversionConfig = await loadConversionConfig();

  // Per-user inputs. Missing either one only skips the channels that use it,
  // so one unreadable row cannot silence a charge.
  let attribution: AttributionSnapshot | null = null;
  try {
    attribution = await getUserAttribution(input.userId);
  } catch (err) {
    console.warn("[conversions] attribution unreadable", err);
  }
  let email: string | null = null;
  try {
    const user = await getUserById(input.userId);
    email = user?.email ?? null;
  } catch (err) {
    console.warn("[conversions] user lookup failed", err);
  }

  for (const channel of channels) {
    try {
      const claimable = input.validateOnly
        ? true
        : await claimDispatch({
            userId: input.userId,
            channel,
            kind: input.kind,
            transactionId: input.transactionId,
            valueCents: input.valueCents,
            currency: input.currency,
          });
      if (!claimable) {
        results.push(skipped(channel, "already delivered"));
        continue;
      }

      const result = await runChannel(channel, input, {
        attribution,
        config,
        email,
      });
      results.push(result);

      if (!input.validateOnly) {
        await finishDispatch(input.transactionId, result);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[conversions] ${channel} failed`, detail);
      results.push(failed(channel, detail));
    }
  }

  console.info(
    `[conversions] ${input.kind} ${input.transactionId} → ${summarizeResults(results)}`
  );
  return {
    transactionId: input.transactionId,
    kind: input.kind,
    channels: results,
  };
}

/**
 * True when this invoice is the first one that actually collected money.
 *
 * A 7-day trial puts a $0 invoice at `subscription_create` and the real charge
 * seven days later at `subscription_cycle`, so `billing_reason` alone cannot
 * tell the two apart. Prior succeeded payments for the same subscription can —
 * and this must run before the current invoice is recorded.
 */
export async function isFirstPaidCharge(input: {
  subscriptionId: string | null | undefined;
  invoiceId?: string | null;
}): Promise<boolean> {
  if (!input.subscriptionId) return false;
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM billing_events
     WHERE subscription_id = $1
       AND status = 'succeeded'
       AND amount_cents > 0
       AND ($2::text IS NULL OR invoice_id IS DISTINCT FROM $2)`,
    [input.subscriptionId, input.invoiceId ?? null]
  );
  return Number(rows[0]?.n ?? 0) === 0;
}

/** Recent dispatch log for the admin status view. */
export async function listRecentDispatches(limit = 25) {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    channel: string;
    event_name: string;
    transaction_id: string;
    status: string;
    detail: string | null;
    value_cents: number | null;
    currency: string | null;
    created_at: string;
  }>(
    `SELECT channel, event_name, transaction_id, status, detail,
            value_cents, currency, created_at
     FROM conversion_dispatches
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  );
  return rows.map((row) => ({
    channel: row.channel,
    eventName: row.event_name,
    transactionId: row.transaction_id,
    status: row.status,
    detail: row.detail,
    valueCents: row.value_cents,
    currency: row.currency,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
