import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADS_REPORT_TTL_MS,
  adsReportShouldFetch,
  formatAdsUpdatedAgo,
  googleAdsCacheKey,
  loadThroughAdsCache,
  metaAdsCacheKey,
  stripAdsCacheSecrets,
  type AdsReportStore,
} from "../lib/admin-ads-cache.ts";

function memoryStore(): AdsReportStore & {
  rows: Map<string, { at: number; data: unknown }>;
  writes: number;
} {
  const rows = new Map<string, { at: number; data: unknown }>();
  let writes = 0;
  return {
    rows,
    get writes() {
      return writes;
    },
    async read<T>(key: string) {
      const row = rows.get(key);
      return row ? { at: row.at, data: row.data as T } : null;
    },
    async write(key: string, data: unknown, at: number) {
      writes += 1;
      rows.set(key, { at, data });
    },
  };
}

describe("admin ads report cache", () => {
  const now = Date.parse("2026-10-09T12:00:00Z");

  it("uses one key for overview and marketing", () => {
    assert.equal(metaAdsCacheKey("act_1", "28"), "meta:act_1:28");
    assert.equal(googleAdsCacheKey("7280736748", "28"), "gads:7280736748:28");
    assert.equal(metaAdsCacheKey("act_1", "28").includes("detail"), false);
    assert.equal(ADS_REPORT_TTL_MS, 6 * 60 * 60 * 1000);
  });

  it("skips the network when the row is fresh", async () => {
    const store = memoryStore();
    store.rows.set("meta:act_1:28", { at: now - 60_000, data: { spend: 12 } });
    let calls = 0;
    const hit = await loadThroughAdsCache({
      key: "meta:act_1:28",
      store,
      now,
      refresh: false,
      fetchReport: async () => {
        calls += 1;
        return { spend: 99 };
      },
    });
    assert.equal(calls, 0);
    assert.equal(hit.source, "cache");
    assert.deepEqual(hit.data, { spend: 12 });
    assert.equal(store.writes, 0);
  });

  it("fetches when the row is stale or refresh is set", async () => {
    const stale = memoryStore();
    stale.rows.set("gads:1:28", { at: now - ADS_REPORT_TTL_MS - 1, data: { cost: 1 } });
    let staleCalls = 0;
    const staleHit = await loadThroughAdsCache({
      key: "gads:1:28",
      store: stale,
      now,
      refresh: false,
      fetchReport: async () => {
        staleCalls += 1;
        return { cost: 4 };
      },
    });
    assert.equal(staleCalls, 1);
    assert.equal(staleHit.source, "network");
    assert.equal(stale.writes, 1);
    assert.deepEqual(stale.rows.get("gads:1:28")?.data, { cost: 4 });

    const fresh = memoryStore();
    fresh.rows.set("gads:1:28", { at: now - 1000, data: { cost: 1 } });
    let refreshCalls = 0;
    const refreshHit = await loadThroughAdsCache({
      key: "gads:1:28",
      store: fresh,
      now,
      refresh: true,
      fetchReport: async () => {
        refreshCalls += 1;
        return { cost: 8 };
      },
    });
    assert.equal(refreshCalls, 1);
    assert.equal(refreshHit.source, "network");
    assert.equal(adsReportShouldFetch({ cachedAt: now - 1000, now, refresh: true }), true);
    assert.equal(adsReportShouldFetch({ cachedAt: null, now, refresh: false }), true);
  });

  it("keeps the previous report when the fetch fails", async () => {
    const store = memoryStore();
    store.rows.set("meta:act_1:28", { at: now - 1000, data: { spend: 12, error: null } });
    const thrown = await loadThroughAdsCache({
      key: "meta:act_1:28",
      store,
      now,
      refresh: true,
      fetchReport: async () => {
        throw new Error("quota");
      },
    });
    assert.equal(thrown.source, "kept");
    assert.equal(store.writes, 0);
    assert.deepEqual(store.rows.get("meta:act_1:28")?.data, { spend: 12, error: null });

    const rejected = await loadThroughAdsCache({
      key: "meta:act_1:28",
      store,
      now,
      refresh: true,
      failed: (row: { error: string | null }) => Boolean(row.error),
      fetchReport: async () => ({ spend: 0, error: "down" }),
    });
    assert.equal(rejected.source, "kept");
    assert.equal(store.writes, 0);
    assert.deepEqual(rejected.data, { spend: 12, error: null });
  });

  it("drops secrets before a report is stored", async () => {
    const store = memoryStore();
    await loadThroughAdsCache({
      key: "meta:act_1:28",
      store,
      now,
      refresh: true,
      fetchReport: async () => ({
        spend: 3,
        accessToken: "should-not-persist",
        nested: { developerToken: "nope", name: "Brand" },
      }),
    });
    assert.deepEqual(store.rows.get("meta:act_1:28")?.data, {
      spend: 3,
      nested: { name: "Brand" },
    });
    assert.deepEqual(
      stripAdsCacheSecrets({ appSecret: "x", accountName: "Nura" }),
      { accountName: "Nura" }
    );
  });

  it("formats the age in sentence case", () => {
    assert.equal(
      formatAdsUpdatedAgo(new Date(now - 2 * 60 * 60 * 1000).toISOString(), now),
      "Updated 2 hours ago"
    );
    assert.equal(formatAdsUpdatedAgo(new Date(now - 10_000).toISOString(), now), "Updated just now");
  });
});
