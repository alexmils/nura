/**
 * Local stdio MCP for Cherry Studio.
 *
 *   npx tsx mcp/google-ads-server.ts
 *
 * Loads Google Ads credentials from the repo `.env`. Do not put those values
 * in the agent prompt. This server can read a campaign, create one that stays
 * paused, change its name or daily budget, or remove a paused campaign.
 * It cannot enable a campaign, and the daily budget cannot exceed 5 USD.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mintGoogleAdsAccessToken } from "../lib/conversions/google-ads.ts";
import {
  buildCampaignRemoveMutate,
  buildCampaignUpdateMutate,
  buildPausedCampaignMutate,
  campaignByNameQuery,
  campaignIdFromMutate,
  campaignLookupQuery,
  existingCampaignDecision,
  googleAdsConfigFromEnv,
  latestCampaignRows,
  NURA_GOOGLE_ADS_MCP_NAME,
  pausedCampaignGate,
  redactSecrets,
  rollupCampaignWeek,
  validateCampaignUpdate,
  validatePausedCampaign,
  type CampaignUpdateInput,
  type PausedCampaignInput,
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

async function adsFetch(token: string, pathName: string, body: unknown): Promise<unknown> {
  const res = await fetch(
    `https://googleads.googleapis.com/${ads.apiVersion}/customers/${ads.customerId}/${pathName}`,
    { method: "POST", headers: headers(token), body: JSON.stringify(body) }
  );
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const err = parsed as {
      error?: { message?: string; details?: Array<{ errors?: Array<{ message?: string }> }> };
    };
    const detail = err.error?.details?.flatMap((row) => row.errors?.map((item) => item.message) ?? []) ?? [];
    throw new Error(detail.filter(Boolean).join("; ") || err.error?.message || `Google Ads API returned ${res.status}`);
  }
  return parsed;
}

async function search(token: string, query: string): Promise<unknown[]> {
  const body = (await adsFetch(token, "googleAds:search", { query })) as { results?: unknown[] };
  return body.results ?? [];
}

const server = new McpServer({ name: NURA_GOOGLE_ADS_MCP_NAME, version: "1.0.0" });

server.registerTool(
  "read_campaign",
  {
    title: "Read a Google Ads campaign",
    description:
      `Read one campaign on customer ${ads.customerId}, or the 20 highest campaign ids when campaignId is omitted. One campaign returns a 7-day total for cost, impressions, and clicks, plus its ads. Does not change the account.`,
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
      const [campaignRows, metricRows, adsRows] = await Promise.all([
        search(token, campaignLookupQuery(id)),
        search(
          token,
          `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE campaign.id = ${id} AND segments.date DURING LAST_7_DAYS`
        ),
        search(
          token,
          `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE campaign.id = ${id}`
        ),
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
      const decision = existingCampaignDecision(existing);
      if (decision.action === "reuse") {
        return text({
          ok: true,
          paused: true,
          alreadyExists: true,
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
  "update_campaign",
  {
    title: "Update a paused Google Ads campaign",
    description:
      "Change the name or daily budget of one paused campaign. Budget stays at most 5 USD. This tool cannot enable a campaign. A campaign that is not paused is left unchanged.",
    inputSchema: z.object({
      campaignId: z.string().describe("Digits only."),
      name: z.string().optional().describe("New campaign name."),
      dailyBudgetUsd: z.number().optional().describe("New USD per day. Maximum 5."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (input) => {
    const id = input.campaignId.replace(/\D/g, "");
    if (!id) return fail("Campaign id is required. Nothing was changed.");
    const patch: CampaignUpdateInput = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.dailyBudgetUsd !== undefined) patch.dailyBudgetUsd = input.dailyBudgetUsd;
    const problem = validateCampaignUpdate(patch);
    if (problem) return fail(problem);
    try {
      const token = await accessToken();
      const rows = await search(token, campaignLookupQuery(id));
      const gate = pausedCampaignGate(rows, id, "changed");
      if (!gate.ok) return fail(gate.error);
      const updated = await adsFetch(
        token,
        "googleAds:mutate",
        buildCampaignUpdateMutate({
          campaignResourceName: `customers/${ads.customerId}/campaigns/${id}`,
          budgetResourceName: gate.budgetResourceName,
          ...patch,
        })
      );
      return text({ ok: true, paused: true, customerId: ads.customerId, campaignId: id, updated });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.registerTool(
  "remove_campaign",
  {
    title: "Remove a paused Google Ads campaign",
    description:
      "Remove one paused campaign. This cannot enable a campaign. A campaign that is not paused is left in place.",
    inputSchema: z.object({
      campaignId: z.string().describe("Digits only."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  async ({ campaignId }) => {
    const id = campaignId.replace(/\D/g, "");
    if (!id) return fail("Campaign id is required. Nothing was removed.");
    try {
      const token = await accessToken();
      const rows = await search(token, campaignLookupQuery(id));
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
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Google Ads MCP failed";
  console.error(redactSecrets(message, [ads.clientSecret, ads.refreshToken, ads.developerToken]));
  process.exit(1);
});
