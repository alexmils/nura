import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ADMIN_HISTORY_FIRST_PAGE,
  ADMIN_HISTORY_PAGE,
  historyPage,
  parseHistoryQuery,
  showingLabel,
} from "../lib/admin-history-page";

describe("admin user page: paged history", () => {
  it("first page is 5 rows, each Load more adds 10", () => {
    assert.equal(ADMIN_HISTORY_FIRST_PAGE, 5);
    assert.equal(ADMIN_HISTORY_PAGE, 10);
  });
  it("parses and clamps the query", () => {
    assert.deepEqual(parseHistoryQuery(new URLSearchParams("kind=logins&offset=5&limit=10")), {
      kind: "logins",
      offset: 5,
      limit: 10,
    });
    assert.deepEqual(parseHistoryQuery(new URLSearchParams("kind=nope&offset=-3&limit=9999")), {
      kind: null,
      offset: 0,
      limit: 50,
    });
    assert.equal(parseHistoryQuery(new URLSearchParams("kind=sessions&limit=abc")).limit, 10);
  });
  it("knows when there is more", () => {
    assert.equal(historyPage([1, 2, 3, 4, 5], 12, 0).hasMore, true);
    assert.equal(historyPage([1, 2], 12, 10).hasMore, false);
  });
  it("labels the count", () => {
    assert.equal(showingLabel(5, 37), "Showing 5 of 37");
    assert.equal(showingLabel(9, 3), "Showing 3 of 3");
    assert.equal(showingLabel(0, 0), "");
  });
});

describe("wiring", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  it("detail loads only the first page plus totals", () => {
    const src = read("lib/admin-user-detail.ts");
    assert.match(src, /listUserAuthEvents\(userId, ADMIN_HISTORY_FIRST_PAGE\)/);
    assert.match(src, /listBillingEventsForUser\(userId, ADMIN_HISTORY_FIRST_PAGE\)/);
    assert.match(src, /getUserAgentHealth\(userId, \{ limit: ADMIN_HISTORY_FIRST_PAGE \}\)/);
    assert.match(src, /countUserAuthEvents\(userId\)/);
  });
  it("queries page with LIMIT/OFFSET on the server", () => {
    assert.match(read("lib/audit-log.ts"), /LIMIT \$2 OFFSET \$3/);
    assert.match(read("lib/billing-events.ts"), /LIMIT \$2 OFFSET \$3/);
    assert.match(read("lib/agent-health.ts"), /LIMIT \$2 OFFSET \$3/);
  });
  it("history route is admin-only", () => {
    const src = read("app/api/admin/users/[id]/history/route.ts");
    assert.match(src, /requireAdminAccess/);
    assert.match(src, /parseHistoryQuery/);
  });
  it("page shows pagers under the three long tables", () => {
    const page = read("app/admin/users/[id]/page.tsx");
    for (const id of ["logins-pager", "payments-pager", "sessions-pager"]) assert.ok(page.includes(id), id);
  });
});
