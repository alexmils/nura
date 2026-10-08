import type { AdsRange } from "@/lib/ads-range";

export type SeoMetricTotals = {
  clicks: number;
  impressions: number;
  /** Ratio 0–1, as Search Console returns it. */
  ctr: number;
  position: number;
};

export type DashboardSeo = {
  connected: boolean;
  siteUrl: string | null;
  rangeDays: number;
  startDate: string;
  endDate: string;
  totals: SeoMetricTotals | null;
  delta: { clicks: number | null; impressions: number | null };
  daily: Array<{ date: string; impressions: number; clicks: number }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  tracking: { ids: number; total: 4 };
  error: string | null;
};

export type MetaAdsCampaign = {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  pages: string[];
  hasInstagram: boolean;
  status: string;
  objective: string | null;
  noDelivery: boolean;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export type MetaAdsTotals = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export type MetaAdsAccountOption = {
  id: string;
  name: string;
  currency: string | null;
};

export type DashboardAds = {
  configured: boolean;
  accountId: string | null;
  scope: "account" | "all";
  accountName: string | null;
  currency: string | null;
  accounts: MetaAdsAccountOption[];
  range: AdsRange;
  rangeDays: number | null;
  startDate: string;
  endDate: string;
  totals: MetaAdsTotals | null;
  delta: { spend: number | null; impressions: number | null; clicks: number | null };
  campaigns: MetaAdsCampaign[];
  error: string | null;
  notice: string | null;
};

export type GoogleAdsCampaign = {
  id: string;
  name: string;
  status: string;
  channelType: string;
  noDelivery: boolean;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  averageCpc: number;
  conversions: number;
  conversionsValue: number;
};

export type GoogleAdsTotals = {
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  averageCpc: number;
  conversions: number;
  conversionsValue: number;
};

export type DashboardGoogleAds = {
  connected: boolean;
  customerId: string | null;
  customerName: string | null;
  currency: string | null;
  range: AdsRange;
  rangeDays: number | null;
  startDate: string;
  endDate: string;
  totals: GoogleAdsTotals | null;
  delta: { cost: number | null; impressions: number | null; clicks: number | null };
  campaigns: GoogleAdsCampaign[];
  error: string | null;
  notice: string | null;
};

export type MarketingOverview = {
  seo: DashboardSeo;
  meta: DashboardAds;
  google: DashboardGoogleAds;
};
