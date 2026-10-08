import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  maskIpForDisplay,
  parseAnalyticsIgnoreIps,
  isIgnoredAnalyticsIp,
} from "../lib/analytics-ignore.ts";
import {
  DEFAULT_PLATFORM_SEO,
  isAllowedOgImageUrl,
  isValidClarityId,
  isValidGa4Id,
  isValidGtmId,
  maskPublicId,
  normalizeSeoConfig,
  parseServiceAccountEmail,
} from "../lib/seo-config.ts";
import {
  mergeSeoConfigPatch,
  toSeoAdminView,
  validateSeoConfigPatch,
} from "../lib/seo-admin-settings.ts";
import {
  BRAND_DESCRIPTION,
  BRAND_LIMITS_LINE,
  BRAND_SPOKEN,
  BRAND_TITLE,
  BRAND_TITLE_STEM,
  stripBrandTitleSuffix,
} from "../lib/brand.ts";
import {
  buildMarketingSeoStatus,
  metadataFromResolved,
  publicMarketingTags,
  resolveSiteSeoPages,
  SITE_SEO_DEFAULTS,
  siteOrigin,
} from "../lib/site-seo.ts";
import {
  disconnectedSiteAnalytics,
  parseAnalyticsRange,
  parseGa4PropertyId,
} from "../lib/site-analytics.ts";
import {
  isLikelyIpOrCidr,
  isSeoTestConnId,
  testSeoConnection,
} from "../lib/seo-test-connection.ts";
import {
  analyticsConsentJustGranted,
  consentToClarityV2,
  consentToMode,
  isGtmAllowedPath,
  isMarketingPublicPath,
} from "../lib/marketing-consent.ts";
import { normalizeSettingsForTest } from "../lib/platform-settings.ts";

describe("seo-config", () => {
  it("normalizes empty and validates public IDs", () => {
    const empty = normalizeSeoConfig(null);
    assert.equal(empty.ga4MeasurementId, "");
    assert.ok(isValidGa4Id("G-ABC123"));
    assert.ok(!isValidGa4Id("GTM-ABC"));
    assert.ok(isValidGtmId("GTM-WPH9W82M"));
    assert.ok(isValidClarityId("y27pwugoug"));
    assert.equal(maskPublicId("G-ABCDEFGH"), "••••EFGH");
  });

  it("allows only https or root-relative OG URLs", () => {
    assert.ok(isAllowedOgImageUrl("https://nurahelp.com/og.png"));
    assert.ok(isAllowedOgImageUrl("/brand/lockup.png"));
    assert.ok(
      isAllowedOgImageUrl("data:image/jpeg;base64,/9j/4AAQ")
    );
    assert.ok(!isAllowedOgImageUrl("http://insecure.example/x.png"));
    assert.ok(!isAllowedOgImageUrl("javascript:alert(1)"));
    assert.ok(!isAllowedOgImageUrl("//cdn.example/x.png"));
  });

  it("drops disallowed OG URLs on normalize", () => {
    const seo = normalizeSeoConfig({
      pages: { home: { ogImageUrl: "javascript:alert(1)" } },
    });
    assert.equal(seo.pages.home, undefined);
  });

  it("keeps defaultOgImageUrl when valid", () => {
    const seo = normalizeSeoConfig({
      defaultOgImageUrl: "/brand/custom-og.png",
    });
    assert.equal(seo.defaultOgImageUrl, "/brand/custom-og.png");
  });

  it("parses service account email", () => {
    assert.equal(
      parseServiceAccountEmail(
        JSON.stringify({ client_email: "bot@nura.iam.gserviceaccount.com" })
      ),
      "bot@nura.iam.gserviceaccount.com"
    );
    assert.equal(parseServiceAccountEmail("not-json"), null);
  });
});

