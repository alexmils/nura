import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdUpdateMutate,
  buildCampaignRemoveMutate,
  buildCampaignUpdateMutate,
  buildKeywordReplaceMutate,
  buildPausedCampaignMutate,
  buildPausedSalesMutate,
  campaignByNameQuery,
  campaignLookupQuery,
  removalNameProblem,
  campaignIdFromMutate,
  existingCampaignDecision,
  googleAdsConfigFromEnv,
  latestCampaignRows,
  NURA_GOOGLE_ADS_MCP_NAME,
  nuraGoogleAdsMcpJson,
  pausedAdIds,
  pausedCampaignGate,
  pausedKeywordGroups,
  redactSecrets,
  rollupCampaignWeek,
  validateCampaignUpdate,
  validatePausedCampaign,
  validatePausedSalesAd,
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
    assert.match(validatePausedCampaign({ ...draft, dailyBudgetUsd: 50 }) ?? "", /5 USD/);
    assert.equal(validatePausedCampaign({ ...draft, dailyBudgetUsd: 5 }), null);
    assert.match(validatePausedCampaign({ ...draft, finalUrl: "https://evil.example" }) ?? "", /nurahelp.com/);
    assert.match(validatePausedCampaign({ ...draft, finalUrl: "https://user:pass@nurahelp.com" }) ?? "", /nurahelp.com/);
    assert.equal(validatePausedCampaign({ ...draft, finalUrl: "https://www.nurahelp.com/pricing" }), null);
  });

  it("defaults the keyword to nura and slices it to 80 characters", () => {
    const omitted = JSON.stringify(buildPausedCampaignMutate("7280736748", { ...draft, keyword: undefined }, 1));
    assert.match(omitted, /"text":"nura"/);
    assert.match(omitted, /"amountMicros":"1000000"/);
    const sized = JSON.stringify(buildPausedCampaignMutate("7280736748", { ...draft, dailyBudgetUsd: 5 }, 1));
    assert.match(sized, /"amountMicros":"5000000"/);
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

  it("updates a paused budget and refuses a live campaign", () => {
    assert.match(validateCampaignUpdate({}) ?? "", /Nothing was changed/);
    assert.match(validateCampaignUpdate({ dailyBudgetUsd: 9 }) ?? "", /5 USD/);
    const body = buildCampaignUpdateMutate({
      campaignResourceName: "customers/7280736748/campaigns/24335695082",
      budgetResourceName: "customers/7280736748/campaignBudgets/15928589183",
      name: "Nura PAUSED",
      dailyBudgetUsd: 2,
    });
    const blob = JSON.stringify(body);
    assert.match(blob, /"amountMicros":"2000000"/);
    assert.match(blob, /"updateMask":"amountMicros"/);
    assert.match(blob, /"updateMask":"name"/);
    assert.equal(blob.includes("ENABLED"), false);
    assert.equal(blob.includes('"status"'), false);
    const nameOnly = JSON.stringify(
      buildCampaignUpdateMutate({
        campaignResourceName: "customers/7280736748/campaigns/24335695082",
        name: "Nura PAUSED",
      })
    );
    assert.equal(nameOnly.includes("campaignBudgetOperation"), false);
    assert.throws(
      () =>
        buildCampaignUpdateMutate({
          campaignResourceName: "customers/7280736748/campaigns/24335695082",
          budgetResourceName: "",
          dailyBudgetUsd: 2,
        }),
      /no budget/
    );
    assert.throws(() => campaignLookupQuery("12 OR 1"), /digits/);
    assert.match(campaignLookupQuery("24335695082"), /explicitly_shared/);
    const removed = JSON.stringify(buildCampaignRemoveMutate("customers/7280736748/campaigns/24335695082"));
    assert.match(removed, /"remove":"customers\/7280736748\/campaigns\/24335695082"/);
    const live = pausedCampaignGate(
      [{ campaign: { id: "1", status: "ENABLED" }, campaignBudget: { resourceName: "customers/1/campaignBudgets/2" } }],
      "1",
      "changed"
    );
    assert.equal(live.ok, false);
    const paused = pausedCampaignGate(
      [{ campaign: { id: "1", status: "PAUSED" }, campaignBudget: { resourceName: "customers/1/campaignBudgets/2" } }],
      "1",
      "changed"
    );
    assert.equal(paused.ok && paused.budgetResourceName, "customers/1/campaignBudgets/2");
    const shared = pausedCampaignGate(
      [
        {
          campaign: { id: "1", status: "PAUSED", name: "Nura PAUSED" },
          campaign_budget: { resource_name: "customers/1/campaignBudgets/9", explicitly_shared: true },
        },
      ],
      "1",
      "changed"
    );
    assert.equal(shared.ok && shared.budgetResourceName, "customers/1/campaignBudgets/9");
    assert.equal(shared.ok && shared.explicitlyShared, true);
    const sharedRow = {
      campaign: { id: "1", status: "PAUSED", name: "Nura PAUSED" },
    };
    assert.equal(removalNameProblem(sharedRow, "Receptly"), "Campaign name does not match this id. Nothing was removed.");
    assert.equal(removalNameProblem(sharedRow, "Nura PAUSED"), null);
  });

  it("updates paused ad copy and replaces the keyword", () => {
    assert.match(validateCampaignUpdate({ finalUrl: "https://evil.example" }) ?? "", /nurahelp.com/);
    assert.match(validateCampaignUpdate({ headlines: ["Nura"] }) ?? "", /3 to 15/);
    const ad = buildAdUpdateMutate("7280736748", ["827454280033"], {
      headlines: ["Nura", "EMDR therapy online", "A calm session app"],
      descriptions: ["Support for therapy. Starting with EMDR.", "A calm app for guided EMDR sessions."],
      finalUrl: "https://nurahelp.com",
    });
    const adBlob = JSON.stringify(ad);
    assert.match(adBlob, /customers\/7280736748\/ads\/827454280033/);
    assert.match(adBlob, /responsiveSearchAd.headlines/);
    assert.match(adBlob, /finalUrls/);
    assert.equal(adBlob.includes("ENABLED"), false);
    const ids = pausedAdIds([{ adGroupAd: { status: "PAUSED", ad: { id: "9" } } }, { ad_group_ad: { status: "ENABLED", ad: { id: "8" } } }]);
    assert.deepEqual(ids, ["9"]);
    const groups = pausedKeywordGroups([
      {
        adGroup: { id: "198726548097" },
        adGroupCriterion: { status: "PAUSED", negative: false, resourceName: "customers/1/adGroupCriteria/198726548097~132241482" },
      },
    ]);
    const keyword = JSON.stringify(buildKeywordReplaceMutate("7280736748", groups, "nura"));
    assert.match(keyword, /"status":"PAUSED"/);
    assert.match(keyword, /"text":"nura"/);
    assert.match(keyword, /adGroupCriteria\/198726548097~132241482/);
    assert.equal(keyword.includes("ENABLED"), false);
    const removeAt = keyword.indexOf("remove");
    const createAt = keyword.indexOf("create");
    assert.ok(removeAt >= 0 && removeAt < createAt);
  });

  it("builds a paused sales search ad and a paused performance max ad", () => {
    const search = JSON.stringify(
      buildPausedSalesMutate("7280736748", { ...draft, format: "search" }, 7)
    );
    assert.match(search, /"advertisingChannelType":"SEARCH"/);
    assert.match(search, /"finalUrls":\["https:\/\/nurahelp.com"\]/);
    assert.equal(search.includes("ENABLED"), false);
    assert.equal(search.match(/"status":"PAUSED"/g)?.length, 4);
    const max = JSON.stringify(
      buildPausedSalesMutate(
        "7280736748",
        {
          ...draft,
          format: "performance_max",
          longHeadline: "A calm app for guided EMDR sessions.",
        },
        7
      )
    );
    assert.match(max, /"advertisingChannelType":"PERFORMANCE_MAX"/);
    assert.match(max, /"finalUrls":\["https:\/\/nurahelp.com"\]/);
    assert.match(max, /"fieldType":"BUSINESS_NAME"/);
    assert.match(max, /"fieldType":"LOGO"/);
    assert.match(max, /"fieldType":"MARKETING_IMAGE"/);
    assert.match(max, /"fieldType":"SQUARE_MARKETING_IMAGE"/);
    assert.match(max, /"fieldType":"LONG_HEADLINE"/);
    assert.equal(max.includes("\"status\":\"ENABLED\""), false);
    assert.equal(max.includes("manualCpc"), false);
    assert.match(validatePausedSalesAd({ ...draft, format: "performance_max" }) ?? "", /long headline/);
    assert.match(
      validatePausedSalesAd({
        ...draft,
        format: "performance_max",
        longHeadline: "A calm app for guided EMDR sessions.",
        finalUrl: "https://evil.example",
      }) ?? "",
      /nurahelp.com/
    );
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
