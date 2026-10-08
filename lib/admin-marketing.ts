/**
 * Admin overview cards: Search Console, Meta Ads, Google Ads.
 * Missing credentials return a disconnected shape. Failures stay on the card.
 */

import { google } from "googleapis";
import type { JWT } from "google-auth-library";
import { ADS_ALL_ACCOUNTS, type AdsRange } from "@/lib/ads-range";
import type {
  DashboardAds,
  DashboardGoogleAds,
  DashboardSeo,
  GoogleAdsCampaign,
  GoogleAdsTotals,
  MarketingOverview,
  MetaAdsAccountOption,
  MetaAdsCampaign,
  MetaAdsTotals,
  SeoMetricTotals,
} from "@/lib/admin-marketing-types";
import {
  adsRangeDays,
  adsWindow,
  countTrackingIds,
  normalizeMetaAccountId,
  pctDelta,
} from "@/lib/admin-marketing-window";
import { mintGoogleAdsAccessToken } from "@/lib/conversions/google-ads";
import { ensureFreshMetaAdsToken } from "@/lib/meta-ads-refresh";
import type { MetaAdsSettings } from "@/lib/meta-ads-settings";
import { getPlatformSettings } from "@/lib/platform-settings";
import type { PlatformSeoConfig } from "@/lib/seo-config";

const CACHE_TTL_MS = 10 * 60 * 1000;
const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DEFAULT_ADS_API = "v21";

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.data as T;
}

function writeCache(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

export function clearMarketingCache(): void {
  cache.clear();
}

function loadJwt(json: string): JWT | null {
  const t = json.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return new google.auth.JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
  } catch {
    return null;
  }
}

function rowTotals(row: {
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
} | undefined): SeoMetricTotals {
  return {
    clicks: Math.round(Number(row?.clicks || 0)),
    impressions: Math.round(Number(row?.impressions || 0)),
    ctr: Number(row?.ctr || 0),
    position: Number(row?.position || 0),
  };
}

async function loadSeo(seo: PlatformSeoConfig, refresh: boolean): Promise<DashboardSeo> {
  const tracking = countTrackingIds({
    ga4: seo.ga4MeasurementId,
    gtm: seo.gtmId,
    clarity: seo.clarityId,
    meta: seo.metaPixelId,
  });
  const siteUrl = seo.gscProperty.trim() || null;
  const window = adsWindow("28");
  const empty: DashboardSeo = {
    connected: false,
    siteUrl,
    rangeDays: 28,
    startDate: window?.startDate ?? "",
    endDate: window?.endDate ?? "",
    totals: null,
    delta: { clicks: null, impressions: null },
    daily: [],
    topPages: [],
    tracking,
    error: null,
  };

  const auth = loadJwt(seo.googleServiceAccountJson);
  if (!auth || !siteUrl || !window) return empty;

  const cacheKey = `seo:${siteUrl}`;
  if (!refresh) {
    const hit = readCache<DashboardSeo>(cacheKey);
    if (hit) return { ...hit, tracking };
  }

  const prev = adsWindow("28", 1);
  try {
    const searchconsole = google.searchconsole({ version: "v1", auth });
    const query = (
      startDate: string,
      endDate: string,
      dimensions?: string[],
      rowLimit = 28
    ) =>
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          type: "web",
        },
      });

    const [totalsRes, prevRes, dailyRes, pagesRes] = await Promise.all([
      query(window.startDate, window.endDate, undefined, 1),
      prev
        ? query(prev.startDate, prev.endDate, undefined, 1)
        : Promise.resolve(null),
      query(window.startDate, window.endDate, ["date"], 100),
      query(window.startDate, window.endDate, ["page"], 5),
    ]);

    const totals = rowTotals(totalsRes.data.rows?.[0]);
    const previous = rowTotals(prevRes?.data.rows?.[0]);
    const data: DashboardSeo = {
      ...empty,
      connected: true,
      totals,
      delta: {
        clicks: pctDelta(totals.clicks, previous.clicks),
        impressions: pctDelta(totals.impressions, previous.impressions),
      },
      daily: (dailyRes.data.rows || [])
        .map((row) => ({
          date: String(row.keys?.[0] || ""),
          impressions: Math.round(Number(row.impressions || 0)),
          clicks: Math.round(Number(row.clicks || 0)),
        }))
        .filter((day) => day.date)
        .sort((a, b) => a.date.localeCompare(b.date)),
      topPages: (pagesRes.data.rows || []).map((row) => ({
        page: String(row.keys?.[0] || ""),
        clicks: Math.round(Number(row.clicks || 0)),
        impressions: Math.round(Number(row.impressions || 0)),
        position: Number(row.position || 0),
      })),
      error: null,
    };
    writeCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[admin-marketing] Search Console failed", err);
    return {
      ...empty,
      connected: true,
      error: "Could not load Search Console. Check the service account on Connections.",
    };
  }
}