describe("seo-admin-settings", () => {
  it("redacts secrets and keeps them on empty patch", () => {
    const current = normalizeSeoConfig({
      gscVerification: "secret-gsc",
      bingVerification: "secret-bing",
      googleServiceAccountJson: JSON.stringify({
        client_email: "sa@example.com",
        private_key: "x",
      }),
      ga4MeasurementId: "G-TEST",
    });
    const view = toSeoAdminView(current, true);
    assert.equal(view.gscVerification, "");
    assert.equal(view.hasGscVerification, true);
    assert.equal(view.serviceAccountEmail, "sa@example.com");
    assert.equal(view.ga4MeasurementId, "G-TEST");

    const merged = mergeSeoConfigPatch(current, {
      ga4MeasurementId: "G-NEW",
      gscVerification: "",
      googleServiceAccountJson: "",
    });
    assert.equal(merged.ga4MeasurementId, "G-NEW");
    assert.equal(merged.gscVerification, "secret-gsc");
    assert.ok(merged.googleServiceAccountJson.includes("sa@example.com"));
  });

  it("clears secrets when patch sends off", () => {
    const current = normalizeSeoConfig({
      gscVerification: "secret-gsc",
      bingVerification: "secret-bing",
      googleServiceAccountJson: JSON.stringify({
        client_email: "sa@example.com",
        private_key: "x",
      }),
    });
    const cleared = mergeSeoConfigPatch(current, {
      gscVerification: "off",
      bingVerification: "clear",
      googleServiceAccountJson: "-",
    });
    assert.equal(cleared.gscVerification, "");
    assert.equal(cleared.bingVerification, "");
    assert.equal(cleared.googleServiceAccountJson, "");
  });

  it("merges page overrides", () => {
    const current = normalizeSeoConfig({});
    const next = mergeSeoConfigPatch(current, {
      pages: { home: { title: "Custom Home", description: "Desc" } },
    });
    assert.equal(next.pages.home?.title, "Custom Home");
  });

  it("validates connection IDs on patch", () => {
    assert.deepEqual(validateSeoConfigPatch({ ga4MeasurementId: "G-OK12" }), []);
    assert.ok(
      validateSeoConfigPatch({ ga4MeasurementId: "bad" })[0]?.includes(
        "Google Analytics"
      )
    );
    assert.ok(
      validateSeoConfigPatch({ gtmId: "G-ABC" })[0]?.includes("Tag Manager")
    );
    assert.ok(
      validateSeoConfigPatch({
        pages: { home: { ogImageUrl: "http://x.com/a.png" } },
      })[0]?.includes("Share image")
    );
  });
});

describe("analytics-ignore", () => {
  it("parses IP lists and masks display", () => {
    assert.deepEqual(parseAnalyticsIgnoreIps(""), []);
    assert.deepEqual(parseAnalyticsIgnoreIps("off"), []);
    assert.deepEqual(parseAnalyticsIgnoreIps("1.2.3.4, 5.6.7.8"), [
      "1.2.3.4",
      "5.6.7.8",
    ]);
    assert.ok(isIgnoredAnalyticsIp("1.2.3.4", ["1.2.3.4"]));
    assert.equal(maskIpForDisplay("109.245.163.63"), "109.245...");
  });
});

describe("site-seo status", () => {
  it("builds connection cards from config", () => {
    const seo = normalizeSeoConfig({
      ga4MeasurementId: "G-ABCD1234",
      gtmId: "GTM-XXXXYYY",
      clarityId: "abcd1234",
      gscProperty: "sc-domain:nurahelp.com",
      ignoreIps: "10.0.0.1",
    });
    const pages = resolveSiteSeoPages(seo, "https://nurahelp.com");
    const status = buildMarketingSeoStatus(seo, pages, "https://nurahelp.com");
    assert.equal(status.canonical, "https://nurahelp.com/");
    assert.equal(status.llmsTxtUrl, "https://nurahelp.com/llms.txt");
    assert.match(
      pages[0]?.ogImageUrl || "",
      /^https:\/\/nurahelp\.com\/og\?/
    );
    const connected = status.connections.filter((c) => c.status === "connected");
    assert.ok(connected.length >= 5);
    const meta = status.connections.find((c) => c.id === "meta");
    assert.equal(meta?.status, "via_tag_manager");
    const googleAds = status.connections.find((c) => c.id === "google_ads");
    assert.equal(googleAds?.name, "Google Ads");
    assert.equal(googleAds?.status, "not_connected");
  });

  it("maps data URL OG images to the public /og-image route", () => {
    const seo = normalizeSeoConfig({
      defaultOgImageUrl: "data:image/jpeg;base64,/9j/4AAQ",
      pages: {
        about: { ogImageUrl: "data:image/png;base64,iVBORw0KGgo=" },
      },
    });
    const pages = resolveSiteSeoPages(seo, "https://nurahelp.com");
    const home = pages.find((p) => p.id === "home");
    const about = pages.find((p) => p.id === "about");
    assert.equal(home?.ogImageUrl, "https://nurahelp.com/og-image?scope=default");
    assert.equal(about?.ogImageUrl, "https://nurahelp.com/og-image?page=about");
  });

  it("uses publicAppUrl for site origin", () => {
    assert.equal(siteOrigin("https://dev.nurahelp.com/app"), "https://dev.nurahelp.com");
  });

  it("flags ignore-IP checks without skipping tags at render", () => {
    const empty = publicMarketingTags(DEFAULT_PLATFORM_SEO, false);
    assert.equal(empty.checkIgnoreIps, false);
    assert.equal(empty.skipAnalytics, false);
    const withIgnore = publicMarketingTags(
      { ...DEFAULT_PLATFORM_SEO, ignoreIps: "10.0.0.1" },
      false
    );
    assert.equal(withIgnore.checkIgnoreIps, true);
    assert.equal(withIgnore.skipAnalytics, false);
    const skipped = publicMarketingTags(
      { ...DEFAULT_PLATFORM_SEO, ignoreIps: "10.0.0.1" },
      true
    );
    assert.equal(skipped.skipAnalytics, true);
    assert.equal(skipped.checkIgnoreIps, false);
  });
});

