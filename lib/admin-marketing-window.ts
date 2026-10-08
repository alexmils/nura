import type { AdsRange } from "@/lib/ads-range";

const RANGE_DAYS: Record<Exclude<AdsRange, "all">, number> = {
  "7": 7,
  "28": 28,
  "90": 90,
};

/** UTC calendar day, `days` before `now`. */
export function isoDaysAgo(days: number, now = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function adsRangeDays(range: AdsRange): number | null {
  return range === "all" ? null : RANGE_DAYS[range];
}

/**
 * Reporting windows stop at yesterday.
 * "All time" has no previous window (Google Ads rejects an open-ended date).
 */
export function adsWindow(
  range: AdsRange,
  offsetWindows = 0,
  now = new Date()
): { startDate: string; endDate: string } | null {
  if (range === "all") {
    if (offsetWindows > 0) return null;
    return { startDate: "2005-01-01", endDate: isoDaysAgo(1, now) };
  }
  const days = RANGE_DAYS[range];
  return {
    endDate: isoDaysAgo(1 + offsetWindows * days, now),
    startDate: isoDaysAgo(days + offsetWindows * days, now),
  };
}

/** Percent change vs the previous window. Null when both sides are zero. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function formatAdsMoney(amount: number, currency: string | null): string {
  const symbol = currency ? CURRENCY_SYMBOLS[currency] : undefined;
  const n = Number.isFinite(amount) ? amount : 0;
  if (symbol) return `${symbol}${n.toFixed(2)}`;
  return `${n.toFixed(2)} ${currency ?? ""}`.trim();
}

export function formatAdsInt(value: number): string {
  return Math.round(Number.isFinite(value) ? value : 0).toLocaleString("en-US");
}

/** GA4, GTM, Clarity, Meta Pixel. */
export function countTrackingIds(ids: {
  ga4: string;
  gtm: string;
  clarity: string;
  meta: string;
}): { ids: number; total: 4 } {
  const configured = [ids.ga4, ids.gtm, ids.clarity, ids.meta].filter((v) =>
    v.trim()
  ).length;
  return { ids: configured, total: 4 };
}

export function normalizeMetaAccountId(raw: string | null | undefined): string {
  const t = (raw || "").trim();
  if (!t || t === "all") return t;
  if (t.startsWith("act_")) return t;
  const digits = t.replace(/\D/g, "");
  return digits ? `act_${digits}` : "";
}
