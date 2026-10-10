/**
 * Paused-only Google Ads payloads for the local MCP server.
 * The server reads credentials from the environment. This module never sees them.
 */
import { crc32, deflateSync } from "node:zlib";

export const PAUSED_CAMPAIGN_BUDGET_USD_MAX = 5;
export const ENGLISH_LANGUAGE = "languageConstants/1000";
export const NURA_GOOGLE_ADS_MCP_NAME = "Nura Google Ads";
export const NURA_GOOGLE_ADS_REPO_DEFAULT = "D:\\Python\\EMDR";

const NURA_AD_HOSTS = new Set(["nurahelp.com", "www.nurahelp.com"]);

export type PausedCampaignInput = {
  name: string;
  adGroupName: string;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  keyword?: string;
  dailyBudgetUsd?: number;
};

export type GoogleAdsEnvConfig = {
  customerId: string;
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  apiVersion: string;
  loginCustomerId: string;
};

const REQUIRED_ENV = [
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
] as const;

export function googleAdsConfigFromEnv(
  env: Record<string, string | undefined>
): { config?: GoogleAdsEnvConfig; missing: string[] } {
  const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim());
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/\D/g, "");
  if (!customerId) missing.push("GOOGLE_ADS_CUSTOMER_ID");
  if (missing.length) return { missing: [...new Set(missing)] };
  const version = env.GOOGLE_ADS_API_VERSION?.trim() || "v25";
  return {
    missing: [],
    config: {
      customerId,
      developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim(),
      clientId: env.GOOGLE_ADS_CLIENT_ID!.trim(),
      clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!.trim(),
      refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN!.trim(),
      apiVersion: /^v\d+$/.test(version) ? version : "v25",
      loginCustomerId: (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, ""),
    },
  };
}

export function validatePausedCampaign(input: PausedCampaignInput): string | null {
  const name = input.name.trim();
  const adGroupName = input.adGroupName.trim();
  if (!name) return "Campaign name is required.";
  if (name.length > 255) return "Campaign name is too long.";
  if (!adGroupName) return "Ad group name is required.";
  if (input.headlines.length < 3 || input.headlines.length > 15) {
    return "A responsive search ad needs 3 to 15 headlines.";
  }
  if (input.headlines.some((line) => !line.trim() || line.trim().length > 30)) {
    return "Each headline must be 1 to 30 characters.";
  }
  if (input.descriptions.length < 2 || input.descriptions.length > 4) {
    return "A responsive search ad needs 2 to 4 descriptions.";
  }
  if (input.descriptions.some((line) => !line.trim() || line.trim().length > 90)) {
    return "Each description must be 1 to 90 characters.";
  }
  const urlProblem = finalUrlProblem(input.finalUrl);
  if (urlProblem) return urlProblem;
  return dailyBudgetProblem(input.dailyBudgetUsd ?? 1, "created");
}

function dailyBudgetProblem(budget: number, action: "created" | "changed"): string | null {
  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    budget > PAUSED_CAMPAIGN_BUDGET_USD_MAX ||
    Math.round(budget * 1_000_000) < 1
  ) {
    const stopped = action === "created" ? "Nothing was created." : "Nothing was changed.";
    return `Daily budget must be greater than 0 and at most ${PAUSED_CAMPAIGN_BUDGET_USD_MAX} USD. ${stopped}`;
  }
  return null;
}

function finalUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "Final URL must be https on nurahelp.com.";
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !NURA_AD_HOSTS.has(host)) {
    return "Final URL must be https on nurahelp.com.";
  }
  return null;
}