describe("public page titles and descriptions", () => {
  it("gives every public page a unique meta description", () => {
    const descriptions = SITE_SEO_DEFAULTS.map((page) => page.description);
    assert.equal(new Set(descriptions).size, descriptions.length);
    for (const page of SITE_SEO_DEFAULTS) {
      if (page.id === "home") {
        assert.equal(page.description, BRAND_DESCRIPTION);
        continue;
      }
      assert.notEqual(page.description, BRAND_DESCRIPTION, page.id);
    }
  });

  it("gives home and EMDR unique money titles with bilateral stimulation", () => {
    const home = SITE_SEO_DEFAULTS.find((page) => page.id === "home");
    const emdr = SITE_SEO_DEFAULTS.find((page) => page.id === "emdr");
    assert.equal(home?.title, BRAND_TITLE_STEM);
    assert.match(BRAND_TITLE, new RegExp(`^${BRAND_TITLE_STEM} — ${BRAND_SPOKEN}$`));
    assert.notEqual(home?.title, emdr?.title);
    assert.match(home?.title || "", /EMDR Therapy Online/i);
    assert.match(home?.title || "", /Bilateral Stimulation/i);
    assert.match(emdr?.title || "", /AI EMDR App/i);
    assert.match(emdr?.title || "", /Bilateral Stimulation/i);
    for (const page of [home, emdr]) {
      assert.doesNotMatch(page?.title || "", /\bAi\b/);
      assert.doesNotMatch(page?.title || "", /\| Nura/);
    }
  });

  it("uses a trailing slash on the homepage canonical", () => {
    const pages = resolveSiteSeoPages(DEFAULT_PLATFORM_SEO, "https://nurahelp.com");
    const home = pages.find((p) => p.id === "home");
    assert.equal(home?.canonical, "https://nurahelp.com/");
    assert.match(
      String((metadataFromResolved("home", pages).alternates as { canonical?: string })?.canonical),
      /nurahelp\.com\/$/
    );
  });

  it("uses the layout title template instead of absolute titles", () => {
    const pages = resolveSiteSeoPages(DEFAULT_PLATFORM_SEO, "https://nurahelp.com");
    const meta = metadataFromResolved("emdr", pages);
    assert.equal(typeof meta.title, "string");
    assert.equal(meta.title, "AI EMDR App — Guided Bilateral Stimulation Online");
  });

  it("uses an absolute document title on home so Nura is not dropped", () => {
    const pages = resolveSiteSeoPages(DEFAULT_PLATFORM_SEO, "https://nurahelp.com");
    const meta = metadataFromResolved("home", pages);
    assert.deepEqual(meta.title, { absolute: BRAND_TITLE });
  });

  it("strips brand suffixes so the layout template cannot double Nura", () => {
    assert.equal(
      stripBrandTitleSuffix("AI Guided EMDR Therapy Online | Nura"),
      "AI Guided EMDR Therapy Online",
    );
    assert.equal(
      stripBrandTitleSuffix("AI-guided EMDR therapy online — Nura"),
      "AI-guided EMDR therapy online",
    );
    assert.equal(
      stripBrandTitleSuffix("How clinical review works at Nura"),
      "How clinical review works",
    );
    assert.equal(stripBrandTitleSuffix("Ai guided EMDR"), "AI guided EMDR");

    const pages = resolveSiteSeoPages(
      {
        ...DEFAULT_PLATFORM_SEO,
        pages: {
          home: {
            title: "Ai Guided EMDR Therapy Online — Bilateral Stimulation App | Nura",
            description: BRAND_DESCRIPTION,
          },
          emdr: {
            title: "AI EMDR Therapy App — Guided Bilateral Stimulation | Nura",
            description: "value only",
          },
        },
      },
      "https://nurahelp.com",
    );
    // Retired production titles fall back to clean defaults
    assert.equal(pages.find((p) => p.id === "home")?.title, BRAND_TITLE_STEM);
    assert.equal(
      pages.find((p) => p.id === "emdr")?.title,
      "AI EMDR App — Guided Bilateral Stimulation Online",
    );
    const homeMeta = metadataFromResolved("home", pages);
    assert.deepEqual(homeMeta.title, { absolute: BRAND_TITLE });
    assert.doesNotMatch(String((homeMeta.title as { absolute: string }).absolute), /Nura — Nura/);
  });

  it("keeps meta descriptions value-first without the licensed-therapist disclaimer", () => {
    const pages = resolveSiteSeoPages(DEFAULT_PLATFORM_SEO, "https://nurahelp.com");
    for (const page of pages) {
      assert.doesNotMatch(
        page.description,
        /not a licensed therapist/i,
        page.id,
      );
      assert.doesNotMatch(page.description, /when configured/i, page.id);
    }
    const blog = pages.find((p) => p.id === "blog");
    assert.match(blog?.description || "", /bilateral stimulation/i);
    assert.match(blog?.description || "", /between sessions/i);
    assert.match(BRAND_LIMITS_LINE, /not therapy, diagnosis, or crisis care/);
  });

  it("ignores retired Admin SEO defaults so unique copy can ship", () => {
    const pages = resolveSiteSeoPages(
      {
        ...DEFAULT_PLATFORM_SEO,
        pages: {
          about: {
            title: "About",
            description: BRAND_DESCRIPTION,
          },
          emdr: {
            title: "EMDR Support",
            description:
              "What EMDR is, how visual sets work, and how a Nura session is structured.",
          },
          learn: {
            title: "Resources",
            description: "Guides for EMDR and therapy support on Nura.",
          },
          privacy: {
            title: "Privacy",
            description: "Privacy policy for NuraHelp",
          },
          terms: {
            title: "Terms",
            description: "Terms of service for NuraHelp",
          },
        },
      },
      "https://nurahelp.com"
    );
    const byId = Object.fromEntries(pages.map((p) => [p.id, p]));
    assert.equal(byId.about?.title, "About the EMDR therapy online app");
    assert.equal(
      byId.emdr?.title,
      "AI EMDR App — Guided Bilateral Stimulation Online"
    );
    assert.equal(byId.learn?.title, "Learn EMDR — Guides by Topic, Safety & Practice");
    assert.equal(byId.blog?.title, "EMDR Articles — Guides, Visual Sets & Safety");
    assert.equal(byId.terms?.title, "Terms of service");
    assert.notEqual(byId.about?.description, BRAND_DESCRIPTION);
    assert.notEqual(byId.privacy?.description, "Privacy policy for NuraHelp");
    const custom = resolveSiteSeoPages(
      {
        ...DEFAULT_PLATFORM_SEO,
        pages: { about: { title: "Our story", description: "Custom about blurb." } },
      },
      "https://nurahelp.com"
    );
    const about = custom.find((p) => p.id === "about");
    assert.equal(about?.title, "Our story");
    assert.equal(about?.description, "Custom about blurb.");
  });
});

