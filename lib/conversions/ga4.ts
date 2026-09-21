import type { Ga4ConversionConfig } from "./config";
import { buildGa4MpPayload } from "./payloads";
import { failed, sent, type ChannelResult } from "./types";

const COLLECT_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

/**
 * Pull the human-readable reasons out of a `/debug/mp/collect` response.
 * The debug endpoint answers 200 with `validationMessages: []` for a good
 * payload, and never checks the api_secret at all.
 */
export function ga4ValidationMessages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "{}") as {
      validationMessages?: { description?: string; validationCode?: string }[];
    };
    return (parsed.validationMessages || [])
      .map((m) => m.description || m.validationCode || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

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
    if (res.ok) {
      if (endpoint === DEBUG_ENDPOINT) {
        const messages = ga4ValidationMessages(await res.text().catch(() => ""));
        if (messages.length) return failed("ga4", messages.join("; "));
        // Payload is valid — but this path never validates the secret, so a
        // revoked one would still look healthy here. Do not read it as "sent".
        return sent("ga4", "debug: payload valid, secret not validated");
      }
      return sent("ga4", res.status === 204 ? undefined : `${res.status}`);
    }
    const text = await res.text().catch(() => "");
    return failed("ga4", `${res.status} ${text}`);
  } catch (err) {
    return failed("ga4", err instanceof Error ? err.message : String(err));
  }
}