export function buildPausedCampaignMutate(
  customerId: string,
  input: PausedCampaignInput,
  now = Date.now()
): { mutateOperations: Array<Record<string, unknown>> } {
  const problem = validatePausedCampaign(input);
  if (problem) throw new Error(problem);
  const budgetUsd = input.dailyBudgetUsd ?? 1;
  const budget = `customers/${customerId}/campaignBudgets/-1`;
  const campaign = `customers/${customerId}/campaigns/-2`;
  const adGroup = `customers/${customerId}/adGroups/-3`;
  const keyword = (input.keyword?.trim() || "nura").slice(0, 80);
  return {
    mutateOperations: [
      {
        campaignBudgetOperation: {
          create: {
            resourceName: budget,
            name: `${input.name.trim()} paused budget ${now}`,
            amountMicros: String(Math.round(budgetUsd * 1_000_000)),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      },
      {
        campaignOperation: {
          create: {
            resourceName: campaign,
            name: input.name.trim(),
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
            campaignBudget: budget,
            manualCpc: {},
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          },
        },
      },
      {
        campaignCriterionOperation: {
          create: {
            campaign,
            language: { languageConstant: ENGLISH_LANGUAGE },
          },
        },
      },
      {
        adGroupOperation: {
          create: {
            resourceName: adGroup,
            name: input.adGroupName.trim(),
            campaign,
            status: "PAUSED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: "1000000",
          },
        },
      },
      {
        adGroupCriterionOperation: {
          create: {
            adGroup,
            status: "PAUSED",
            keyword: { text: keyword, matchType: "PHRASE" },
          },
        },
      },
      {
        adGroupAdOperation: {
          create: {
            adGroup,
            status: "PAUSED",
            ad: {
              finalUrls: [input.finalUrl.trim()],
              responsiveSearchAd: {
                headlines: input.headlines.map((text) => ({ text: text.trim() })),
                descriptions: input.descriptions.map((text) => ({ text: text.trim() })),
              },
            },
          },
        },
      },
    ],
  };
}

export function campaignIdFromMutate(body: unknown): string | null {
  const rows = (body as { mutateOperationResponses?: Array<Record<string, { resourceName?: string }>> })
    .mutateOperationResponses;
  if (!rows) return null;
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const name = value?.resourceName ?? "";
      const match = name.match(/\/campaigns\/(\d+)$/);
      if (match) return match[1]!;
    }
  }
  return null;
}