describe("site-analytics helpers", () => {
  it("parses range and property id", () => {
    assert.equal(parseAnalyticsRange("28d"), "28d");
    assert.equal(parseAnalyticsRange("7"), "7d");
    assert.equal(parseGa4PropertyId("properties/123"), "123");
    assert.equal(parseGa4PropertyId("G-ABC"), null);
    const d = disconnectedSiteAnalytics("7d", { email: "a@b.com" });
    assert.equal(d.connected, false);
    assert.ok(d.setupNote);
  });
});

describe("marketing consent paths", () => {
  it("allows public marketing paths only", () => {
    assert.ok(isMarketingPublicPath("/"));
    assert.ok(isMarketingPublicPath("/about"));
    assert.ok(isMarketingPublicPath("/privacy"));
    assert.ok(isMarketingPublicPath("/blog"));
    assert.ok(isMarketingPublicPath("/blog/what-is-emdr"));
    assert.ok(isMarketingPublicPath("/editorial"));
    assert.ok(isMarketingPublicPath("/changelog"));
    assert.ok(!isMarketingPublicPath("/app"));
    assert.ok(!isMarketingPublicPath("/app/login"));
    assert.ok(!isMarketingPublicPath("/admin/seo"));
  });

  it("allows GTM on marketing and conversion funnels", () => {
    assert.ok(isGtmAllowedPath("/emdr"));
    assert.ok(isGtmAllowedPath("/app/create-account"));
    assert.ok(isGtmAllowedPath("/app/onboarding"));
    assert.ok(isGtmAllowedPath("/app/billing"));
    assert.ok(!isGtmAllowedPath("/app/settings"));
    assert.ok(!isGtmAllowedPath("/app/login"));
  });

  it("maps consent to Google Consent Mode", () => {
    assert.deepEqual(consentToMode(null), {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    assert.equal(
      consentToMode({
        analytics: true,
        marketing: false,
        updatedAt: "2026-01-01",
      }).analytics_storage,
      "granted"
    );
    assert.equal(
      consentToMode({
        analytics: true,
        marketing: false,
        updatedAt: "2026-01-01",
      }).ad_storage,
      "denied"
    );
  });

  it("maps consent to Clarity consentv2", () => {
    assert.deepEqual(consentToClarityV2(null), {
      ad_Storage: "denied",
      analytics_Storage: "denied",
    });
    assert.deepEqual(
      consentToClarityV2({
        analytics: true,
        marketing: true,
        updatedAt: "2026-01-01",
      }),
      {
        ad_Storage: "granted",
        analytics_Storage: "granted",
      }
    );
  });

  it("detects analytics consent just granted", () => {
    assert.equal(
      analyticsConsentJustGranted(null, {
        analytics: true,
        marketing: false,
        updatedAt: "2026-01-01",
      }),
      true
    );
    assert.equal(
      analyticsConsentJustGranted(
        {
          analytics: true,
          marketing: true,
          updatedAt: "2026-01-01",
        },
        {
          analytics: true,
          marketing: true,
          updatedAt: "2026-01-02",
        }
      ),
      false
    );
    assert.equal(
      analyticsConsentJustGranted(
        {
          analytics: false,
          marketing: false,
          updatedAt: "2026-01-01",
        },
        {
          analytics: true,
          marketing: false,
          updatedAt: "2026-01-02",
        }
      ),
      true
    );
  });
});

describe("platform settings seo block", () => {
  it("includes default seo on normalize", () => {
    const s = normalizeSettingsForTest({ siteName: "Nura" });
    assert.ok(s.seo);
    assert.equal(s.seo.ga4MeasurementId, "");
    assert.deepEqual(s.seo.pages, {});
  });
});

describe("seo-test-connection", () => {
  it("recognizes connection types", () => {
    assert.ok(isSeoTestConnId("ga4"));
    assert.ok(isSeoTestConnId("gsc"));
    assert.ok(!isSeoTestConnId("meta"));
  });

  it("validates ignore IP entries", () => {
    assert.ok(isLikelyIpOrCidr("1.2.3.4"));
    assert.ok(isLikelyIpOrCidr("10.0.0.0/8"));
    assert.ok(!isLikelyIpOrCidr("999.1.1.1"));
    assert.ok(!isLikelyIpOrCidr("not-an-ip"));
  });

  it("checks bing code and ignore list without network", async () => {
    const empty = { ...DEFAULT_PLATFORM_SEO, pages: {} };
    const bing = await testSeoConnection(
      { type: "bing", bingVerification: "AbCdEfGhIjKlMnOp" },
      empty
    );
    assert.equal(bing.ok, true);
    assert.match(bing.profile || "", /Bing/);

    const ips = await testSeoConnection(
      { type: "ignore_ips", ignoreIps: "1.2.3.4, 5.6.7.8" },
      empty
    );
    assert.equal(ips.ok, true);
    assert.equal(ips.profile, "2 addresses");

    const badIp = await testSeoConnection(
      { type: "ignore_ips", ignoreIps: "nope" },
      empty
    );
    assert.equal(badIp.ok, false);

    const ga4format = await testSeoConnection(
      { type: "ga4", ga4MeasurementId: "G-TEST1234" },
      empty
    );
    assert.equal(ga4format.ok, true);
    assert.equal(ga4format.profile, "G-TEST1234");
  });
});
