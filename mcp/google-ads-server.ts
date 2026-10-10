/**
 * Local stdio MCP for Cherry Studio.
 *
 *   npx tsx mcp/google-ads-server.ts
 *
 * Loads Google Ads credentials from the repo `.env`. Do not put those values
 * in the agent prompt. This server can read a campaign, create a paused Search
 * campaign, create a paused sales ad, change a paused campaign, or remove one.
 * It cannot enable a campaign, and the daily budget cannot exceed 5 USD.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mintGoogleAdsAccessToken } from "../lib/conversions/google-ads.ts";
import { nuraSalesImages } from "./google-ads-images.ts";
import {
  activeAssetGroups,
  adGroupIdsQuery,
  adGroupKeywordTargetingQuery,
  buildCampaignRemoveMutate,
  buildCampaignUpdateMutate,
  buildKeepPausedMutate,
  buildKeywordAddMutate,
  buildKeywordReplaceMutate,
  buildLocationAddMutate,
  buildPausedCampaignMutate,
  buildPausedSalesMutate,
  buildPerformanceMaxUpdateMutate,
  buildReplaceSearchAdMutate,
  buildResourceRemoveMutate,
  campaignByNameQuery,
  campaignIdFromMutate,
  campaignChannelFromRow,
  campaignKeywordTargetingQuery,
  campaignLookupQuery,
  campaignStatusFromRow,
  googleAdsFailureText,
  existingCampaignDecision,
  googleAdsConfigFromEnv,
  latestCampaignRows,
  NURA_GOOGLE_ADS_MCP_NAME,
  assetGroupReadQuery,
  assetTextReadQuery,
  geoNameQuery,
  geoSuggestPlaces,
  geoSuggestRequest,
  keywordTargets,
  locationTargetingQuery,
  locationTargets,
  mergedSearchAd,
  pickSearchAd,
  pausedSalesInput,
  performanceMaxCopy,
  resolvedAssetGroupName,
  searchAdCopy,
  searchAdReadQuery,
  storedSalesProblem,
  pausedCampaignGate,
  pausedKeywordGroups,
  pausedKeywordQuery,
  resourcesForCriteria,
  searchAdCopyQuery,
  searchAdTargets,
  soleAdGroupId,
  redactSecrets,
  removalNameProblem,
  rollupCampaignWeek,
  validateCampaignUpdate,
  validatePausedCampaign,
  validatePausedSalesAd,
  type CampaignUpdateInput,
  type PausedCampaignInput,
  type PausedSalesInput,
} from "../lib/google-ads-agent.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });

const loaded = googleAdsConfigFromEnv(process.env);
if (!loaded.config) {
  process.stderr.write(
    `nura-google-ads: missing ${loaded.missing.join(", ")} in .env\n`
  );
  process.exit(1);
}
const ads = loaded.config;

function text(body: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }] };
}

function fail(message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          ok: false,
          error: redactSecrets(message, [ads.clientSecret, ads.refreshToken, ads.developerToken]),
        }),
      },
    ],
  };
}

async function accessToken(): Promise<string> {
  const minted = await mintGoogleAdsAccessToken({
    clientId: ads.clientId,
    clientSecret: ads.clientSecret,
    refreshToken: ads.refreshToken,
  });
  if (!minted.token) throw new Error(minted.error || "Google Ads login failed");
  return minted.token;
}

function headers(token: string): Record<string, string> {
  const out: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "developer-token": ads.developerToken,
  };
  if (ads.loginCustomerId) out["login-customer-id"] = ads.loginCustomerId;
  return out;
}

async function adsPost(token: string, urlPath: string, body: unknown): Promise<unknown> {
  const res = await fetch(
    `https://googleads.googleapis.com/${ads.apiVersion}/${urlPath}`,
    { method: "POST", headers: headers(token), body: JSON.stringify(body) }
  );
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* keep text */
  }
  if (!res.ok) throw new Error(googleAdsFailureText(parsed, res.status));
  return parsed;
}

async function adsFetch(token: string, pathName: string, body: unknown): Promise<unknown> {
  return adsPost(token, `customers/${ads.customerId}/${pathName}`, body);
}

async function keepPaused(token: string, campaignId: string): Promise<void> {
  const rows = await search(token, campaignLookupQuery(campaignId));
  if (campaignStatusFromRow(rows[0]) === "PAUSED") return;
  await adsFetch(token, "googleAds:mutate", buildKeepPausedMutate(`customers/${ads.customerId}/campaigns/${campaignId}`));
  const again = await search(token, campaignLookupQuery(campaignId));
  if (campaignStatusFromRow(again[0]) !== "PAUSED") throw new Error(`Campaign ${campaignId} is not paused.`);
}