export function redactSecrets(message: string, secrets: string[]): string {
  let out = message;
  for (const secret of secrets) {
    if (secret.length < 6) continue;
    out = out.split(secret).join("[redacted]");
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function metricInt(metrics: Record<string, unknown>, camel: string, snake: string): number {
  const value = metrics[camel] ?? metrics[snake];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return 0;
}

export function campaignIdFromRow(row: unknown): string {
  const id = asRecord(asRecord(row)?.campaign)?.id;
  if (typeof id === "number" && Number.isFinite(id)) return String(Math.trunc(id));
  if (typeof id === "string") return id.replace(/\D/g, "");
  return "";
}

/** Sum daily Google rows into one 7-day total. CTR is clicks / impressions. */
export function rollupCampaignWeek(rows: unknown[]): {
  days: number;
  costMicros: string;
  impressions: string;
  clicks: string;
  ctr: number | null;
} {
  let cost = 0;
  let impressions = 0;
  let clicks = 0;
  const dates = new Set<string>();
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const metrics = asRecord(rec.metrics) ?? {};
    cost += metricInt(metrics, "costMicros", "cost_micros");
    impressions += metricInt(metrics, "impressions", "impressions");
    clicks += metricInt(metrics, "clicks", "clicks");
    const date = asRecord(rec.segments)?.date;
    if (typeof date === "string" && date) dates.add(date);
  }
  return {
    days: dates.size,
    costMicros: String(cost),
    impressions: String(impressions),
    clicks: String(clicks),
    ctr: impressions > 0 ? clicks / impressions : null,
  };
}

/** Highest campaign ids first. Removed campaigns are left out. */
export function latestCampaignRows(rows: unknown[], limit = 20): unknown[] {
  const ranked = rows
    .map((row) => {
      const campaign = asRecord(asRecord(row)?.campaign);
      return { row, id: campaignIdFromRow(row), status: String(campaign?.status ?? "") };
    })
    .filter((item) => item.id && item.status !== "REMOVED");
  ranked.sort((a, b) => (a.id.length === b.id.length ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : b.id.length - a.id.length));
  return ranked.slice(0, limit).map((item) => item.row);
}

export type ExistingCampaignDecision =
  | { action: "create" }
  | { action: "reuse"; campaignId: string }
  | { action: "refuse"; campaignId: string; status: string };

/** A paused campaign with this name is reused. Any other live status blocks a second create. */
export function existingCampaignDecision(rows: unknown[]): ExistingCampaignDecision {
  const live = rows
    .map((row) => ({ id: campaignIdFromRow(row), status: String(asRecord(asRecord(row)?.campaign)?.status ?? "") }))
    .filter((item) => item.id && item.status !== "REMOVED");
  const paused = live.filter((item) => item.status === "PAUSED");
  if (paused.length) {
    paused.sort((a, b) => (a.id < b.id ? 1 : -1));
    return { action: "reuse", campaignId: paused[0]!.id };
  }
  const other = live[0];
  if (other) return { action: "refuse", campaignId: other.id, status: other.status };
  return { action: "create" };
}

export function gaqlQuote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function campaignByNameQuery(name: string): string {
  return `SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = ${gaqlQuote(name.trim())}`;
}

export function campaignLookupQuery(campaignId: string): string {
  if (!/^\d+$/.test(campaignId)) throw new Error("Campaign id must be digits.");
  return `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared FROM campaign WHERE campaign.id = ${campaignId}`;
}

export type CampaignUpdateInput = {
  name?: string;
  dailyBudgetUsd?: number;
  headlines?: string[];
  descriptions?: string[];
  finalUrl?: string;
  keyword?: string;
};

export function validateCampaignUpdate(input: CampaignUpdateInput): string | null {
  const hasName = input.name !== undefined;
  const hasBudget = input.dailyBudgetUsd !== undefined;
  const hasHeadlines = input.headlines !== undefined;
  const hasDescriptions = input.descriptions !== undefined;
  const hasUrl = input.finalUrl !== undefined;
  const hasKeyword = input.keyword !== undefined;
  if (!hasName && !hasBudget && !hasHeadlines && !hasDescriptions && !hasUrl && !hasKeyword) {
    return "Provide a name, budget, headlines, descriptions, final URL, or keyword. Nothing was changed.";
  }
  const name = input.name?.trim() ?? "";
  if (hasName && !name) return "Campaign name is required. Nothing was changed.";
  if (name.length > 255) return "Campaign name is too long. Nothing was changed.";
  if (hasBudget) {
    const budgetProblem = dailyBudgetProblem(input.dailyBudgetUsd as number, "changed");
    if (budgetProblem) return budgetProblem;
  }
  if (hasHeadlines) {
    const lines = input.headlines ?? [];
    if (lines.length < 3 || lines.length > 15) {
      return "A responsive search ad needs 3 to 15 headlines. Nothing was changed.";
    }
    if (lines.some((line) => !line.trim() || line.trim().length > 30)) {
      return "Each headline must be 1 to 30 characters. Nothing was changed.";
    }
  }
  if (hasDescriptions) {
    const lines = input.descriptions ?? [];
    if (lines.length < 2 || lines.length > 4) {
      return "A responsive search ad needs 2 to 4 descriptions. Nothing was changed.";
    }
    if (lines.some((line) => !line.trim() || line.trim().length > 90)) {
      return "Each description must be 1 to 90 characters. Nothing was changed.";
    }
  }
  if (hasUrl) {
    const urlProblem = finalUrlProblem(input.finalUrl ?? "");
    if (urlProblem) return `${urlProblem} Nothing was changed.`;
  }
  const keyword = input.keyword?.trim() ?? "";
  if (hasKeyword && (!keyword || keyword.length > 80)) {
    return "Keyword must be 1 to 80 characters. Nothing was changed.";
  }
  return null;
}

function budgetRecord(row: unknown): Record<string, unknown> | null {
  const rec = asRecord(row);
  return asRecord(rec?.campaignBudget) ?? asRecord(rec?.campaign_budget);
}

export function campaignBudgetResourceFromRow(row: unknown): string {
  const budget = budgetRecord(row);
  const name = budget?.resourceName ?? budget?.resource_name;
  return typeof name === "string" ? name : "";
}

export function campaignBudgetIsShared(row: unknown): boolean {
  const budget = budgetRecord(row);
  const value = budget?.explicitlyShared ?? budget?.explicitly_shared;
  return value === true;
}

export function campaignNameFromRow(row: unknown): string {
  const name = asRecord(asRecord(row)?.campaign)?.name;
  return typeof name === "string" ? name : "";
}

export function removalNameProblem(row: unknown, name: string): string | null {
  const expected = name.trim();
  if (!expected) return "Campaign name is required. Nothing was removed.";
  const actual = campaignNameFromRow(row);
  if (actual !== expected) return "Campaign name does not match this id. Nothing was removed.";
  return null;
}

export function campaignStatusFromRow(row: unknown): string {
  return String(asRecord(asRecord(row)?.campaign)?.status ?? "");
}

export function pausedCampaignGate(
  rows: unknown[],
  campaignId: string,
  verb: "changed" | "removed"
): { ok: true; budgetResourceName: string; explicitlyShared: boolean } | { ok: false; error: string } {
  const row = rows[0];
  if (!row) return { ok: false, error: `Campaign ${campaignId} was not found. Nothing was ${verb}.` };
  const status = campaignStatusFromRow(row);
  if (status !== "PAUSED") {
    return { ok: false, error: `Campaign ${campaignId} is ${status || "not paused"}. Nothing was ${verb}.` };
  }
  return {
    ok: true,
    budgetResourceName: campaignBudgetResourceFromRow(row),
    explicitlyShared: campaignBudgetIsShared(row),
  };
}

export function buildCampaignUpdateMutate(args: {
  campaignResourceName: string;
  budgetResourceName?: string;
  name?: string;
  dailyBudgetUsd?: number;
}): { mutateOperations: Array<Record<string, unknown>> } {
  const problem = validateCampaignUpdate(args);
  if (problem) throw new Error(problem);
  const ops: Array<Record<string, unknown>> = [];
  if (args.dailyBudgetUsd !== undefined) {
    if (!args.budgetResourceName) throw new Error("This campaign has no budget to update. Nothing was changed.");
    ops.push({
      campaignBudgetOperation: {
        update: {
          resourceName: args.budgetResourceName,
          amountMicros: String(Math.round(args.dailyBudgetUsd * 1_000_000)),
        },
        updateMask: "amountMicros",
      },
    });
  }
  if (args.name !== undefined) {
    ops.push({
      campaignOperation: {
        update: {
          resourceName: args.campaignResourceName,
          name: args.name.trim(),
        },
        updateMask: "name",
      },
    });
  }
  if (!ops.length) throw new Error("Nothing was changed.");
  return { mutateOperations: ops };
}

export function buildCampaignRemoveMutate(campaignResourceName: string): {
  mutateOperations: Array<Record<string, unknown>>;
} {
  if (!/^customers\/\d+\/campaigns\/\d+$/.test(campaignResourceName)) {
    throw new Error("Campaign id is required. Nothing was removed.");
  }
  return { mutateOperations: [{ campaignOperation: { remove: campaignResourceName } }] };
}

function digitsOnly(id: string, label: string): void {
  if (!/^\d+$/.test(id)) throw new Error(`${label} must be digits. Nothing was changed.`);
}

export function pausedAdQuery(campaignId: string): string {
  digitsOnly(campaignId, "Campaign id");
  return `SELECT ad_group_ad.ad.id, ad_group_ad.status FROM ad_group_ad WHERE campaign.id = ${campaignId} AND ad_group_ad.status = 'PAUSED'`;
}

export function pausedKeywordQuery(campaignId: string): string {
  digitsOnly(campaignId, "Campaign id");
  return `SELECT ad_group.id, ad_group_criterion.resource_name, ad_group_criterion.negative, ad_group_criterion.status FROM ad_group_criterion WHERE campaign.id = ${campaignId} AND ad_group_criterion.type = KEYWORD AND ad_group_criterion.status = 'PAUSED'`;
}

function nested(row: unknown, camel: string, snake: string): Record<string, unknown> | null {
  const rec = asRecord(row);
  return asRecord(rec?.[camel]) ?? asRecord(rec?.[snake]);
}

export function pausedAdIds(rows: unknown[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    const adGroupAd = nested(row, "adGroupAd", "ad_group_ad");
    if (String(adGroupAd?.status ?? "") !== "PAUSED") continue;
    const id = asRecord(adGroupAd?.ad)?.id;
    const text = typeof id === "number" ? String(Math.trunc(id)) : typeof id === "string" ? id.replace(/\D/g, "") : "";
    if (text) ids.push(text);
  }
  return ids;
}

export function pausedKeywordGroups(rows: unknown[]): Array<{ adGroupId: string; remove: string[] }> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const criterion = nested(row, "adGroupCriterion", "ad_group_criterion");
    const adGroup = nested(row, "adGroup", "ad_group");
    if (!criterion || String(criterion.status ?? "") !== "PAUSED" || criterion.negative === true) continue;
    const adGroupId = typeof adGroup?.id === "number" ? String(Math.trunc(adGroup.id)) : String(adGroup?.id ?? "").replace(/\D/g, "");
    const resourceName = typeof criterion.resourceName === "string" ? criterion.resourceName : typeof criterion.resource_name === "string" ? criterion.resource_name : "";
    if (!adGroupId || !/^customers\/\d+\/adGroupCriteria\/\d+~\d+$/.test(resourceName)) continue;
    const list = groups.get(adGroupId) ?? [];
    list.push(resourceName);
    groups.set(adGroupId, list);
  }
  return [...groups.entries()].map(([adGroupId, remove]) => ({ adGroupId, remove }));
}

