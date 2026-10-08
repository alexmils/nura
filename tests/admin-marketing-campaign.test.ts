import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountSeriesForOnlyCampaign,
  adsStatusLabel,
  buildGoogleCampaignView,
  buildMetaCampaignView,
  googleTypeLabel,
  isCampaignId,
  marketingCampaignHref,
  marketingTabHref,
  metaObjectiveLabel,
} from "../lib/admin-marketing-campaign.ts";
import type { GoogleAdsCampaign, MarketingLine, MetaAdsCampaign } from "../lib/admin-marketing-types.ts";

const googleCampaign: GoogleAdsCampaign = {
  id: "100",
  name: "Campaign #1",
  sites: ["receptly.app"],
  status: "PAUSED",
  channelType: "PERFORMANCE_MAX",
  noDelivery: false,
  cost: 0,
  impressions: 12,
  clicks: 0,
  ctr: 0,
  averageCpc: 0,
  conversions: 0,
  conversionsValue: 0,
};

const assetGroup: MarketingLine = {
  id: "9",
  name: "Asset Group 1",
  campaignId: "100",
  campaignName: "Campaign #1",
  kind: "Asset group",
  status: "ENABLED",
  sites: ["receptly.app"],
  spend: 0,
  impressions: 0,
  clicks: 0,
  ctr: 0,
  conversions: 0,
};

describe("admin marketing campaign report", () => {
  it("builds a Google campaign without inventing a missing site", () => {
    const view = buildGoogleCampaignView(
      googleCampaign,
      [assetGroup],
      [{ date: "2026-10-01", spend: 0, impressions: 0, clicks: 0, conversions: 0 }],
      "USD",
      "28"
    );
    assert.equal(view.name, "Campaign #1");
    assert.equal(view.status, "Paused");
    assert.equal(view.typeLabel, "Performance Max");
    assert.deepEqual(view.sites, ["receptly.app"]);
    assert.deepEqual(
      view.metrics.map((metric) => metric.label),
      ["Spend", "Impressions", "Clicks", "CTR", "CPC", "Conversions", "Conversion value"]
    );
    assert.equal(view.metrics[0]?.value, "$0.00");
    assert.equal(view.linesTitle, "Ad groups");
    assert.equal(view.lines[0]?.name, "Asset Group 1");
  });

  it("omits metrics when the campaign has no delivery row", () => {
    const view = buildGoogleCampaignView(
      { ...googleCampaign, noDelivery: true, sites: [] },
      [],
      [],
      "USD",
      "28"
    );
    assert.deepEqual(view.metrics, []);
    assert.deepEqual(view.sites, []);
  });

  it("keeps Meta reach and leaves out conversions", () => {
    const campaign: MetaAdsCampaign = {
      id: "55",
      name: "Spring",
      accountId: "act_1",
      accountName: "Nura",
      pages: [],
      hasInstagram: false,
      status: "ACTIVE",
      objective: "OUTCOME_TRAFFIC",
      noDelivery: false,
      spend: 4,
      impressions: 100,
      reach: 80,
      clicks: 3,
      ctr: 3,
      cpc: 1.3,
      cpm: 40,
    };
    const view = buildMetaCampaignView(campaign, [], [], "EUR", "7");
    assert.equal(view.typeLabel, "Traffic");
    assert.equal(view.status, "Active");
    assert.equal(view.linesTitle, "Ads");
    assert.ok(view.metrics.some((metric) => metric.label === "Reach"));
    assert.equal(
      view.metrics.some((metric) => metric.label === "Conversions"),
      false
    );
    assert.equal(metaObjectiveLabel(null), null);
    assert.equal(googleTypeLabel("UNKNOWN"), null);
    assert.equal(adsStatusLabel("CAMPAIGN_PAUSED"), "Campaign paused");
  });

  it("reuses the account series only for a single campaign", () => {
    const series = [
      { date: "2026-10-01", spend: 1, impressions: 1, clicks: 1, conversions: 0 },
      { date: "2026-10-02", spend: 0, impressions: 0, clicks: 0, conversions: 0 },
    ];
    assert.equal(accountSeriesForOnlyCampaign(["100"], "100", series), series);
    assert.equal(accountSeriesForOnlyCampaign(["100", "200"], "100", series), null);
    assert.equal(accountSeriesForOnlyCampaign(["100"], "100", series.slice(0, 1)), null);
  });

  it("builds a campaign url that returns to the Google tab", () => {
    assert.equal(isCampaignId("100"), true);
    assert.equal(isCampaignId("abc"), false);
    assert.equal(
      marketingCampaignHref({ id: "100", channel: "google", range: "28" }),
      "/admin/marketing/campaign/100?channel=google&tab=google"
    );
    assert.equal(marketingTabHref("google", "90"), "/admin/marketing?tab=google&range=90");
    assert.equal(marketingTabHref("meta", "28"), "/admin/marketing");
  });
});
