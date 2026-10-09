/**
 * Paused-only Google Ads payloads for the local MCP server.
 * The server reads credentials from the environment. This module never sees them.
 */

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
  const budget = input.dailyBudgetUsd ?? 1;
  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    budget > PAUSED_CAMPAIGN_BUDGET_USD_MAX ||
    Math.round(budget * 1_000_000) < 1
  ) {
    return `Daily budget must be greater than 0 and at most ${PAUSED_CAMPAIGN_BUDGET_USD_MAX} USD. Nothing was created.`;
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