export function buildAdUpdateMutate(
  customerId: string,
  adIds: string[],
  input: Pick<CampaignUpdateInput, "headlines" | "descriptions" | "finalUrl">
): { operations: Array<Record<string, unknown>> } {
  digitsOnly(customerId, "Customer id");
  if (!adIds.length) throw new Error("No paused ad to update. Nothing was changed.");
  const masks: string[] = [];
  const ad: Record<string, unknown> = {};
  if (input.finalUrl !== undefined) {
    ad.finalUrls = [input.finalUrl.trim()];
    masks.push("finalUrls");
  }
  const rsa: Record<string, unknown> = {};
  if (input.headlines) {
    rsa.headlines = input.headlines.map((text) => ({ text: text.trim() }));
    masks.push("responsiveSearchAd.headlines");
  }
  if (input.descriptions) {
    rsa.descriptions = input.descriptions.map((text) => ({ text: text.trim() }));
    masks.push("responsiveSearchAd.descriptions");
  }
  if (!masks.length) throw new Error("Nothing was changed.");
  if (Object.keys(rsa).length) ad.responsiveSearchAd = rsa;
  return {
    operations: adIds.map((adId) => {
      digitsOnly(adId, "Ad id");
      return {
        update: { resourceName: `customers/${customerId}/ads/${adId}`, ...structuredClone(ad) },
        updateMask: masks.join(","),
      };
    }),
  };
}

