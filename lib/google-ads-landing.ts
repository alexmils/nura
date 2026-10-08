/** Hostname from an ad or asset-group final URL, without a leading www. */
export function landingHost(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

/** Unique landing hosts, first seen first. */
export function collectLandingHosts(urls: Iterable<unknown>, limit = 4): string[] {
  const hosts: string[] = [];
  for (const url of urls) {
    if (typeof url !== "string") continue;
    const host = landingHost(url);
    if (!host || hosts.includes(host)) continue;
    hosts.push(host);
    if (hosts.length >= limit) break;
  }
  return hosts;
}

type LandingRow = {
  campaign?: { id?: unknown };
  adGroupAd?: { ad?: { finalUrls?: unknown } };
  assetGroup?: { finalUrls?: unknown };
};

/** Campaign id → landing hosts from Search ads and Performance Max asset groups. */
export function indexLandingHosts(rows: LandingRow[], limit = 4): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const id = String(row.campaign?.id ?? "");
    if (!id) continue;
    const urls: unknown[] = [...(map.get(id) ?? [])];
    const adUrls = row.adGroupAd?.ad?.finalUrls;
    const assetUrls = row.assetGroup?.finalUrls;
    if (Array.isArray(adUrls)) urls.push(...adUrls);
    if (Array.isArray(assetUrls)) urls.push(...assetUrls);
    const hosts = collectLandingHosts(urls, limit);
    if (hosts.length) map.set(id, hosts);
  }
  return map;
}
