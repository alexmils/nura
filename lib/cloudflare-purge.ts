/**
 * Cloudflare edge purge after marketing edits.
 *
 * Public pages are ISR (`revalidate = 3600`), so Next sends
 * `s-maxage=3600, stale-while-revalidate=...` and Cloudflare caches both the
 * HTML and the RSC payloads that `router.refresh()` fetches. `revalidatePath`
 * only clears Next's own cache, so without this an admin's save kept showing
 * the pre-save page (and the editor's refresh snapped back to it).
 *
 * We purge everything rather than a URL list: the RSC variants are keyed by an
 * `_rsc` hash per router state and cannot be enumerated, a marketing save is
 * revalidated site-wide anyway (`revalidatePath("/", "layout")`), and prefix
 * purges need an Enterprise zone. Static assets are content-hashed, so the
 * only cost is a few cache misses.
 *
 * Runtime env (same names as the CI purge step): CF_ZONE_ID and CF_API_TOKEN
 * (CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN also work). When unset (local
 * dev) this is a no-op. It never throws: a failed purge is logged and the
 * save still succeeds.
 */

const PURGE_TIMEOUT_MS = 5000;

let inFlight: Promise<boolean> | null = null;

function purgeConfig(): { zone: string; token: string } | null {
  const zone = (process.env.CF_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || "").trim();
  const token = (process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "").trim();
  if (!zone || !token) return null;
  return { zone, token };
}

async function purgeEverything(zone: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
      signal: AbortSignal.timeout(PURGE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[cloudflare-purge] purge failed", res.status, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cloudflare-purge] purge failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Purges the Cloudflare cache after a marketing save. Resolves to true when a
 * purge succeeded, false when it failed or is not configured. Never rejects.
 * Concurrent saves share one request.
 */
export async function purgeMarketingCache(reason = "marketing"): Promise<boolean> {
  const config = purgeConfig();
  if (!config) return false;
  if (!inFlight) {
    inFlight = purgeEverything(config.zone, config.token).finally(() => {
      inFlight = null;
    });
  }
  const ok = await inFlight;
  if (ok) console.info(`[cloudflare-purge] purged after ${reason}`);
  return ok;
}