export function buildKeywordReplaceMutate(
  customerId: string,
  groups: Array<{ adGroupId: string; remove: string[] }>,
  keyword: string
): { mutateOperations: Array<Record<string, unknown>> } {
  digitsOnly(customerId, "Customer id");
  const text = keyword.trim();
  if (!groups.length) throw new Error("No paused keyword to replace. Nothing was changed.");
  const ops: Array<Record<string, unknown>> = [];
  for (const group of groups) {
    digitsOnly(group.adGroupId, "Ad group id");
    for (const resourceName of group.remove) {
      ops.push({ adGroupCriterionOperation: { remove: resourceName } });
    }
    ops.push({
      adGroupCriterionOperation: {
        create: {
          adGroup: `customers/${customerId}/adGroups/${group.adGroupId}`,
          status: "PAUSED",
          keyword: { text, matchType: "PHRASE" },
        },
      },
    });
  }
  return { mutateOperations: ops };
}

export type PausedSalesFormat = "search" | "performance_max";

export type PausedSalesInput = {
  format: PausedSalesFormat;
  name: string;
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
  dailyBudgetUsd?: number;
  adGroupName?: string;
  keyword?: string;
  longHeadline?: string;
  businessName?: string;
  assetGroupName?: string;
};

export function validatePausedSalesAd(input: PausedSalesInput): string | null {
  if (input.format !== "search" && input.format !== "performance_max") {
    return "Sales ad format must be search or performance_max. Nothing was created.";
  }
  if (input.format === "search") {
    return validatePausedCampaign({
      name: input.name,
      adGroupName: input.adGroupName ?? "",
      headlines: input.headlines,
      descriptions: input.descriptions,
      finalUrl: input.finalUrl,
      keyword: input.keyword,
      dailyBudgetUsd: input.dailyBudgetUsd,
    });
  }
  const name = input.name.trim();
  if (!name) return "Campaign name is required.";
  if (name.length > 255) return "Campaign name is too long.";
  const urlProblem = finalUrlProblem(input.finalUrl);
  if (urlProblem) return urlProblem;
  if (input.headlines.length < 3 || input.headlines.length > 15) {
    return "A sales ad needs 3 to 15 headlines.";
  }
  if (input.headlines.some((line) => !line.trim() || line.trim().length > 30)) {
    return "Each headline must be 1 to 30 characters.";
  }
  if (input.descriptions.length < 2 || input.descriptions.length > 4) {
    return "A sales ad needs 2 to 4 descriptions.";
  }
  if (input.descriptions.some((line) => !line.trim() || line.trim().length > 90)) {
    return "Each description must be 1 to 90 characters.";
  }
  if (!input.descriptions.some((line) => line.trim().length > 0 && line.trim().length <= 60)) {
    return "Performance Max needs one description of 60 characters or fewer. Nothing was created.";
  }
  const longHeadline = input.longHeadline?.trim() ?? "";
  if (!longHeadline || longHeadline.length > 90) {
    return "Performance Max needs one long headline of 1 to 90 characters. Nothing was created.";
  }
  const businessName = (input.businessName?.trim() || "Nura");
  if (!businessName || businessName.length > 25) {
    return "Business name must be 1 to 25 characters. Nothing was created.";
  }
  return dailyBudgetProblem(input.dailyBudgetUsd ?? 1, "created");
}

