import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminChildIsActive,
  adminPathMatches,
  buildAdminSearchIndex,
  filterAdminSearch,
} from "../lib/admin-nav.ts";

describe("admin-nav matching", () => {
  it("matches exact and nested paths", () => {
    assert.equal(adminPathMatches("/admin", "/admin", true), true);
    assert.equal(adminPathMatches("/admin/users", "/admin", true), false);
    assert.equal(adminPathMatches("/admin/users/1", "/admin/users"), true);
  });

  it("activates child by tab query with default fallback", () => {
    assert.equal(
      adminChildIsActive(
        "/admin/billing",
        "",
        "/admin/billing",
        { href: "/admin/billing?tab=overview", label: "Overview", tab: "overview" },
        "overview"
      ),
      true
    );
    assert.equal(
      adminChildIsActive(
        "/admin/billing",
        "tab=usage",
        "/admin/billing",
        { href: "/admin/billing?tab=usage", label: "Usage", tab: "usage" },
        "overview"
      ),
      true
    );
    assert.equal(
      adminChildIsActive(
        "/admin/finance",
        "",
        "/admin/finance",
        { href: "/admin/finance", label: "Dashboard", tab: "dashboard" },
        "dashboard"
      ),
      true
    );
    assert.equal(
      adminChildIsActive(
        "/admin/analytics",
        "",
        "/admin/analytics",
        { href: "/admin/analytics", label: "Overview", tab: "overview" },
        "overview"
      ),
      true
    );
  });
});

describe("admin search index", () => {
  it("includes sections, pages, tabs, and settings for platform admin", () => {
    const index = buildAdminSearchIndex(true);
    const titles = index.map((e) => e.title);
    assert.ok(titles.includes("Dashboard"));
    assert.ok(titles.includes("Overview"));
    assert.ok(titles.includes("Stripe"));
    assert.ok(titles.includes("SEO"));
    assert.ok(titles.includes("Settings"));
    assert.ok(index.some((e) => e.href.startsWith("/admin/seo")));
    assert.ok(index.some((e) => e.kind === "section"));
    assert.ok(index.some((e) => e.kind === "tab" && e.href.includes("tab=")));
  });

  it("includes Platform Brand, Guided chat, and Self-guided tabs", () => {
    const index = buildAdminSearchIndex(true);
    assert.ok(
      index.some(
        (e) =>
          e.kind === "tab" &&
          e.href === "/admin/platform?tab=brand" &&
          e.title === "Brand"
      )
    );
    assert.ok(
      index.some(
        (e) =>
          e.kind === "tab" &&
          e.href === "/admin/platform?tab=guided-chat" &&
          e.title === "Guided chat"
      )
    );
    assert.ok(
      index.some(
        (e) =>
          e.kind === "tab" &&
          e.href === "/admin/platform?tab=free-session" &&
          e.title === "Self-guided"
      )
    );
    assert.equal(
      index.some((e) => e.href === "/admin/platform?tab=general"),
      false
    );
  });

  it("hides admin-only system entries for support role", () => {
    const index = buildAdminSearchIndex(false);
    assert.equal(
      index.some((e) => e.href.startsWith("/admin/email")),
      false
    );
    assert.equal(
      index.some((e) => e.href.startsWith("/admin/platform")),
      false
    );
    assert.equal(index.some((e) => e.href === "/admin/mcp"), false);
    assert.ok(index.some((e) => e.href === "/admin/users"));
  });

  it("exposes the MCP token page to platform admin", () => {
    const index = buildAdminSearchIndex(true);
    assert.ok(
      index.some((e) => e.href === "/admin/mcp" && e.title === "MCP"),
      "MCP page should be searchable for platform admin"
    );
  });

  it("filters by page and tab labels", () => {
    const index = buildAdminSearchIndex(true);
    const stripe = filterAdminSearch(index, "stripe");
    assert.ok(stripe.some((e) => e.title === "Stripe"));
    const fin = filterAdminSearch(index, "financ");
    assert.ok(fin.some((e) => e.title === "Finances"));
    assert.deepEqual(filterAdminSearch(index, ""), []);
  });
});
