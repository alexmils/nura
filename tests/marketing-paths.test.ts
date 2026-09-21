import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGtmAllowedPath,
  isMarketingPublicPath,
} from "@/lib/marketing-consent";
import { isFrontendPublicPath } from "@/lib/public-paths";

/** Every public marketing page an ad could land on. */
const PUBLIC_LANDING_PAGES = [
  "/",
  "/about",
  "/editorial",
  "/emdr",
  "/learn",
  "/knowledge",
  "/blog",
  "/changelog",
  "/pricing",
  "/faq",
  "/support",
  "/privacy",
  "/terms",
  "/safety",
  "/limits",
];

describe("marketing tag paths", () => {
  it("loads GA4/GTM/Clarity on every public landing page", () => {
    for (const path of PUBLIC_LANDING_PAGES) {
      assert.ok(isGtmAllowedPath(path), `${path} must load the tags`);
    }
  });

  it("normalises a query string and a trailing slash", () => {
    assert.ok(isGtmAllowedPath("/pricing?gclid=abc"));
    assert.ok(isGtmAllowedPath("/blog/"));
  });

  it("still keeps the console and admin untagged", () => {
    for (const path of [
      "/app",
      "/app/settings",
      "/app/resources",
      "/admin",
      "/admin/seo",
    ]) {
      assert.ok(!isGtmAllowedPath(path), `${path} must stay untagged`);
    }
  });

  it("covers the conversion funnel but not the whole console", () => {
    assert.ok(isGtmAllowedPath("/app/create-account"));
    assert.ok(isGtmAllowedPath("/app/onboarding"));
    assert.ok(isGtmAllowedPath("/app/billing"));
    assert.ok(!isGtmAllowedPath("/app/login"));
  });

  it("agrees with the canonical public path list", () => {
    // A locally kept copy of this list once drifted and silently dropped
    // /pricing, /faq, and /support — no tags, no captured click.
    for (const path of PUBLIC_LANDING_PAGES) {
      assert.equal(
        isMarketingPublicPath(path),
        isFrontendPublicPath(path),
        `${path} disagrees with the canonical list`
      );
    }
  });
});