type GraphBody = {
  data?: Array<Record<string, unknown>>;
  error?: { message?: string };
  name?: string;
  id?: string;
  currency?: string;
  account_id?: string;
};

async function graph(
  token: string,
  path: string,
  search: Record<string, string>
): Promise<GraphBody> {
  const query = new URLSearchParams({ ...search, access_token: token });
  const res = await fetch(`${GRAPH}/${path}?${query.toString()}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as GraphBody | null;
  if (!res.ok || !body || body.error) {
    throw new Error(body?.error?.message || `Meta API returned ${res.status}`);
  }
  return body;
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metaWindowParams(range: AdsRange): Record<string, string> {
  const window = adsWindow(range);
  if (!window || range === "all") return { date_preset: "maximum" };
  return {
    time_range: JSON.stringify({ since: window.startDate, until: window.endDate }),
  };
}

async function listMetaAccounts(token: string): Promise<MetaAdsAccountOption[]> {
  const body = await graph(token, "me/adaccounts", {
    fields: "name,account_id,account_status,currency",
    limit: "100",
  });
  const hidden = new Set(
    (process.env.META_ADS_HIDDEN_ACCOUNTS ?? "")
      .split(",")
      .map((id) => normalizeMetaAccountId(id))
      .filter(Boolean)
  );
  return (body.data ?? [])
    .filter((row) => Number(row.account_status) === 1)
    .map((row) => ({
      id: normalizeMetaAccountId(String(row.account_id || row.id || "")),
      name: String(row.name || "(unnamed account)"),
      currency: row.currency ? String(row.currency) : null,
    }))
    .filter((account) => account.id && !hidden.has(account.id));
}

async function pageNames(token: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const body = await graph(token, "me/accounts", { fields: "id,name", limit: "100" });
    for (const page of body.data ?? []) {
      const id = String(page.id || "");
      const name = String(page.name || "");
      if (id && name) names.set(id, name);
    }
  } catch {
    // Token without pages permission still returns campaign numbers.
  }
  return names;
}

function totalsFromInsight(row: Record<string, unknown> | undefined): MetaAdsTotals {
  return {
    spend: num(row?.spend),
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    clicks: num(row?.clicks),
    ctr: num(row?.ctr),
    cpc: num(row?.cpc),
    cpm: num(row?.cpm),
  };
}

async function loadAccountCampaigns(
  token: string,
  accountId: string,
  accountName: string,
  range: AdsRange,
  wantPrevious: boolean,
  pages: Map<string, string>
): Promise<{
  campaigns: MetaAdsCampaign[];
  totals: MetaAdsTotals;
  previous: MetaAdsTotals | null;
  startDate: string;
  endDate: string;
}> {
  const window = adsWindow(range);
  const prev = wantPrevious ? adsWindow(range, 1) : null;
  const current = metaWindowParams(range);

  const [insights, previous, campaignInsights, campaignList, ads] = await Promise.all([
    graph(token, `${accountId}/insights`, {
      fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,date_start,date_stop",
      level: "account",
      ...current,
    }),
    prev
      ? graph(token, `${accountId}/insights`, {
          fields: "spend,impressions,clicks",
          level: "account",
          time_range: JSON.stringify({ since: prev.startDate, until: prev.endDate }),
        })
      : Promise.resolve({ data: [] } as GraphBody),
    graph(token, `${accountId}/insights`, {
      fields: "campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm",
      level: "campaign",
      ...current,
      limit: "50",
    }),
    graph(token, `${accountId}/campaigns`, {
      fields: "id,name,status,effective_status,objective",
      limit: "100",
    }),
    graph(token, `${accountId}/ads`, {
      fields: "campaign_id,creative{object_story_spec{page_id,instagram_user_id}}",
      limit: "200",
    }).catch(() => ({ data: [] }) as GraphBody),
  ]);

  const pageIds = new Map<string, Set<string>>();
  const instagram = new Set<string>();
  for (const ad of ads.data ?? []) {
    const campaignId = String(ad.campaign_id || "");
    const spec = (ad.creative as { object_story_spec?: { page_id?: string; instagram_user_id?: string } } | undefined)
      ?.object_story_spec;
    if (!campaignId || !spec) continue;
    if (spec.page_id) {
      const set = pageIds.get(campaignId) ?? new Set<string>();
      set.add(spec.page_id);
      pageIds.set(campaignId, set);
    }
    if (spec.instagram_user_id) instagram.add(campaignId);
  }

  const insightById = new Map<string, Record<string, unknown>>();
  for (const row of campaignInsights.data ?? []) {
    const id = String(row.campaign_id || "");
    if (id) insightById.set(id, row);
  }

  const pagesFor = (id: string) =>
    [...(pageIds.get(id) ?? [])].map((pageId) => pages.get(pageId) || `Page ${pageId}`);

  const fromList: MetaAdsCampaign[] = (campaignList.data ?? []).map((row) => {
    const id = String(row.id || "unknown");
    const insight = insightById.get(id);
    if (insight) insightById.delete(id);
    const metrics = totalsFromInsight(insight);
    return {
      id,
      name: String(row.name || "(unnamed campaign)"),
      accountId,
      accountName,
      pages: pagesFor(id),
      hasInstagram: instagram.has(id),
      status: String(row.effective_status || row.status || "UNKNOWN"),
      objective: row.objective ? String(row.objective) : null,
      noDelivery: !insight,
      ...metrics,
    };
  });

  const orphans: MetaAdsCampaign[] = [...insightById.values()].map((insight) => {
    const id = String(insight.campaign_id || "unknown");
    return {
      id,
      name: String(insight.campaign_name || "(unnamed campaign)"),
      accountId,
      accountName,
      pages: pagesFor(id),
      hasInstagram: instagram.has(id),
      status: "UNKNOWN",
      objective: null,
      noDelivery: false,
      ...totalsFromInsight(insight),
    };
  });

  const live = new Set([
    "ACTIVE",
    "PAUSED",
    "CAMPAIGN_PAUSED",
    "ADSET_PAUSED",
    "IN_PROCESS",
    "WITH_ISSUES",
    "PENDING_REVIEW",
  ]);
  const kept = [...fromList, ...orphans]
    .filter((c) => !c.noDelivery || live.has(c.status))
    .sort((a, b) => b.spend - a.spend);

  const row = insights.data?.[0];
  return {
    campaigns: kept,
    totals: totalsFromInsight(row),
    previous: wantPrevious ? totalsFromInsight(previous.data?.[0]) : null,
    startDate: String(row?.date_start || window?.startDate || ""),
    endDate: String(row?.date_stop || window?.endDate || ""),
  };
}

function emptyMeta(range: AdsRange, accountId: string | null): DashboardAds {
  const window = adsWindow(range);
  return {
    configured: false,
    accountId,
    scope: accountId === ADS_ALL_ACCOUNTS ? "all" : "account",
    accountName: null,
    currency: null,
    accounts: [],
    range,
    rangeDays: adsRangeDays(range),
    startDate: window?.startDate ?? "",
    endDate: window?.endDate ?? "",
    totals: null,
    delta: { spend: null, impressions: null, clicks: null },
    campaigns: [],
    error: null,
    notice: null,
  };
}

async function loadMeta(
  ads: MetaAdsSettings,
  capiToken: string,
  range: AdsRange,
  requestedAccount: string | null,
  refresh: boolean
): Promise<DashboardAds> {
  let creds = ads;
  try {
    creds = await ensureFreshMetaAdsToken(ads);
  } catch (err) {
    console.error("[admin-marketing] Meta token check failed", err);
  }
  const token = creds.accessToken || capiToken.trim() || null;
  const envAccount = normalizeMetaAccountId(creds.accountId) || null;
  const wanted = requestedAccount || envAccount;
  const empty = emptyMeta(range, wanted);
  if (!token) return empty;

  const cacheKey = `meta:${wanted || "auto"}:${range}`;
  if (!refresh) {
    const hit = readCache<DashboardAds>(cacheKey);
    if (hit) return hit;
  }

  try {
    const accounts = await listMetaAccounts(token);
    if (accounts.length === 0) {
      return {
        ...empty,
        configured: true,
        error: "This token cannot see any active ad account.",
      };
    }

    const pages = await pageNames(token);
    const scopeAll = wanted === ADS_ALL_ACCOUNTS;

    if (!scopeAll) {
      const preferred =
        accounts.find((a) => a.id === wanted) ||
        accounts.find((a) => a.id === envAccount) ||
        accounts[0];
      const scoped = await loadAccountCampaigns(
        token,
        preferred.id,
        preferred.name,
        range,
        range !== "all",
        pages
      );
      const data: DashboardAds = {
        configured: true,
        accountId: preferred.id,
        scope: "account",
        accountName: preferred.name,
        currency: preferred.currency,
        accounts,
        range,
        rangeDays: adsRangeDays(range),
        startDate: scoped.startDate,
        endDate: scoped.endDate,
        totals: scoped.totals,
        delta: {
          spend: scoped.previous
            ? pctDelta(scoped.totals.spend, scoped.previous.spend)
            : null,
          impressions: scoped.previous
            ? pctDelta(scoped.totals.impressions, scoped.previous.impressions)
            : null,
          clicks: scoped.previous
            ? pctDelta(scoped.totals.clicks, scoped.previous.clicks)
            : null,
        },
        campaigns: scoped.campaigns,
        error: null,
        notice: null,
      };
      writeCache(cacheKey, data);
      return data;
    }

    const loaded = (
      await Promise.all(
        accounts.map((account) =>
          loadAccountCampaigns(
            token,
            account.id,
            account.name,
            range,
            false,
            pages
          ).catch((err) => {
            console.error(`[admin-marketing] ${account.id} failed`, err);
            return null;
          })
        )
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);
    if (loaded.length === 0) {
      return {
        ...empty,
        configured: true,
        accounts,
        error: "Could not load any ad account.",
      };
    }
    const spend = loaded.reduce((s, r) => s + r.totals.spend, 0);
    const impressions = loaded.reduce((s, r) => s + r.totals.impressions, 0);
    const clicks = loaded.reduce((s, r) => s + r.totals.clicks, 0);
    const reach = loaded.reduce((s, r) => s + r.totals.reach, 0);
    const data: DashboardAds = {
      configured: true,
      accountId: ADS_ALL_ACCOUNTS,
      scope: "all",
      accountName: `${accounts.length} accounts`,
      currency: accounts[0]?.currency ?? null,
      accounts,
      range,
      rangeDays: adsRangeDays(range),
      startDate: loaded[0]?.startDate ?? "",
      endDate: loaded[0]?.endDate ?? "",
      totals: {
        spend,
        impressions,
        reach,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      },
      delta: { spend: null, impressions: null, clicks: null },
      campaigns: loaded.flatMap((r) => r.campaigns).sort((a, b) => b.spend - a.spend),
      error: null,
      notice: null,
    };
    writeCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[admin-marketing] Meta Ads failed", err);
    return {
      ...empty,
      configured: true,
      error: err instanceof Error ? err.message : "Could not load Meta Ads.",
    };
  }
}

type AdsRow = Record<string, unknown>;

function micros(value: unknown): number {
  return num(value) / 1_000_000;
}

function googleTotals(row: AdsRow | undefined): GoogleAdsTotals {
  const metrics = (row?.metrics ?? {}) as Record<string, unknown>;
  return {
    cost: micros(metrics.costMicros),
    impressions: num(metrics.impressions),
    clicks: num(metrics.clicks),
    ctr: num(metrics.ctr) * 100,
    averageCpc: micros(metrics.averageCpc),
    conversions: num(metrics.conversions),
    conversionsValue: num(metrics.conversionsValue),
  };
}

async function adsSearch(
  apiVersion: string,
  customerId: string,
  query: string,
  accessToken: string,
  developerToken: string,
  loginCustomerId?: string
): Promise<AdsRow[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": developerToken,
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const rows: AdsRow[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 8; page++) {
    const res = await fetch(
      `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
        cache: "no-store",
      }
    );
    const body = (await res.json().catch(() => null)) as {
      results?: AdsRow[];
      nextPageToken?: string;
      error?: { message?: string; details?: Array<{ errors?: Array<{ message?: string }> }> };
    } | null;
    if (!res.ok || body?.error) {
      const detail = body?.error?.details?.[0]?.errors?.[0]?.message;
      throw new Error(detail || body?.error?.message || `Google Ads API returned ${res.status}`);
    }
    rows.push(...(body?.results ?? []));
    pageToken = body?.nextPageToken;
    if (!pageToken) break;
  }
  return rows;
}

