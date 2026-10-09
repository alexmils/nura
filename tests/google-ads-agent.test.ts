import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPausedCampaignMutate,
  campaignIdFromMutate,
  googleAdsConfigFromEnv,
  redactSecrets,
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

  it("rejects a live-sized budget and a bad url", () => {
    assert.match(validatePausedCampaign({ ...draft, dailyBudgetUsd: 50 }) ?? "", /5 USD/);
    assert.match(validatePausedCampaign({ ...draft, finalUrl: "http://nurahelp.com" }) ?? "", /https/);
    assert.equal(validatePausedCampaign(draft), null);
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