type SalesToolFields = {
  format?: string;
  name?: string;
  finalUrl?: string;
  final_url?: string;
  headlines?: string[];
  descriptions?: string[];
  dailyBudgetUsd?: number;
  daily_budget_usd?: number;
  adGroupName?: string;
  ad_group_name?: string;
  keyword?: string;
  longHeadline?: string;
  long_headline?: string;
  businessName?: string;
  business_name?: string;
  assetGroupName?: string;
  asset_group_name?: string;
};

/** Accept camelCase and snake_case. The tool schema must list both or Zod drops the snake_case keys. */
export function pausedSalesInput(raw: SalesToolFields): PausedSalesInput {
  const budget = raw.dailyBudgetUsd ?? raw.daily_budget_usd;
  const format = raw.format === "performance_max" ? "performance_max" : "search";
  return {
    format,
    name: raw.name ?? "",
    finalUrl: raw.finalUrl ?? raw.final_url ?? "",
    headlines: raw.headlines ?? [],
    descriptions: raw.descriptions ?? [],
    dailyBudgetUsd: budget,
    adGroupName: raw.adGroupName ?? raw.ad_group_name,
    keyword: raw.keyword,
    longHeadline: raw.longHeadline ?? raw.long_headline,
    businessName: raw.businessName ?? raw.business_name,
    assetGroupName: raw.assetGroupName ?? raw.asset_group_name,
  };
}