function dateClause(range: AdsRange, offset = 0): string {
  const window = adsWindow(range, offset);
  if (!window) return "";
  return `segments.date BETWEEN '${window.startDate}' AND '${window.endDate}'`;
}

function emptyGoogle(range: AdsRange, customerId: string | null): DashboardGoogleAds {
  const window = adsWindow(range);
  return {
    connected: false,
    customerId,
    customerName: null,
    currency: null,
    range,
    rangeDays: adsRangeDays(range),
    startDate: range === "all" ? "" : window?.startDate ?? "",
    endDate: range === "all" ? "" : window?.endDate ?? "",
    totals: null,
    delta: { cost: null, impressions: null, clicks: null },
    campaigns: [],
    error: null,
    notice: null,
  };
}

async function loadGoogle(
  seo: PlatformSeoConfig,
  range: AdsRange,
  refresh: boolean
): Promise<DashboardGoogleAds> {
  const customerId = seo.googleAdsCustomerId.replace(/\D/g, "") || null;
  const empty = emptyGoogle(range, customerId);
  const ready = Boolean(
    customerId &&
      seo.googleAdsDeveloperToken.trim() &&
      seo.googleAdsOAuthClientId.trim() &&
      seo.googleAdsOAuthClientSecret.trim() &&
      seo.googleAdsOAuthRefreshToken.trim()
  );
  if (!ready || !customerId) return empty;

  const cacheKey = `gads:${customerId}:${range}`;
  if (!refresh) {
    const hit = readCache<DashboardGoogleAds>(cacheKey);
    if (hit) return hit;
  }

  const auth = await mintGoogleAdsAccessToken({
    clientId: seo.googleAdsOAuthClientId.trim(),
    clientSecret: seo.googleAdsOAuthClientSecret.trim(),
    refreshToken: seo.googleAdsOAuthRefreshToken.trim(),
  });
  if (!auth.token) {
    return {
      ...empty,
      connected: true,
      error: "Google Ads sign-in expired. Update the refresh token on Connections.",
    };
  }

  const apiVersion = seo.googleAdsApiVersion.trim() || DEFAULT_ADS_API;
  const login = seo.googleAdsLoginCustomerId.replace(/\D/g, "") || undefined;
  const where = dateClause(range);
  const previousWhere = range === "all" ? "" : dateClause(range, 1);

  try {
    const [customerRows, totalsRows, previousRows, metricRows, campaignRows] =
      await Promise.all([
        adsSearch(
          apiVersion,
          customerId,
          "SELECT customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1",
          auth.token,
          seo.googleAdsDeveloperToken.trim(),
          login
        ),
        adsSearch(
          apiVersion,
          customerId,
          `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM customer WHERE ${where}`,
          auth.token,
          seo.googleAdsDeveloperToken.trim(),
          login
        ),
        previousWhere
          ? adsSearch(
              apiVersion,
              customerId,
              `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks FROM customer WHERE ${previousWhere}`,
              auth.token,
              seo.googleAdsDeveloperToken.trim(),
              login
            )
          : Promise.resolve([] as AdsRow[]),
        adsSearch(
          apiVersion,
          customerId,
          `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM campaign WHERE ${where}`,
          auth.token,
          seo.googleAdsDeveloperToken.trim(),
          login
        ),
        adsSearch(
          apiVersion,
          customerId,
          "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign",
          auth.token,
          seo.googleAdsDeveloperToken.trim(),
          login
        ),
      ]);

    const customer = (customerRows[0]?.customer ?? {}) as Record<string, unknown>;
    if (customer.manager === true) {
      return {
        ...empty,
        connected: true,
        error:
          "This customer is a manager account. Set the Google Ads customer ID to a client account.",
      };
    }

    const metricsById = new Map<string, AdsRow>();
    for (const row of metricRows) {
      const id = String((row.campaign as { id?: unknown } | undefined)?.id ?? "");
      if (id) metricsById.set(id, row);
    }

    const campaigns: GoogleAdsCampaign[] = campaignRows.map((row) => {
      const campaign = (row.campaign ?? {}) as Record<string, unknown>;
      const id = String(campaign.id ?? "");
      const metricsRow = id ? metricsById.get(id) : undefined;
      if (id) metricsById.delete(id);
      const totals = googleTotals(metricsRow);
      return {
        id,
        name: String(campaign.name || "(unnamed campaign)"),
        status: String(campaign.status || "UNKNOWN"),
        channelType: String(campaign.advertisingChannelType || "UNKNOWN"),
        noDelivery: !metricsRow,
        ...totals,
      };
    });

    for (const row of metricsById.values()) {
      const campaign = (row.campaign ?? {}) as Record<string, unknown>;
      campaigns.push({
        id: String(campaign.id ?? ""),
        name: String(campaign.name || "(unnamed campaign)"),
        status: String(campaign.status || "UNKNOWN"),
        channelType: String(campaign.advertisingChannelType || "UNKNOWN"),
        noDelivery: false,
        ...googleTotals(row),
      });
    }
    campaigns.sort((a, b) => b.cost - a.cost);

    const totals = googleTotals(totalsRows[0]);
    const previous = previousWhere ? googleTotals(previousRows[0]) : null;
    const shown = adsWindow(range);
    const data: DashboardGoogleAds = {
      connected: true,
      customerId,
      customerName: customer.descriptiveName ? String(customer.descriptiveName) : null,
      currency: customer.currencyCode ? String(customer.currencyCode) : null,
      range,
      rangeDays: adsRangeDays(range),
      startDate: range === "all" ? "" : shown?.startDate ?? "",
      endDate: range === "all" ? "" : shown?.endDate ?? "",
      totals,
      delta: {
        cost: previous ? pctDelta(totals.cost, previous.cost) : null,
        impressions: previous ? pctDelta(totals.impressions, previous.impressions) : null,
        clicks: previous ? pctDelta(totals.clicks, previous.clicks) : null,
      },
      campaigns,
      error: null,
      notice: null,
    };
    writeCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[admin-marketing] Google Ads failed", err);
    return {
      ...empty,
      connected: true,
      error: err instanceof Error ? err.message : "Could not load Google Ads.",
    };
  }
}

export async function loadMarketingOverview(input: {
  metaRange: AdsRange;
  metaAccount: string | null;
  googleRange: AdsRange;
  refresh?: "seo" | "meta" | "google" | null;
}): Promise<MarketingOverview> {
  const settings = await getPlatformSettings();
  const seo = settings.seo;
  const [seoCard, meta, googleAds] = await Promise.all([
    loadSeo(seo, input.refresh === "seo"),
    loadMeta(
      settings.metaAds,
      seo.metaCapiAccessToken,
      input.metaRange,
      input.metaAccount,
      input.refresh === "meta"
    ),
    loadGoogle(seo, input.googleRange, input.refresh === "google"),
  ]);
  return { seo: seoCard, meta, google: googleAds };
}
