/**
 * Paused-only Google Ads payloads for the local MCP server.
 * The server reads credentials from the environment. This module never sees them.
 */

export const PAUSED_CAMPAIGN_BUDGET_USD_MAX = 5;
export const ENGLISH_LANGUAGE = "languageConstants/1000";

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
  if (missing.length) return { missing: [...missing] };
  return {
    missing: [],
    config: {
      customerId: env.GOOGLE_ADS_CUSTOMER_ID!.replace(/\D/g, ""),
      developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim(),
      clientId: env.GOOGLE_ADS_CLIENT_ID!.trim(),
      clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!.trim(),
      refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN!.trim(),
      apiVersion: env.GOOGLE_ADS_API_VERSION?.trim() || "v25",
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
  let url: URL;
  try {
    url = new URL(input.finalUrl.trim());
  } catch {
    return "Final URL must be a full https address.";
  }
  if (url.protocol !== "https:") return "Final URL must start with https.";
  const budget = input.dailyBudgetUsd ?? 1;
  if (!Number.isFinite(budget) || budget <= 0 || budget > PAUSED_CAMPAIGN_BUDGET_USD_MAX) {
    return `Daily budget must be between 0 and ${PAUSED_CAMPAIGN_BUDGET_USD_MAX} USD. The campaign is still created paused.`;
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