async function replacePausedSearchAd(
  token: string,
  campaignId: string,
  patch: { finalUrl?: string; headlines?: string[]; descriptions?: string[] },
  adId = ""
) {
  const current = pickSearchAd(await search(token, searchAdCopyQuery(campaignId)), adId);
  const next = mergedSearchAd(current, patch);
  await adsFetch(
    token,
    "googleAds:mutate",
    buildReplaceSearchAdMutate({
      customerId: ads.customerId,
      adGroupId: current.adGroupId,
      oldAdResourceName: current.resourceName,
      finalUrl: next.finalUrl,
      headlines: next.headlines,
      descriptions: next.descriptions,
    })
  );
  await keepPaused(token, campaignId);
  const stored = searchAdTargets(await search(token, searchAdCopyQuery(campaignId)));
  if (stored.some((ad) => ad.adId === current.adId)) throw new Error("The old ad was not replaced. The campaign stays paused.");
  const saved = stored.find((ad) => ad.finalUrl === next.finalUrl && ad.status === "PAUSED");
  if (!saved) throw new Error("The new ad does not show the site. The campaign stays paused.");
  if (next.headlines.some((line) => !saved.headlines.includes(line.trim()))) {
    throw new Error("The new headlines were not saved. The campaign stays paused.");
  }
  return { finalUrl: saved.finalUrl, headlines: saved.headlines, descriptions: saved.descriptions, adId: saved.adId };
}

async function targetingSnapshot(token: string, campaignId: string) {
  const [locationRows, campaignKeywordRows, groupKeywordRows] = await Promise.all([
    search(token, locationTargetingQuery(campaignId)),
    search(token, campaignKeywordTargetingQuery(campaignId)),
    search(token, adGroupKeywordTargetingQuery(campaignId)),
  ]);
  const locations = locationTargets(locationRows);
  const ids = locations.map((place) => place.locationId).filter(Boolean);
  if (ids.length) {
    try {
      const named = await search(token, geoNameQuery(ids));
      const names = new Map<string, { name: string; countryCode: string }>();
      for (const row of named) {
        const geo = (row as { geoTargetConstant?: { id?: string | number; canonicalName?: string; countryCode?: string } }).geoTargetConstant;
        if (!geo?.id) continue;
        names.set(String(geo.id), { name: geo.canonicalName ?? "", countryCode: geo.countryCode ?? "" });
      }
      for (const place of locations) {
        const extra = names.get(place.locationId);
        if (!extra) continue;
        place.name = extra.name;
        place.countryCode = extra.countryCode;
      }
    } catch {
      /* names are optional */
    }
  }
  return {
    locations,
    keywords: [...keywordTargets(campaignKeywordRows, "campaign"), ...keywordTargets(groupKeywordRows, "ad_group")],
  };
}

async function search(token: string, query: string): Promise<unknown[]> {
  const body = (await adsFetch(token, "googleAds:search", { query })) as { results?: unknown[] };
  return body.results ?? [];
}

async function readStoredSales(token: string, id: string, format: "search" | "performance_max") {
  if (format === "performance_max") {
    return performanceMaxCopy(
      await search(token, assetGroupReadQuery(id)),
      await search(token, assetTextReadQuery(id))
    );
  }
  return searchAdCopy(await search(token, searchAdReadQuery(id)));
}

async function confirmStoredSales(token: string, campaignId: string, draft: PausedSalesInput) {
  const stored = await readStoredSales(token, campaignId, draft.format);
  const mismatch = storedSalesProblem(
    {
      finalUrl: draft.finalUrl,
      headlines: draft.headlines,
      descriptions: draft.descriptions,
      longHeadline: draft.format === "performance_max" ? draft.longHeadline : undefined,
      assetGroupName: draft.format === "performance_max" ? resolvedAssetGroupName(draft) : undefined,
    },
    stored
  );
  const body = {
    ok: !mismatch,
    paused: true,
    customerId: ads.customerId,
    campaignId,
    format: draft.format,
    changed: true,
    finalUrl: stored?.finalUrl ?? "",
    assetGroupName: stored?.assetGroupName,
    longHeadline: stored?.longHeadline,
    error: mismatch,
  };
  if (mismatch) {
    return { isError: true as const, content: [{ type: "text" as const, text: JSON.stringify(body) }] };
  }
  return text(body);
}

