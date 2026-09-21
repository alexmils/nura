import type { Ga4ConversionConfig } from "./config";
import { buildGa4MpPayload } from "./payloads";
import { failed, sent, type ChannelResult } from "./types";

const COLLECT_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

/**
 * Send one event to GA4 over the Measurement Protocol.
 *
 * This is the only way a purchase that happens days later on Stripe's servers
 * can reach GA4: the browser is long gone, so the stored `client_id` from the
 * original visit is what ties the event back to the user.
 */
export async function sendGa4Event(input: {
  config: Ga4ConversionConfig;
  clientId: string;
  userId?: string | null;
  name: string;
  params?: Record<string, unknown>;
  occurredAt: Date;
}): Promise<ChannelResult> {
  const endpoint =
    (process.env.GA4_MP_DEBUG || "").trim() === "1"
      ? DEBUG_ENDPOINT
      : COLLECT_ENDPOINT;
  const url = `${endpoint}?measurement_id=${encodeURIComponent(
    input.config.measurementId
  )}&api_secret=${encodeURIComponent(input.config.apiSecret)}`;

  const body = buildGa4MpPayload({
    clientId: input.clientId,
    userId: input.userId,
    name: input.name,
    params: input.params,
    occurredAt: input.occurredAt,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    // The collect endpoint answers 204 with an empty body when it accepts the
    // event; anything else carries a reason worth surfacing.
    if (res.ok) return sent("ga4", res.status === 204 ? undefined : `${res.status}`);
    const text = await res.text().catch(() => "");
    return failed("ga4", `${res.status} ${text}`);
  } catch (err) {
    return failed("ga4", err instanceof Error ? err.message : String(err));
  }
}