export function resolvedAssetGroupName(input: PausedSalesInput): string {
  return (input.assetGroupName?.trim() || `${input.name.trim()} pages`).slice(0, 255);
}

export function assetGroupReadQuery(campaignId: string): string {
  if (!/^\d+$/.test(campaignId)) throw new Error("Campaign id must be digits.");
  return `SELECT campaign.id, asset_group.id, asset_group.name, asset_group.status, asset_group.final_urls FROM asset_group WHERE campaign.id = ${campaignId}`;
}

export function assetTextReadQuery(campaignId: string): string {
  if (!/^\d+$/.test(campaignId)) throw new Error("Campaign id must be digits.");
  return `SELECT campaign.id, asset_group_asset.field_type, asset.text_asset.text FROM asset_group_asset WHERE campaign.id = ${campaignId}`;
}

export function performanceMaxCopy(groupRows: unknown[], assetRows: unknown[]): {
  assetGroupName: string;
  assetGroupStatus: string;
  finalUrl: string;
  longHeadline: string;
  headlines: string[];
  descriptions: string[];
} | null {
  const groupRow = asRecord(groupRows[0]);
  const group = asRecord(groupRow?.assetGroup) ?? asRecord(groupRow?.asset_group);
  if (!group) return null;
  const urls = group.finalUrls ?? group.final_urls;
  const texts: Array<{ fieldType: string; text: string }> = [];
  for (const row of assetRows) {
    const rec = asRecord(row);
    const link = asRecord(rec?.assetGroupAsset) ?? asRecord(rec?.asset_group_asset);
    const asset = asRecord(rec?.asset);
    const textAsset = asRecord(asset?.textAsset) ?? asRecord(asset?.text_asset);
    const text = textAsset?.text;
    const fieldType = String(link?.fieldType ?? link?.field_type ?? "");
    if (typeof text === "string" && text && fieldType) texts.push({ fieldType, text });
  }
  return {
    assetGroupName: String(group.name ?? ""),
    assetGroupStatus: String(group.status ?? ""),
    finalUrl: Array.isArray(urls) ? String(urls[0] ?? "") : "",
    longHeadline: texts.find((item) => item.fieldType === "LONG_HEADLINE")?.text ?? "",
    headlines: texts.filter((item) => item.fieldType === "HEADLINE").map((item) => item.text),
    descriptions: texts.filter((item) => item.fieldType === "DESCRIPTION").map((item) => item.text),
  };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, sum]);
}

