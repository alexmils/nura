import { readConsent } from "@/lib/marketing-consent";

export type MetaStandardEvent =
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "StartTrial"
  | "Purchase"
  | "Subscribe"
  | "Lead";

export type MetaEventParams = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  status?: boolean;
};

/**
 * GA4 twin of each Meta standard event.
 *
 * The client deliberately never sends a GA4 `purchase`. With a 7-day trial the
 * money moves on Stripe's servers days later, and only the webhook knows the
 * invoice id that keeps the event from being counted twice — so the browser
 * reports `start_subscription` and the server reports the real `purchase`.
 * `start_subscription` is also the better event to optimize Google Ads on: it
 * happens in a live session, with the click still attached.
 */
export const GA4_EVENT_NAMES: Record<MetaStandardEvent, string> = {
  CompleteRegistration: "sign_up",
  InitiateCheckout: "begin_checkout",
  StartTrial: "start_trial",
  Subscribe: "start_subscription",
  Purchase: "start_subscription",
  Lead: "generate_lead",
};

/** GA4 events that carry an item breakdown. */
const MONETIZATION_EVENTS = new Set([
  "begin_checkout",
  "start_trial",
  "start_subscription",
]);

type Ga4EventParams = {
  value?: number;
  currency?: string;
  plan?: string;
  content_category?: string;
  transaction_id?: string;
  items?: Record<string, unknown>[];
};

export function buildGa4EventParams(
  ga4EventName: string,
  params?: MetaEventParams,
  transactionId?: string
): Ga4EventParams {
  const out: Ga4EventParams = {};
  if (typeof params?.value === "number") out.value = params.value;
  if (params?.currency) out.currency = params.currency.toUpperCase();
  if (params?.content_name) out.plan = params.content_name;
  if (params?.content_category) out.content_category = params.content_category;
  if (transactionId) out.transaction_id = transactionId;
  if (
    params?.content_name &&
    MONETIZATION_EVENTS.has(ga4EventName)
  ) {
    out.items = [
      {
        item_id: params.content_name,
        item_name: params.content_name,
        quantity: 1,
        ...(typeof params.value === "number" ? { price: params.value } : {}),
      },
    ];
  }
  return out;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function onceKeyStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storageKey = `nura_meta_once_${key}`;
    if (window.sessionStorage.getItem(storageKey)) return false;
    window.sessionStorage.setItem(storageKey, "1");
    return true;
  } catch {
    return true;
  }
}

/**
 * Fire a Meta Pixel standard event when fbq is present (GTM Custom HTML) and
 * mirror it to GA4, which had no custom events at all before this.
 *
 * Also pushes dataLayer for Tag Manager custom triggers. An explicit rejection
 * in the cookie banner silences the matching platform only: GA4 follows the
 * analytics choice, Meta follows the marketing choice.
 */
export function trackMetaEvent(
  event: MetaStandardEvent,
  params?: MetaEventParams,
  opts?: { onceKey?: string; ga4Event?: string; transactionId?: string }
): void {
  if (typeof window === "undefined") return;
  if (opts?.onceKey && !onceKeyStorage(opts.onceKey)) return;

  const consent = readConsent();
  const marketingDenied = consent?.marketing === false;
  const analyticsDenied = consent?.analytics === false;
  const payload = params ?? {};

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: `meta_${event}`,
    meta_event: event,
    ...payload,
  });

  if (!analyticsDenied && typeof window.gtag === "function") {
    const ga4Event = opts?.ga4Event ?? GA4_EVENT_NAMES[event];
    if (ga4Event) {
      window.gtag(
        "event",
        ga4Event,
        buildGa4EventParams(ga4Event, params, opts?.transactionId)
      );
    }
  }

  if (marketingDenied) return;
  if (typeof window.fbq !== "function") return;
  if (opts?.transactionId) {
    // Same `eventID` the Conversions API sends, so Meta deduplicates the charge
    // instead of counting it from both sources.
    window.fbq("track", event, payload, { eventID: opts.transactionId });
    return;
  }
  window.fbq("track", event, payload);
}

/** Plan display → Meta purchase/trial value helpers. */
export function metaMoneyFromPlanPrice(
  displayPrice: string | undefined
): { value?: number; currency: string } {
  if (!displayPrice) return { currency: "USD" };
  const currency = /€|eur/i.test(displayPrice)
    ? "EUR"
    : /£|gbp/i.test(displayPrice)
      ? "GBP"
      : "USD";
  const num = Number(displayPrice.replace(/[^0-9.,]/g, "").replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return { currency };
  return { value: num, currency };
}
