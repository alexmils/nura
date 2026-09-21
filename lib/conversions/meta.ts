import type { MetaConversionConfig } from "./config";
import { buildMetaCapiEvent } from "./payloads";
import { failed, sent, type ChannelResult } from "./types";

const GRAPH_VERSION = "v21.0";

/**
 * Send one event to the Meta Conversions API.
 *
 * `eventId` must match the `eventID` the browser pixel used, otherwise Meta
 * counts the same purchase twice (once from each source).
 */
export async function sendMetaCapiEvent(input: {
  config: MetaConversionConfig;
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
}): Promise<ChannelResult> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(
    input.config.pixelId
  )}/events?access_token=${encodeURIComponent(input.config.accessToken)}`;

  const event = buildMetaCapiEvent({
    eventName: input.eventName,
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    sourceUrl: input.sourceUrl,
    valueCents: input.valueCents,
    currency: input.currency,
    plan: input.plan,
    email: input.email,
    externalId: input.externalId,
    fbp: input.fbp,
    fbc: input.fbc,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
  });

  const body: Record<string, unknown> = { data: [event] };
  const testCode = (input.config.testEventCode || "").trim();
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) return failed("meta", `${res.status} ${text}`);

    let received = 0;
    let traceId = "";
    try {
      const parsed = JSON.parse(text) as {
        events_received?: number;
        fbtrace_id?: string;
        messages?: unknown;
      };
      received = Number(parsed.events_received || 0);
      traceId = parsed.fbtrace_id || "";
      if (!received) {
        return failed("meta", text || "no events_received");
      }
    } catch {
      return failed("meta", text || "unparseable response");
    }
    return sent("meta", traceId ? `fbtrace ${traceId}` : undefined);
  } catch (err) {
    return failed("meta", err instanceof Error ? err.message : String(err));
  }
}