/** Small sage PNG with an ink circle. Performance Max requires these sizes. */
function brandPng(width: number, height: number): string {
  const sage: [number, number, number] = [132, 176, 103];
  const ink: [number, number, number] = [42, 48, 32];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.28;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
      const rgb = inside ? ink : sage;
      const index = row + 1 + x * 3;
      raw[index] = rgb[0];
      raw[index + 1] = rgb[1];
      raw[index + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
}

function textAssetOp(resourceName: string, text: string): Record<string, unknown> {
  return { assetOperation: { create: { resourceName, textAsset: { text } } } };
}

function imageAssetOp(resourceName: string, name: string, data: string): Record<string, unknown> {
  return { assetOperation: { create: { resourceName, name, imageAsset: { data } } } };
}

function groupLink(assetGroup: string, asset: string, fieldType: string): Record<string, unknown> {
  return { assetGroupAssetOperation: { create: { assetGroup, asset, fieldType } } };
}

function campaignLink(campaign: string, asset: string, fieldType: string): Record<string, unknown> {
  return { campaignAssetOperation: { create: { campaign, asset, fieldType } } };
}

export function buildPausedSalesMutate(
  customerId: string,
  input: PausedSalesInput,
  now = Date.now()
): { mutateOperations: Array<Record<string, unknown>> } {
  const problem = validatePausedSalesAd(input);
  if (problem) throw new Error(problem);
  if (input.format === "search") {
    return buildPausedCampaignMutate(
      customerId,
      {
        name: input.name,
        adGroupName: input.adGroupName ?? "",
        headlines: input.headlines,
        descriptions: input.descriptions,
        finalUrl: input.finalUrl,
        keyword: input.keyword,
        dailyBudgetUsd: input.dailyBudgetUsd,
      },
      now
    );
  }
  const budgetUsd = input.dailyBudgetUsd ?? 1;
  const budget = `customers/${customerId}/campaignBudgets/-1`;
  const campaign = `customers/${customerId}/campaigns/-2`;
  const assetGroup = `customers/${customerId}/assetGroups/-3`;
  const asset = (id: number) => `customers/${customerId}/assets/-${id}`;
  const businessName = (input.businessName?.trim() || "Nura");
  const ops: Array<Record<string, unknown>> = [
    {
      campaignBudgetOperation: {
        create: {
          resourceName: budget,
          name: `${input.name.trim()} paused budget ${now}`,
          amountMicros: String(Math.round(budgetUsd * 1_000_000)),
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    },
    {
      campaignOperation: {
        create: {
          resourceName: campaign,
          name: input.name.trim(),
          status: "PAUSED",
          advertisingChannelType: "PERFORMANCE_MAX",
          campaignBudget: budget,
          maximizeConversions: {},
          brandGuidelinesEnabled: true,
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        },
      },
    },
  ];
  let next = 10;
  const headlineAssets = input.headlines.map((line) => {
    const resourceName = asset(next);
    next += 1;
    ops.push(textAssetOp(resourceName, line.trim()));
    return resourceName;
  });
  const descriptionAssets = input.descriptions.map((line) => {
    const resourceName = asset(next);
    next += 1;
    ops.push(textAssetOp(resourceName, line.trim()));
    return resourceName;
  });
  const longAsset = asset(next);
  next += 1;
  ops.push(textAssetOp(longAsset, input.longHeadline!.trim()));
  const businessAsset = asset(next);
  next += 1;
  ops.push(textAssetOp(businessAsset, businessName));
  const logoAsset = asset(next);
  next += 1;
  ops.push(imageAssetOp(logoAsset, `Nura logo ${now}`, brandPng(128, 128)));
  const landscapeAsset = asset(next);
  next += 1;
  ops.push(imageAssetOp(landscapeAsset, `Nura landscape ${now}`, brandPng(600, 314)));
  const squareAsset = asset(next);
  ops.push(imageAssetOp(squareAsset, `Nura square ${now}`, brandPng(300, 300)));
  ops.push(campaignLink(campaign, businessAsset, "BUSINESS_NAME"));
  ops.push(campaignLink(campaign, logoAsset, "LOGO"));
  ops.push({
    assetGroupOperation: {
      create: {
        resourceName: assetGroup,
        name: resolvedAssetGroupName(input),
        campaign,
        status: "PAUSED",
        finalUrls: [input.finalUrl.trim()],
      },
    },
  });
  for (const resourceName of headlineAssets) ops.push(groupLink(assetGroup, resourceName, "HEADLINE"));
  for (const resourceName of descriptionAssets) ops.push(groupLink(assetGroup, resourceName, "DESCRIPTION"));
  ops.push(groupLink(assetGroup, longAsset, "LONG_HEADLINE"));
  ops.push(groupLink(assetGroup, landscapeAsset, "MARKETING_IMAGE"));
  ops.push(groupLink(assetGroup, squareAsset, "SQUARE_MARKETING_IMAGE"));
  return { mutateOperations: ops };
}

export function nuraGoogleAdsMcpJson(repoDir: string): string {
  const root = repoDir.trim().replace(/[\\/]+$/, "");
  if (!root) return "";
  const sep = root.includes("\\") ? "\\" : "/";
  const script = `${root}${sep}mcp${sep}google-ads-server.ts`;
  return JSON.stringify(
    {
      mcpServers: {
        [NURA_GOOGLE_ADS_MCP_NAME]: {
          type: "stdio",
          command: "npx",
          args: ["--prefix", root, "tsx", script],
          env: {},
        },
      },
    },
    null,
    2
  );
}
