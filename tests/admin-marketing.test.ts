import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADS_ALL_ACCOUNTS, isAdsRange } from "../lib/ads-range.ts";
import {
  adsWindow,
  countTrackingIds,
  formatAdsMoney,
  isoDaysAgo,
  normalizeMetaAccountId,
  pctDelta,
} from "../lib/admin-marketing-window.ts";
import { addWatchTag, textMatchesWatchTags } from "../lib/ads-watch-tags.ts";
import { collectLandingHosts, indexLandingHosts, landingHost } from "../lib/google-ads-landing.ts";

describe("admin marketing windows", () => {
  const now = new Date("2026-10-08T15:00:00Z");

  it("stops the 28-day window at yesterday", () => {
    assert.deepEqual(adsWindow("28", 0, now), {
      startDate: "2026-09-10",
      endDate: "2026-10-07",
    });
    assert.deepEqual(adsWindow("28", 1, now), {
      startDate: "2026-08-13",
      endDate: "2026-09-09",
    });
  });

  it("has no previous window for all time", () => {
    assert.equal(adsWindow("all", 1, now), null);
    assert.equal(adsWindow("all", 0, now)?.endDate, isoDaysAgo(1, now));
  });

  it("computes percent change", () => {
    assert.equal(pctDelta(12, 20), -40);
    assert.equal(pctDelta(0, 0), null);
    assert.equal(pctDelta(4, 0), 100);
  });

  it("formats money and tracking slots", () => {
    assert.equal(formatAdsMoney(0, "USD"), "$0.00");
    assert.equal(formatAdsMoney(1.5, "EUR"), "€1.50");
    assert.deepEqual(
      countTrackingIds({ ga4: "G-1", gtm: "", clarity: "x", meta: "" }),
      { ids: 2, total: 4 }
    );
  });

  it("reads the landing host from a final URL", () => {
    assert.equal(landingHost("https://www.Receptly.app/book?gclid=1"), "receptly.app");
    assert.equal(landingHost("hubcast.com/start"), "hubcast.com");
    assert.equal(landingHost(""), null);
    assert.deepEqual(
      collectLandingHosts([
        "https://receptly.app/a",
        "https://www.receptly.app/b",
        "https://hubcast.com/",
      ]),
      ["receptly.app", "hubcast.com"]
    );
    const indexed = indexLandingHosts([
      {
        campaign: { id: "1" },
        assetGroup: { finalUrls: ["https://www.receptly.app/"] },
      },
      {
        campaign: { id: "1" },
        adGroupAd: { ad: { finalUrls: ["https://hubcast.com/go"] } },
      },
      { campaign: { id: "2" } },
    ]);
    assert.deepEqual(indexed.get("1"), ["receptly.app", "hubcast.com"]);
    assert.equal(indexed.has("2"), false);
  });

  it("normalizes Meta account ids", () => {
    assert.equal(normalizeMetaAccountId("123"), "act_123");
    assert.equal(normalizeMetaAccountId("act_9"), "act_9");
    assert.equal(normalizeMetaAccountId("all"), "all");
    assert.equal(isAdsRange("28"), true);
    assert.equal(isAdsRange("14"), false);
    assert.equal(ADS_ALL_ACCOUNTS, "all");
  });
});

describe("ads watch tags", () => {
  it("adds a word on Enter and ignores an empty one", () => {
    assert.deepEqual(addWatchTag([], "  "), []);
    assert.deepEqual(addWatchTag([], " receptly "), ["receptly"]);
    assert.deepEqual(addWatchTag(["receptly"], "Receptly"), ["receptly"]);
    assert.deepEqual(addWatchTag(["receptly"], "nura"), ["receptly", "nura"]);
  });

  it("keeps a campaign when any tag is in the name, account, status, type, or site", () => {
    const google = [
      "Campaign #1",
      "Receptly",
      "PAUSED",
      "PERFORMANCE_MAX",
      "Performance Max",
      "receptly.app",
    ];
    assert.equal(textMatchesWatchTags([], google), true);
    assert.equal(textMatchesWatchTags(["receptly"], google), true);
    assert.equal(textMatchesWatchTags(["nura", "receptly"], google), true);
    assert.equal(textMatchesWatchTags(["hubcast"], google), false);
    assert.equal(textMatchesWatchTags(["paused"], ["CAMPAIGN_PAUSED"]), true);
    assert.equal(textMatchesWatchTags(["traffic"], ["OUTCOME_TRAFFIC", "traffic"]), true);
  });
});
