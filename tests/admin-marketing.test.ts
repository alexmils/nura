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

  it("normalizes Meta account ids", () => {
    assert.equal(normalizeMetaAccountId("123"), "act_123");
    assert.equal(normalizeMetaAccountId("act_9"), "act_9");
    assert.equal(normalizeMetaAccountId("all"), "all");
    assert.equal(isAdsRange("28"), true);
    assert.equal(isAdsRange("14"), false);
    assert.equal(ADS_ALL_ACCOUNTS, "all");
  });
});
