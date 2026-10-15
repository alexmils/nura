import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  sqlRowCountsInStats,
  sqlUserCountsInStats,
} from "../lib/stats-scope.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("stats scope", () => {
  it("filters a users alias", () => {
    assert.equal(sqlUserCountsInStats("u"), "u.stats_excluded IS NOT TRUE");
  });

  it("filters a foreign user id", () => {
    const sql = sqlRowCountsInStats("t.user_id");
    assert.match(sql, /_su\.id = t\.user_id/);
    assert.match(sql, /stats_excluded IS NOT TRUE/);
  });

  it("keeps excluded users out of aggregate queries", () => {
    for (const file of [
      "lib/llm-usage.ts",
      "lib/admin-stats.ts",
      "lib/admin-analytics.ts",
      "lib/admin-finance.ts",
    ]) {
      const src = read(file);
      assert.match(src, /sqlRowCountsInStats|sqlUserCountsInStats/, file);
    }
    const totals = read("lib/llm-usage.ts");
    const totalsFn = totals.slice(totals.indexOf("export async function getLlmUsageTotals"));
    assert.match(totalsFn, /sqlRowCountsInStats\("user_id"\)/);
  });

  it("limits counted usage before mixing in ignored rows", () => {
    const src = read("lib/usage.ts");
    assert.match(src, /sqlUserCountsInStats\("u"\)/);
    assert.match(src, /u\.stats_excluded IS TRUE/);
    const counted = src.indexOf('sqlUserCountsInStats("u")');
    const ignored = src.indexOf("u.stats_excluded IS TRUE");
    assert.ok(counted > 0 && ignored > counted);
    assert.match(src, /WHERE \$\{whereSql\}[\s\S]*LIMIT \$1/);
  });

  it("does not wrap the week chart in the analytics link", () => {
    const page = read("app/admin/page.tsx");
    assert.doesNotMatch(page, /admin-panel-link/);
    assert.match(page, /admin-panel-title-link/);
    const chart = page.indexOf("<AdminStackedBars");
    const sectionEnd = page.indexOf("</section>", chart);
    assert.ok(chart > 0 && sectionEnd > chart);
    assert.doesNotMatch(page.slice(chart, sectionEnd), /<Link/);
  });

  it("keeps usage ignore errors off the Stripe form", () => {
    const page = read("app/admin/billing/page.tsx");
    assert.match(page, /setUsageBusy/);
    assert.match(page, /setUsageMsg/);
    const fn = page.slice(page.indexOf("const setStatsExcluded"));
    const body = fn.slice(0, fn.indexOf("const active"));
    assert.match(body, /setUsageBusy/);
    assert.doesNotMatch(body, /setBusy\(/);
    assert.doesNotMatch(body, /setMsg\(/);
  });
});
