import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPausedCampaignMutate,
  campaignByNameQuery,
  campaignIdFromMutate,
  existingCampaignDecision,
  googleAdsConfigFromEnv,
  latestCampaignRows,
  NURA_GOOGLE_ADS_MCP_NAME,
  nuraGoogleAdsMcpJson,
  redactSecrets,
  rollupCampaignWeek,
  validatePausedCampaign,
} from "../lib/google-ads-agent.ts";

const draft = {
  name: "Nura",
  adGroupName: "Nura visitors",
  headlines: ["Nura", "EMDR therapy online", "A calm session app"],
  descriptions: [
    "Support for therapy. Starting with EMDR.",
    "A calm app for guided EMDR sessions.",
  ],
  finalUrl: "https://nurahelp.com",
  keyword: "nura",
};

describe("google ads paused campaign", () => {
  it("requires the ads env keys and ignores empty login id", () => {
    const missing = googleAdsConfigFromEnv({});
    assert.equal(missing.config, undefined);
    assert.ok(missing.missing.includes("GOOGLE_ADS_REFRESH_TOKEN"));
    const ready = googleAdsConfigFromEnv({
      GOOGLE_ADS_CUSTOMER_ID: "728-073-6748",
      GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
      GOOGLE_ADS_CLIENT_ID: "client",
      GOOGLE_ADS_CLIENT_SECRET: "secret",
      GOOGLE_ADS_REFRESH_TOKEN: "refresh",
      GOOGLE_ADS_API_VERSION: "",
    });
    assert.equal(ready.config?.customerId, "7280736748");
    assert.equal(ready.config?.apiVersion, "v25");
    assert.equal(ready.config?.loginCustomerId, "");
    assert.equal(
      googleAdsConfigFromEnv({
        GOOGLE_ADS_CUSTOMER_ID: "abc",
        GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
        GOOGLE_ADS_CLIENT_ID: "client",
        GOOGLE_ADS_CLIENT_SECRET: "secret",
        GOOGLE_ADS_REFRESH_TOKEN: "refresh",
      }).config,
      undefined
    );
  });

  it("builds a mutate where every delivery status is paused", () => {
    const body = buildPausedCampaignMutate("7280736748", draft, 99);
    const blob = JSON.stringify(body);
    assert.equal(blob.includes("ENABLED"), false);
    assert.equal(blob.match(/"status":"PAUSED"/g)?.length, 4);
    assert.match(blob, /nurahelp.com/);
    assert.match(blob, /languageConstants\/1000/);
    assert.match(blob, /"amountMicros":"1000000"/);
    assert.match(blob, /DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING/);
  });

  it("rejects a zero budget and a url outside nurahelp.com", () => {
    assert.match(validatePausedCampaign({ ...draft, dailyBudgetUsd: 0 }) ?? "", /Nothing was created/);
    assert.equal(validatePausedCampaign({ ...draft, dailyBudgetUsd: 50 }), null);
    assert.match(validatePausedCampaign({ ...draft, finalUrl: "https://evil.example" }) ?? "", /nurahelp.com/);
    assert.match(validatePausedCampaign({ ...draft, finalUrl: "https://user:pass@nurahelp.com" }) ?? "", /nurahelp.com/);
    assert.equal(validatePausedCampaign({ ...draft, finalUrl: "https://www.nurahelp.com/pricing" }), null);
  });

  it("defaults the keyword to nura and slices it to 80 characters", () => {
    const omitted = JSON.stringify(buildPausedCampaignMutate("7280736748", { ...draft, keyword: undefined }, 1));
    assert.match(omitted, /"text":"nura"/);
    assert.match(omitted, /"amountMicros":"1000000"/);
    const sized = JSON.stringify(buildPausedCampaignMutate("7280736748", { ...draft, dailyBudgetUsd: 50 }, 1));
    assert.match(sized, /"amountMicros":"50000000"/);
    const sliced = JSON.stringify(buildPausedCampaignMutate("7280736748", { ...draft, keyword: "n".repeat(120) }, 1));
    assert.match(sliced, new RegExp(`"text":"${"n".repeat(80)}"`));
    assert.equal(sliced.includes("n".repeat(81)), false);
  });

  it("sums a week and keeps the highest campaign ids", () => {
    const week = rollupCampaignWeek([
      { segments: { date: "2026-10-01" }, metrics: { costMicros: "1000000", impressions: "10", clicks: "2" } },
      { segments: { date: "2026-10-02" }, metrics: { cost_micros: "500000", impressions: "5", clicks: "1" } },
    ]);
    assert.equal(week.days, 2);
    assert.equal(week.costMicros, "1500000");
    assert.equal(week.impressions, "15");
    assert.equal(week.clicks, "3");
    assert.equal(week.ctr, 0.2);
    const latest = latestCampaignRows([
      { campaign: { id: "10", name: "Old", status: "PAUSED" } },
      { campaign: { id: "99", name: "New", status: "PAUSED" } },
      { campaign: { id: "50", name: "Gone", status: "REMOVED" } },
    ]);
    assert.deepEqual(
      latest.map((row) => (row as { campaign: { id: string } }).campaign.id),
      ["99", "10"]
    );
  });

  it("reuses a paused name and refuses a live one", () => {
    assert.equal(existingCampaignDecision([]).action, "create");
    assert.deepEqual(
      existingCampaignDecision([{ campaign: { id: "4", status: "PAUSED" } }]),
      { action: "reuse", campaignId: "4" }
    );
    assert.equal(
      existingCampaignDecision([{ campaign: { id: "8", status: "ENABLED" } }]).action,
      "refuse"
    );
    assert.equal(campaignByNameQuery("Nura's ad"), "SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = 'Nura\\'s ad'");
  });

  it("builds Cherry Studio JSON named Nura Google Ads with an empty env", () => {
    const json = nuraGoogleAdsMcpJson("D:\\Python\\EMDR");
    const parsed = JSON.parse(json) as {
      mcpServers: Record<string, { type: string; command: string; args: string[]; env: Record<string, string> }>;
    };
    const server = parsed.mcpServers[NURA_GOOGLE_ADS_MCP_NAME];
    assert.equal(server.type, "stdio");
    assert.equal(server.command, "npx");
    assert.deepEqual(server.env, {});
    assert.equal(server.args.at(-1), "D:\\Python\\EMDR\\mcp\\google-ads-server.ts");
    assert.equal(json.includes("GOOGLE_ADS"), false);
    assert.equal(nuraGoogleAdsMcpJson("   "), "");
  });

  it("reads the new campaign id and hides secrets", () => {
    assert.equal(
      campaignIdFromMutate({
        mutateOperationResponses: [
          { campaignBudgetResult: { resourceName: "customers/1/campaignBudgets/9" } },
          { campaignResult: { resourceName: "customers/1/campaigns/24335695082" } },
        ],
      }),
      "24335695082"
    );
    assert.equal(redactSecrets("oauth failed refresh-token-value", ["refresh-token-value"]), "oauth failed [redacted]");
  });
});
