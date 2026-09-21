/**
 * Pure payload builders for server-side conversion delivery.
 *
 * Kept free of network and database access so the wire formats can be unit
 * tested without credentials.
 */

import { createHash } from "node:crypto";

/** Measurement Protocol drops events older than 72 hours. */
export const GA4_MAX_BACKDATE_MS = 72 * 60 * 60 * 1000;

export function centsToUnits(cents: number): number {
  return Math.round(cents) / 100;
}

export type Ga4MpPayload = {
  client_id: string;
  user_id?: string;
  timestamp_micros: number;
  non_personalized_ads?: boolean;
  events: { name: string; params: Record<string, unknown> }[];
};

/**
 * Clamp the event time into the Measurement Protocol's 72-hour backdating
 * window. A Stripe webhook retry can arrive days late; sending the original
 * timestamp would make Google drop the event silently, so we pin it to the edge
 * of the window instead.
 */
export function clampGa4Timestamp(occurredAt: Date, now: Date = new Date()): Date {
  const time = occurredAt.getTime();
  if (!Number.isFinite(time)) return now;
  const floor = now.getTime() - GA4_MAX_BACKDATE_MS + 60_000;
  if (time < floor) return new Date(floor);
  if (time > now.getTime()) return now;
  return occurredAt;
}

export function buildGa4MpPayload(input: {
  clientId: string;
  userId?: string | null;
  name: string;
  params?: Record<string, unknown>;
  occurredAt: Date;
  now?: Date;
}): Ga4MpPayload {
  const now = input.now ?? new Date();
  const occurredAt = clampGa4Timestamp(input.occurredAt, now);
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.params || {})) {
    if (value !== undefined && value !== null) params[key] = value;
  }

  const payload: Ga4MpPayload = {
    client_id: input.clientId,
    timestamp_micros: occurredAt.getTime() * 1000,
    events: [{ name: input.name, params }],
  };
  if (input.userId) payload.user_id = input.userId;
  return payload;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type MetaCapiEvent = Record<string, unknown>;

/**
 * Meta deduplicates by `event_name` + `event_id`, so the same id the browser
 * pixel used is what keeps a client and server Purchase from counting twice.
 */
export function buildMetaCapiEvent(input: {
  eventName: string;
  eventId: string;
  occurredAt: Date;
  sourceUrl?: string | null;
  valueCents?: number | null;
  currency?: string | null;
  plan?: string | null;
  email?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  actionSource?: "website" | "system_generated";
}): MetaCapiEvent {
  const userData: Record<string, unknown> = {};
  if (input.email) userData.em = [sha256Hex(input.email)];
  if (input.externalId) userData.external_id = [sha256Hex(input.externalId)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const customData: Record<string, unknown> = {};
  if (typeof input.valueCents === "number") {
    customData.value = centsToUnits(input.valueCents);
  }
  if (input.currency) customData.currency = input.currency.toUpperCase();
  if (input.plan) {
    customData.content_name = input.plan;
    customData.content_category = "subscription";
  }
  customData.order_id = input.eventId;

  const event: MetaCapiEvent = {
    event_name: input.eventName,
    event_time: Math.floor(input.occurredAt.getTime() / 1000),
    event_id: input.eventId,
    action_source: input.actionSource ?? "website",
    user_data: userData,
  };
  if (input.sourceUrl) event.event_source_url = input.sourceUrl;
  if (Object.keys(customData).length) event.custom_data = customData;
  return event;
}

/**
 * Google Ads requires `yyyy-MM-dd HH:mm:ss+|-HH:mm`. Everything we send is UTC
 * so a server in any timezone reports the charge at the same instant.
 */
export function formatGoogleAdsDateTime(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}+00:00`;
}

export type GoogleClickIdField = "gclid" | "gbraid" | "wbraid";

export function buildGoogleAdsClickConversion(input: {
  customerId: string;
  conversionActionId: string;
  clickId: string;
  clickIdField: GoogleClickIdField;
  occurredAt: Date;
  valueCents?: number | null;
  currency?: string | null;
  orderId?: string | null;
}): Record<string, unknown> {
  const conversion: Record<string, unknown> = {
    [input.clickIdField]: input.clickId,
    conversionAction: `customers/${input.customerId}/conversionActions/${input.conversionActionId}`,
    conversionDateTime: formatGoogleAdsDateTime(input.occurredAt),
  };
  if (typeof input.valueCents === "number") {
    conversion.conversionValue = centsToUnits(input.valueCents);
  }
  if (input.currency) conversion.currencyCode = input.currency.toUpperCase();
  if (input.orderId) conversion.orderId = input.orderId;
  return conversion;
}