const server = new McpServer({ name: NURA_GOOGLE_ADS_MCP_NAME, version: "1.0.0" });

server.registerTool(
  "read_campaign",
  {
    title: "Read a Google Ads campaign",
    description:
      `Read one campaign on customer ${ads.customerId}, or the 20 highest campaign ids when campaignId is omitted. One campaign returns a 7-day total for cost, impressions, and clicks, its Search ads, and for Performance Max the asset group name, final URL, and long headline. Does not change the account.`,
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only. Omit to list campaigns."),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ campaignId }) => {
    try {
      const token = await accessToken();
      const id = campaignId?.replace(/\D/g, "") ?? "";
      if (!id) {
        const rows = await search(
          token,
          "SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign"
        );
        return text({ ok: true, customerId: ads.customerId, campaigns: latestCampaignRows(rows) });
      }
      const [campaignRows, metricRows, adsRows, groupRows, textRows] = await Promise.all([
        search(token, campaignLookupQuery(id)),
        search(
          token,
          `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE campaign.id = ${id} AND segments.date DURING LAST_7_DAYS`
        ),
        search(
          token,
          `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE campaign.id = ${id}`
        ),
        search(token, assetGroupReadQuery(id)),
        search(token, assetTextReadQuery(id)),
      ]);
      const campaign = campaignRows[0] ?? null;
      if (!campaign) {
        return text({ ok: true, found: false, customerId: ads.customerId, campaignId: id });
      }
      return text({
        ok: true,
        found: true,
        customerId: ads.customerId,
        campaign,
        last7Days: rollupCampaignWeek(metricRows),
        ads: adsRows,
        performanceMax: performanceMaxCopy(groupRows, textRows),
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "create_paused_campaign",
  {
    title: "Create a paused Google Ads campaign",
    description:
      "Create a Search campaign, ad group, keyword, and responsive search ad. Campaign, ad group, keyword, and ad are always PAUSED. Daily budget defaults to 1 USD and cannot exceed 5 USD. The landing URL must be https on nurahelp.com. This tool cannot enable a campaign. A paused campaign with the same name is reused.",
    inputSchema: z.object({
      name: z.string().describe("Campaign name, for example Nura."),
      adGroupName: z.string().describe("Target group name."),
      headlines: z.array(z.string()).describe("3 to 15 headlines, each up to 30 characters."),
      descriptions: z.array(z.string()).describe("2 to 4 descriptions, each up to 90 characters."),
      finalUrl: z.string().describe("https landing URL, usually https://nurahelp.com"),
      keyword: z.string().optional().describe("Phrase keyword. Defaults to nura. Avoid health-condition phrases."),
      dailyBudgetUsd: z.number().optional().describe("USD per day. Defaults to 1. Maximum 5."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    const draft: PausedCampaignInput = input;
    const problem = validatePausedCampaign(draft);
    if (problem) return fail(problem);
    try {
      const token = await accessToken();
      const existing = await search(token, campaignByNameQuery(draft.name));
      const decision = existingCampaignDecision(existing, "SEARCH");
      if (decision.action === "reuse") {
        return text({
          ok: true,
          paused: true,
          alreadyExists: true,
          changed: false,
          customerId: ads.customerId,
          campaignId: decision.campaignId,
        });
      }
      if (decision.action === "refuse") {
        return fail(
          `A campaign named ${draft.name.trim()} already exists (${decision.status}). Nothing was created.`
        );
      }
      const created = await adsFetch(
        token,
        "googleAds:mutate",
        buildPausedCampaignMutate(ads.customerId, draft)
      );
      const campaignId = campaignIdFromMutate(created);
      return text({
        ok: true,
        paused: true,
        customerId: ads.customerId,
        campaignId,
        created,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "create_paused_sales_ad",
  {
    title: "Create a paused sales ad",
    description:
      "Create a paused sales ad on nurahelp.com. format search builds a Search campaign with a landing URL, headlines, and descriptions. format performance_max builds a Performance Max campaign with a landing URL. Campaign and ad stay PAUSED. Daily budget defaults to 1 USD and cannot exceed 5 USD. This tool cannot enable a campaign. The existing Search campaign tool is unchanged. A paused campaign with the same name is reused.",
    inputSchema: z.object({
      format: z.enum(["search", "performance_max"]).describe("search uses a site and text. performance_max uses a site."),
      name: z.string().describe("Campaign name."),
      finalUrl: z.string().optional().describe("https landing URL on nurahelp.com. Same as final_url."),
      headlines: z.array(z.string()).describe("3 to 15 headlines, each up to 30 characters."),
      descriptions: z.array(z.string()).describe("2 to 4 descriptions, each up to 90 characters. Performance Max needs one of 60 characters or fewer."),
      adGroupName: z.string().optional().describe("Required for search. Target group name."),
      keyword: z.string().optional().describe("Search phrase keyword. Defaults to nura."),
      longHeadline: z.string().optional().describe("Required for performance_max. 1 to 90 characters. Same as long_headline."),
      long_headline: z.string().optional().describe("Same as longHeadline."),
      businessName: z.string().optional().describe("Performance Max business name. Defaults to Nura."),
      business_name: z.string().optional().describe("Same as businessName."),
      assetGroupName: z.string().optional().describe("Performance Max asset group name. Same as asset_group_name."),
      asset_group_name: z.string().optional().describe("Same as assetGroupName."),
      final_url: z.string().optional().describe("Same as finalUrl."),
      ad_group_name: z.string().optional().describe("Same as adGroupName."),
      dailyBudgetUsd: z.number().optional().describe("USD per day. Defaults to 1. Maximum 5."),
      daily_budget_usd: z.number().optional().describe("Same as dailyBudgetUsd."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    const parsed = pausedSalesInput(input);
    if ("error" in parsed) return fail(parsed.error);
    const draft = parsed.input;
    const problem = validatePausedSalesAd(draft);
    if (problem) return fail(problem);
    try {
      const token = await accessToken();
      const existing = await search(token, campaignByNameQuery(draft.name));
      const decision = existingCampaignDecision(
        existing,
        draft.format === "performance_max" ? "PERFORMANCE_MAX" : "SEARCH"
      );
      if (decision.action === "reuse") {
        const stored = await readStoredSales(token, decision.campaignId, draft.format);
        return text({
          ok: true,
          paused: true,
          alreadyExists: true,
          changed: false,
          customerId: ads.customerId,
          campaignId: decision.campaignId,
          format: draft.format,
          finalUrl: stored?.finalUrl,
          assetGroupName: stored?.assetGroupName,
          longHeadline: stored?.longHeadline,
        });
      }
      if (decision.action === "refuse") {
        return fail(
          `A campaign named ${draft.name.trim()} already exists (${decision.status}). Nothing was created.`
        );
      }
      const created = await adsFetch(
        token,
        "googleAds:mutate",
        buildPausedSalesMutate(ads.customerId, draft, Date.now(), nuraSalesImages())
      );
      const campaignId = campaignIdFromMutate(created);
      if (!campaignId) return fail("The paused campaign was created, but its id could not be read.");
      return confirmStoredSales(token, campaignId, draft);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "update_campaign",
  {
    title: "Update a paused Google Ads campaign",
    description:
      "Change the name, daily budget, headlines, descriptions, final URL, long headline, or keyword of one paused campaign. Search ad text is replaced with a new paused ad, because Google does not edit that text in place. Performance Max uses the asset group for the URL and text. Budget stays at most 5 USD. The final URL must be https on nurahelp.com. A shared budget is left unchanged. The keyword is replaced and stays paused. This tool cannot enable a campaign.",
    inputSchema: z.object({
      campaignId: z.string().describe("Digits only."),
      name: z.string().optional().describe("New campaign name."),
      dailyBudgetUsd: z.number().optional().describe("New USD per day. Maximum 5."),
      headlines: z.array(z.string()).optional().describe("3 to 15 headlines, each up to 30 characters. Replaces the paused ad."),
      descriptions: z.array(z.string()).optional().describe("2 to 4 descriptions, each up to 90 characters. Replaces the paused ad."),
      finalUrl: z.string().optional().describe("https URL on nurahelp.com. Same as final_url."),
      final_url: z.string().optional().describe("Same as finalUrl."),
      longHeadline: z.string().optional().describe("Performance Max long headline, 1 to 90 characters. Same as long_headline."),
      long_headline: z.string().optional().describe("Same as longHeadline."),
      keyword: z.string().optional().describe("New phrase keyword. Replaces the paused keyword. Search only."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    const id = input.campaignId.replace(/\D/g, "");
    if (!id) return fail("Campaign id is required. Nothing was changed.");
    const patch: CampaignUpdateInput = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.dailyBudgetUsd !== undefined) patch.dailyBudgetUsd = input.dailyBudgetUsd;
    if (input.headlines !== undefined) patch.headlines = input.headlines;
    if (input.descriptions !== undefined) patch.descriptions = input.descriptions;
    if (input.finalUrl !== undefined || input.final_url !== undefined) patch.finalUrl = input.finalUrl ?? input.final_url;
    if (input.longHeadline !== undefined || input.long_headline !== undefined) {
      patch.longHeadline = input.longHeadline ?? input.long_headline;
    }
    if (input.keyword !== undefined) patch.keyword = input.keyword;
    const problem = validateCampaignUpdate(patch);
    if (problem) return fail(problem);
    try {
      const token = await accessToken();
      const rows = await search(token, campaignLookupQuery(id));
      const gate = pausedCampaignGate(rows, id, "changed");
      if (!gate.ok) return fail(gate.error);
      if (patch.dailyBudgetUsd !== undefined && gate.explicitlyShared) {
        return fail("This campaign uses a shared budget. Nothing was changed.");
      }
      const hasCopy = patch.headlines !== undefined || patch.descriptions !== undefined || patch.finalUrl !== undefined || patch.longHeadline !== undefined;
      const groupRows = hasCopy || patch.keyword !== undefined ? await search(token, assetGroupReadQuery(id)) : [];
      const textRows = hasCopy ? await search(token, assetTextReadQuery(id)) : [];
      const performanceMax = performanceMaxCopy(groupRows, textRows);
      if (patch.keyword !== undefined && performanceMax) {
        return fail("Performance Max has no keyword. Nothing was changed.");
      }
      let ad: unknown;
      let keyword: unknown;
      let sales: unknown;
      if (hasCopy && performanceMax) {
        sales = await adsFetch(
          token,
          "googleAds:mutate",
          buildPerformanceMaxUpdateMutate({
            customerId: ads.customerId,
            assetGroupResourceName: performanceMax.assetGroupResourceName ?? "",
            links: textRows,
            finalUrl: patch.finalUrl,
            headlines: patch.headlines,
            descriptions: patch.descriptions,
            longHeadline: patch.longHeadline,
          })
        );
      } else if (hasCopy) {
        ad = await replacePausedSearchAd(token, id, patch);
      }
      if (patch.keyword !== undefined) {
        const groups = pausedKeywordGroups(await search(token, pausedKeywordQuery(id)));
        keyword = await adsFetch(
          token,
          "googleAds:mutate",
          buildKeywordReplaceMutate(ads.customerId, groups, patch.keyword)
        );
      }
      let updated: unknown;
      if (patch.name !== undefined || patch.dailyBudgetUsd !== undefined) {
        updated = await adsFetch(
          token,
          "googleAds:mutate",
          buildCampaignUpdateMutate({
            campaignResourceName: `customers/${ads.customerId}/campaigns/${id}`,
            budgetResourceName: gate.budgetResourceName,
            name: patch.name,
            dailyBudgetUsd: patch.dailyBudgetUsd,
          })
        );
      }
      if (hasCopy && performanceMax) {
        const stored = await readStoredSales(token, id, "performance_max");
        const mismatch = storedSalesProblem(
          {
            finalUrl: patch.finalUrl,
            headlines: patch.headlines,
            descriptions: patch.descriptions,
            longHeadline: patch.longHeadline,
          },
          stored
        );
        if (mismatch) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ ok: false, paused: true, campaignId: id, error: mismatch, finalUrl: stored?.finalUrl, longHeadline: stored?.longHeadline, assetGroupName: stored?.assetGroupName }) }],
          };
        }
        return text({
          ok: true,
          paused: true,
          customerId: ads.customerId,
          campaignId: id,
          updated,
          sales,
          finalUrl: stored?.finalUrl,
          assetGroupName: stored?.assetGroupName,
          longHeadline: stored?.longHeadline,
        });
      }
      return text({ ok: true, paused: true, customerId: ads.customerId, campaignId: id, updated, ad, keyword });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

async function requirePaused(token: string, campaignId: string) {
  const id = campaignId.replace(/\D/g, "");
  if (!id) throw new Error("Campaign id is required. Nothing was changed.");
  const rows = await search(token, campaignLookupQuery(id));
  const gate = pausedCampaignGate(rows, id, "changed");
  if (!gate.ok) throw new Error(gate.error);
  return { id, channel: campaignChannelFromRow(rows[0]) };
}

server.registerTool(
  "suggest_locations",
  {
    title: "Find Google Ads place ids",
    description: "Find place ids for a city, region, or country. Serbia is 2688. This does not change a campaign and cannot enable one.",
    inputSchema: z.object({
      query: z.string().describe("Place name, such as Serbia or Belgrade."),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    try {
      const token = await accessToken();
      const body = await adsPost(token, "geoTargetConstants:suggest", geoSuggestRequest(query));
      return text({ ok: true, query: query.trim(), locations: geoSuggestPlaces(body) });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "list_targeting",
  {
    title: "List places, keywords, and ad text",
    description: "List places, keywords, and the current ad text on one campaign. Criterion ids from this list are used to remove places or keywords. Does not change the account.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only."),
      campaign_id: z.string().optional().describe("Same as campaignId."),
    }),
    annotations: { readOnlyHint: true },
  },
  async (input) => {
    const id = (input.campaignId || input.campaign_id || "").replace(/\D/g, "");
    if (!id) return fail("Campaign id is required.");
    try {
      const token = await accessToken();
      const rows = await search(token, campaignLookupQuery(id));
      if (!rows[0]) return fail(`Campaign ${id} was not found.`);
      const targeting = await targetingSnapshot(token, id);
      const channel = campaignChannelFromRow(rows[0]);
      const ads = channel === "SEARCH" ? searchAdTargets(await search(token, searchAdCopyQuery(id))) : [];
      const assetGroups = channel === "PERFORMANCE_MAX" ? activeAssetGroups(await search(token, assetGroupReadQuery(id))) : [];
      return text({
        ok: true,
        campaignId: id,
        channelType: channel,
        status: campaignStatusFromRow(rows[0]),
        locations: targeting.locations,
        keywords: targeting.keywords,
        ads,
        assetGroups,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "add_locations",
  {
    title: "Add places to a paused campaign",
    description: "Add places to a paused campaign. location ids come from suggest_locations. negative=true excludes those places. This cannot enable a campaign.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only."),
      campaign_id: z.string().optional().describe("Same as campaignId."),
      locationIds: z.array(z.string()).optional().describe("Place ids from suggest_locations."),
      location_ids: z.array(z.string()).optional().describe("Same as locationIds."),
      negative: z.boolean().optional().describe("True excludes the places."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    const ids = input.locationIds ?? input.location_ids ?? [];
    try {
      const token = await accessToken();
      const paused = await requirePaused(token, input.campaignId || input.campaign_id || "");
      await adsFetch(token, "googleAds:mutate", buildLocationAddMutate(ads.customerId, paused.id, ids, input.negative === true));
      await keepPaused(token, paused.id);
      const targeting = await targetingSnapshot(token, paused.id);
      return text({
        ok: true,
        paused: true,
        campaignId: paused.id,
        negative: input.negative === true,
        locations: targeting.locations,
        note: "Locations updated. The campaign stays paused.",
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "remove_locations",
  {
    title: "Remove places from a paused campaign",
    description: "Remove places from a paused campaign. criterion ids come from list_targeting. This cannot enable a campaign.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only."),
      campaign_id: z.string().optional().describe("Same as campaignId."),
      criterionIds: z.array(z.string()).optional().describe("Location criterion ids from list_targeting."),
      criterion_ids: z.array(z.string()).optional().describe("Same as criterionIds."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  async (input) => {
    try {
      const token = await accessToken();
      const paused = await requirePaused(token, input.campaignId || input.campaign_id || "");
      const current = await targetingSnapshot(token, paused.id);
      const chosen = resourcesForCriteria(current.locations, input.criterionIds ?? input.criterion_ids ?? [], "location");
      await adsFetch(
        token,
        "googleAds:mutate",
        buildResourceRemoveMutate("campaignCriterionOperation", chosen.map((place) => place.resourceName))
      );
      await keepPaused(token, paused.id);
      const targeting = await targetingSnapshot(token, paused.id);
      return text({
        ok: true,
        paused: true,
        campaignId: paused.id,
        locations: targeting.locations,
        note: "Locations removed. The campaign stays paused.",
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "add_keywords",
  {
    title: "Add keywords to a paused campaign",
    description:
      "Add keywords to a paused Search campaign. matchType is EXACT, PHRASE, or BROAD. One keyword may end with |EXACT, |PHRASE, or |BROAD. negative=true excludes the words for the whole campaign, including Performance Max. This cannot enable a campaign.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only."),
      campaign_id: z.string().optional().describe("Same as campaignId."),
      keywords: z.array(z.string()).describe("Keyword text. A line may end with |EXACT, |PHRASE, or |BROAD."),
      matchType: z.string().optional().describe("EXACT, PHRASE, or BROAD. Defaults to PHRASE."),
      match_type: z.string().optional().describe("Same as matchType."),
      negative: z.boolean().optional().describe("True adds campaign negative keywords."),
      adGroupId: z.string().optional().describe("Required when the Search campaign has more than one ad group."),
      ad_group_id: z.string().optional().describe("Same as adGroupId."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    try {
      const token = await accessToken();
      const paused = await requirePaused(token, input.campaignId || input.campaign_id || "");
      const negative = input.negative === true;
      let adGroupId = "";
      if (!negative) {
        if (paused.channel && paused.channel !== "SEARCH") {
          throw new Error("Keyword lists are for Search campaigns. Performance Max can take negative keywords. Nothing was changed.");
        }
        adGroupId = soleAdGroupId(await search(token, adGroupIdsQuery(paused.id)), input.adGroupId || input.ad_group_id || "");
      }
      await adsFetch(
        token,
        "googleAds:mutate",
        buildKeywordAddMutate({
          customerId: ads.customerId,
          campaignId: paused.id,
          adGroupId,
          keywords: input.keywords,
          matchType: input.matchType || input.match_type || "PHRASE",
          negative,
        })
      );
      await keepPaused(token, paused.id);
      const targeting = await targetingSnapshot(token, paused.id);
      return text({
        ok: true,
        paused: true,
        campaignId: paused.id,
        keywords: targeting.keywords,
        note: "Keywords updated. The campaign stays paused.",
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "remove_keywords",
  {
    title: "Remove keywords from a paused campaign",
    description: "Remove keywords from a paused campaign. criterion ids come from list_targeting. This cannot enable a campaign.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only."),
      campaign_id: z.string().optional().describe("Same as campaignId."),
      criterionIds: z.array(z.string()).optional().describe("Keyword criterion ids from list_targeting."),
      criterion_ids: z.array(z.string()).optional().describe("Same as criterionIds."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  async (input) => {
    try {
      const token = await accessToken();
      const paused = await requirePaused(token, input.campaignId || input.campaign_id || "");
      const current = await targetingSnapshot(token, paused.id);
      const chosen = resourcesForCriteria(current.keywords, input.criterionIds ?? input.criterion_ids ?? [], "keyword");
      const campaignResources = chosen.filter((item) => item.level === "campaign").map((item) => item.resourceName);
      const groupResources = chosen.filter((item) => item.level === "ad_group").map((item) => item.resourceName);
      const ops = [
        ...(campaignResources.length ? buildResourceRemoveMutate("campaignCriterionOperation", campaignResources).mutateOperations : []),
        ...(groupResources.length ? buildResourceRemoveMutate("adGroupCriterionOperation", groupResources).mutateOperations : []),
      ];
      if (!ops.length) throw new Error("Pass at least one keyword id to remove. Nothing was changed.");
      await adsFetch(token, "googleAds:mutate", { mutateOperations: ops });
      await keepPaused(token, paused.id);
      const targeting = await targetingSnapshot(token, paused.id);
      return text({
        ok: true,
        paused: true,
        campaignId: paused.id,
        keywords: targeting.keywords,
        note: "Keywords removed. The campaign stays paused.",
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "update_sales_ad",
  {
    title: "Change a paused sales ad",
    description:
      "Change the site, headlines, or descriptions on a paused sales ad. Leave a field empty to keep it. Search ads are replaced, because Google does not edit that text in place. Performance Max changes the URL on the asset group and replaces headlines and descriptions. The URL must be https on nurahelp.com. This cannot enable a campaign.",
    inputSchema: z.object({
      campaignId: z.string().optional().describe("Digits only."),
      campaign_id: z.string().optional().describe("Same as campaignId."),
      finalUrl: z.string().optional().describe("https URL on nurahelp.com. Empty keeps the current URL."),
      final_url: z.string().optional().describe("Same as finalUrl."),
      headlines: z.array(z.string()).optional().describe("3 to 15 headlines. Empty keeps the current headlines."),
      descriptions: z.array(z.string()).optional().describe("2 to 4 descriptions. Empty keeps the current descriptions."),
      adId: z.string().optional().describe("Required when a Search campaign has more than one ad."),
      ad_id: z.string().optional().describe("Same as adId."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    const finalUrl = (input.finalUrl || input.final_url || "").trim();
    const headlines = input.headlines?.map((line) => line.trim()).filter(Boolean);
    const descriptions = input.descriptions?.map((line) => line.trim()).filter(Boolean);
    if (!finalUrl && !headlines?.length && !descriptions?.length) {
      return fail("Pass a final URL, headlines, or descriptions. Nothing was changed.");
    }
    try {
      const token = await accessToken();
      const paused = await requirePaused(token, input.campaignId || input.campaign_id || "");
      if (paused.channel === "SEARCH" || !paused.channel) {
        const saved = await replacePausedSearchAd(
          token,
          paused.id,
          { finalUrl: finalUrl || undefined, headlines, descriptions },
          input.adId || input.ad_id || ""
        );
        return text({
          ok: true,
          paused: true,
          campaignId: paused.id,
          channelType: "SEARCH",
          ...saved,
          note: "Replaced the search ad. Google cannot edit the old text in place. The campaign stays paused.",
        });
      }
      if (paused.channel === "PERFORMANCE_MAX") {
        if (headlines && (headlines.length < 3 || headlines.length > 15 || headlines.some((line) => line.length > 30))) {
          throw new Error("A sales ad needs 3 to 15 headlines, each 1 to 30 characters. Nothing was changed.");
        }
        if (descriptions && (descriptions.length < 2 || descriptions.length > 4 || descriptions.some((line) => line.length > 90))) {
          throw new Error("A sales ad needs 2 to 4 descriptions, each 1 to 90 characters. Nothing was changed.");
        }
        if (descriptions && !descriptions.some((line) => line.length <= 60)) {
          throw new Error("Performance Max needs one description of 60 characters or fewer. Nothing was changed.");
        }
        const groups = activeAssetGroups(await search(token, assetGroupReadQuery(paused.id)));
        if (groups.length !== 1) throw new Error("This campaign needs one asset group before the ad text can change. Nothing was changed.");
        const links = await search(token, assetTextReadQuery(paused.id));
        await adsFetch(
          token,
          "googleAds:mutate",
          buildPerformanceMaxUpdateMutate({
            customerId: ads.customerId,
            assetGroupResourceName: groups[0].resourceName,
            links,
            finalUrl: finalUrl || undefined,
            headlines,
            descriptions,
          })
        );
        await keepPaused(token, paused.id);
        const stored = await readStoredSales(token, paused.id, "performance_max");
        const mismatch = storedSalesProblem({ finalUrl: finalUrl || undefined, headlines, descriptions }, stored);
        if (mismatch) return fail(mismatch);
        return text({
          ok: true,
          paused: true,
          campaignId: paused.id,
          channelType: "PERFORMANCE_MAX",
          finalUrl: stored?.finalUrl,
          headlines: stored?.headlines,
          descriptions: stored?.descriptions,
          note: "Updated the Performance Max ad. The campaign stays paused.",
        });
      }
      return fail("This campaign type has no sales ad to edit. Nothing was changed.");
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

const removeCampaignTool = {
  title: "Remove a paused Google Ads campaign",
  description:
    "Remove one paused campaign when the id and the exact name both match. This sends a remove operation. Do not set campaign status to REMOVED. Google rejects that enum. This cannot enable a campaign. A campaign that is not paused is left in place. A campaign that is already removed is reported as already removed.",
  inputSchema: z.object({
    campaignId: z.string().describe("Digits only."),
    name: z.string().describe("Exact campaign name. Must match this id."),
  }),
  annotations: { readOnlyHint: false, destructiveHint: true },
};

async function removePausedCampaign(campaignId: string, name: string) {
  const id = campaignId.replace(/\D/g, "");
  if (!id) return fail("Campaign id is required. Nothing was removed.");
  try {
    const token = await accessToken();
    const rows = await search(token, campaignLookupQuery(id));
    if (!rows[0]) return fail(`Campaign ${id} was not found. Nothing was removed.`);
    const nameProblem = removalNameProblem(rows[0], name);
    if (nameProblem) return fail(nameProblem);
    if (campaignStatusFromRow(rows[0]) === "REMOVED") {
      return text({ ok: true, removed: true, alreadyRemoved: true, customerId: ads.customerId, campaignId: id });
    }
    const gate = pausedCampaignGate(rows, id, "removed");
    if (!gate.ok) return fail(gate.error);
    const removed = await adsFetch(
      token,
      "googleAds:mutate",
      buildCampaignRemoveMutate(`customers/${ads.customerId}/campaigns/${id}`)
    );
    return text({ ok: true, removed: true, customerId: ads.customerId, campaignId: id, result: removed });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

server.registerTool("remove_campaign", removeCampaignTool, async ({ campaignId, name }) => removePausedCampaign(campaignId, name));
server.registerTool("delete_campaign", removeCampaignTool, async ({ campaignId, name }) => removePausedCampaign(campaignId, name));

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Google Ads MCP failed";
  console.error(redactSecrets(message, [ads.clientSecret, ads.refreshToken, ads.developerToken]));
  process.exit(1);
});
