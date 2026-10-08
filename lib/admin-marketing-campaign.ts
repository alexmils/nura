import type { AdsRange } from "@/lib/ads-range";
import type {
  GoogleAdsCampaign,
  MarketingDay,
  MarketingLine,
  MetaAdsCampaign,
} from "@/lib/admin-marketing-types";
import { formatAdsInt, formatAdsMoney } from "@/lib/admin-marketing-window";

export type CampaignMetric = {
  label: string;
  value: string;
};

export type MarketingCampaignView = {
  channel: "google" | "meta";
  id: string;
  name: string;
  status: string;
  typeLabel: string | null;
  sites: string[];
  currency: string | null;
  range: AdsRange;
  metrics: CampaignMetric[];
  lines: MarketingLine[];
  series: MarketingDay[];
  linesTitle: string;
  error: string | null;
};

const GOOGLE_TYPES: Record<string, string> = {
  SEARCH: "Search",
  DISPLAY: "Display",
  PERFORMANCE_MAX: "Performance Max",
  VIDEO: "Video",
  SHOPPING: "Shopping",
  DEMAND_GEN: "Demand Gen",
};

export function isCampaignId(id: string): boolean {
  return /^[0-9]+$/.test(id);
}

export function adsStatusLabel(status: string): string {
  const raw = status.replace(/_/g, " ").trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function googleTypeLabel(channelType: string): string | null {
  if (!channelType || channelType === "UNKNOWN") return null;
  return GOOGLE_TYPES[channelType] ?? adsStatusLabel(channelType);
}

export function metaObjectiveLabel(objective: string | null): string | null {
  if (!objective) return null;
  const raw = objective.replace(/^OUTCOME_/, "").replace(/_/g, " ").trim().toLowerCase();
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Account daily totals belong to one campaign only when it is the only campaign. */
export function accountSeriesForOnlyCampaign(
  campaignIds: string[],
  campaignId: string,
  series: MarketingDay[]
): MarketingDay[] | null {
  if (campaignIds.length === 1 && campaignIds[0] === campaignId && series.length > 1) {
    return series;
  }
  return null;
}

export function campaignSeriesCacheKey(
  channel: "google" | "meta",
  scope: string,
  campaignId: string,
  range: string
): string {
  const prefix = channel === "google" ? "gads-camp" : "meta-camp";
  return `${prefix}:${scope}:${campaignId}:${range}`;
}

export function marketingTabHref(channel: "google" | "meta", range: AdsRange): string {
  const params = new URLSearchParams();
  if (channel === "google") params.set("tab", "google");
  if (range !== "28") params.set("range", range);
  const q = params.toString();
  return q ? `/admin/marketing?${q}` : "/admin/marketing";
}

export function marketingCampaignHref(input: {
  id: string;
  channel: "google" | "meta";
  range: AdsRange;
  account?: string;
}): string {
  const params = new URLSearchParams();
  params.set("channel", input.channel);
  if (input.channel === "google") params.set("tab", "google");
  if (input.range !== "28") params.set("range", input.range);
  if (input.account) params.set("account", input.account);
  return `/admin/marketing/campaign/${encodeURIComponent(input.id)}?${params.toString()}`;
}

export function missingCampaignView(
  channel: "google" | "meta",
  id: string,
  range: AdsRange,
  error: string
): MarketingCampaignView {
  return {
    channel,
    id,
    name: "",
    status: "",
    typeLabel: null,
    sites: [],
    currency: null,
    range,
    metrics: [],
    lines: [],
    series: [],
    linesTitle: channel === "google" ? "Ad groups" : "Ads",
    error,
  };
}

export function buildGoogleCampaignView(
  campaign: GoogleAdsCampaign,
  lines: MarketingLine[],
  series: MarketingDay[],
  currency: string | null,
  range: AdsRange
): MarketingCampaignView {
  const metrics: CampaignMetric[] = [];
  if (!campaign.noDelivery) {
    metrics.push(
      { label: "Spend", value: formatAdsMoney(campaign.cost, currency) },
      { label: "Impressions", value: formatAdsInt(campaign.impressions) },
      { label: "Clicks", value: formatAdsInt(campaign.clicks) },
      { label: "CTR", value: `${campaign.ctr.toFixed(2)}%` },
      { label: "CPC", value: formatAdsMoney(campaign.averageCpc, currency) },
      { label: "Conversions", value: campaign.conversions.toFixed(1) },
      { label: "Conversion value", value: formatAdsMoney(campaign.conversionsValue, currency) }
    );
  }
  return {
    channel: "google",
    id: campaign.id,
    name: campaign.name,
    status: adsStatusLabel(campaign.status),
    typeLabel: googleTypeLabel(campaign.channelType),
    sites: campaign.sites,
    currency,
    range,
    metrics,
    lines,
    series,
    linesTitle: "Ad groups",
    error: null,
  };
}

export function buildMetaCampaignView(
  campaign: MetaAdsCampaign,
  lines: MarketingLine[],
  series: MarketingDay[],
  currency: string | null,
  range: AdsRange
): MarketingCampaignView {
  const metrics: CampaignMetric[] = [];
  if (!campaign.noDelivery) {
    metrics.push(
      { label: "Spend", value: formatAdsMoney(campaign.spend, currency) },
      { label: "Impressions", value: formatAdsInt(campaign.impressions) },
      { label: "Reach", value: formatAdsInt(campaign.reach) },
      { label: "Clicks", value: formatAdsInt(campaign.clicks) },
      { label: "CTR", value: `${campaign.ctr.toFixed(2)}%` },
      { label: "CPC", value: formatAdsMoney(campaign.cpc, currency) },
      { label: "CPM", value: formatAdsMoney(campaign.cpm, currency) }
    );
  }
  const sites = campaign.pages.length > 0 ? campaign.pages : [];
  return {
    channel: "meta",
    id: campaign.id,
    name: campaign.name,
    status: adsStatusLabel(campaign.status),
    typeLabel: metaObjectiveLabel(campaign.objective),
    sites,
    currency,
    range,
    metrics,
    lines,
    series,
    linesTitle: "Ads",
    error: null,
  };
}
