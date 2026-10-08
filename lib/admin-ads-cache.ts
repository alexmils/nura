/**
 * Decision layer for admin Meta and Google Ads reports.
 * A fresh hit must not call the ads APIs. Refresh and a stale row do.
 * This module stays free of database and credential imports so tests and
 * the admin UI can use it.
 */

export const ADS_REPORT_TTL_MS = 6 * 60 * 60 * 1000;

const SECRET_KEYS = new Set([
  "accesstoken",
  "refreshtoken",
  "developertoken",
  "clientsecret",
  "appsecret",
  "private_key",
  "authorization",
  "client_secret",
]);

export type AdsReportSource = "cache" | "network" | "kept";

export type AdsReportHit<T> = {
  data: T;
  at: number;
  source: AdsReportSource;
};

export type AdsReportStore = {
  read<T>(key: string): Promise<{ at: number; data: T } | null>;
  write(key: string, data: unknown, at: number): Promise<void>;
};

export function metaAdsCacheKey(account: string, range: string): string {
  return `meta:${account || "auto"}:${range}`;
}

export function googleAdsCacheKey(customerId: string, range: string): string {
  return `gads:${customerId}:${range}`;
}

/** True when the next read must call Meta or Google. */
export function adsReportShouldFetch(input: {
  cachedAt: number | null;
  now: number;
  refresh: boolean;
  ttlMs?: number;
}): boolean {
  if (input.refresh) return true;
  if (input.cachedAt == null || !Number.isFinite(input.cachedAt)) return true;
  const ttl = input.ttlMs ?? ADS_REPORT_TTL_MS;
  return input.now - input.cachedAt > ttl;
}

export function stripAdsCacheSecrets<T>(value: T): T {
  return stripValue(value) as T;
}

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValue);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key.toLowerCase())) continue;
    out[key] = stripValue(child);
  }
  return out;
}

/**
 * Read a fresh row, or fetch. A failed fetch keeps the previous row and
 * does not write. Callers must not delete the stored report on failure.
 */
export async function loadThroughAdsCache<T>(input: {
  key: string;
  store: AdsReportStore;
  now: number;
  refresh: boolean;
  ttlMs?: number;
  fetchReport: () => Promise<T>;
  failed?: (data: T) => boolean;
}): Promise<AdsReportHit<T>> {
  const cached = await input.store.read<T>(input.key);
  const fetchNow = adsReportShouldFetch({
    cachedAt: cached?.at ?? null,
    now: input.now,
    refresh: input.refresh,
    ttlMs: input.ttlMs,
  });
  if (!fetchNow && cached) {
    return { data: cached.data, at: cached.at, source: "cache" };
  }

  try {
    const data = await input.fetchReport();
    if (input.failed?.(data)) {
      if (cached) return { data: cached.data, at: cached.at, source: "kept" };
      return { data, at: input.now, source: "network" };
    }
    try {
      await input.store.write(input.key, stripAdsCacheSecrets(data), input.now);
    } catch (err) {
      console.error("[admin-ads-cache] write failed", err);
    }
    return { data, at: input.now, source: "network" };
  } catch (err) {
    if (cached) return { data: cached.data, at: cached.at, source: "kept" };
    throw err;
  }
}

export function formatAdsUpdatedAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Updated just now";
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours <= 1) return "Updated 1 hour ago";
  if (hours < 24) return `Updated ${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}
