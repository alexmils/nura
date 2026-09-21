import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PLATFORM_SEO,
  normalizeSeoConfig,
  type PlatformSeoConfig,
} from "@/lib/seo-config";
import {
  mergeSeoConfigPatch,
  toSeoAdminView,
  validateSeoConfigPatch,
} from "@/lib/seo-admin-settings";
import { buildConversionConfig } from "@/lib/conversions/config";

function seo(overrides: Partial<PlatformSeoConfig> = {}): PlatformSeoConfig {
  return { ...DEFAULT_PLATFORM_SEO, pages: {}, ...overrides };
}

describe("conversion settings normalisation", () => {
  it("defaults every conversion field on a row stored before they existed", () => {
    const normalized = normalizeSeoConfig({ ga4MeasurementId: "G-66YC11GTZE" });
    assert.equal(normalized.ga4ApiSecret, "");
    assert.equal(normalized.metaPixelId, "");
    assert.equal(normalized.metaCapiAccessToken, "");
    assert.equal(normalized.googleAdsOAuthRefreshToken, "");
    assert.equal(normalized.googleAdsApiVersion, "");
  });

  it("trims and keeps what the admin saved", () => {
    const normalized = normalizeSeoConfig({
      ga4ApiSecret: "  bflgBYXfQ8C30kU5lBT-ng  ",
      metaPixelId: "1120650977294654",
    });
    assert.equal(normalized.ga4ApiSecret, "bflgBYXfQ8C30kU5lBT-ng");
    assert.equal(normalized.metaPixelId, "1120650977294654");
  });
});

describe("admin view", () => {
  it("never sends a stored credential back to the browser", () => {
    const view = toSeoAdminView(
      seo({
        ga4ApiSecret: "super-secret",
        metaCapiAccessToken: "meta-secret",
        googleAdsDeveloperToken: "dev-secret",
        googleAdsOAuthClientSecret: "client-secret",
        googleAdsOAuthRefreshToken: "refresh-secret",
      }),
      true
    );
    assert.equal(view.ga4ApiSecret, "");
    assert.equal(view.metaCapiAccessToken, "");
    assert.equal(view.googleAdsDeveloperToken, "");
    assert.equal(view.googleAdsOAuthClientSecret, "");
    assert.equal(view.googleAdsOAuthRefreshToken, "");
    assert.equal(JSON.stringify(view).includes("super-secret"), false);
    assert.equal(JSON.stringify(view).includes("refresh-secret"), false);
  });

  it("flags which credentials are already set", () => {
    const view = toSeoAdminView(
      seo({ ga4ApiSecret: "set", metaCapiAccessToken: "   " }),
      true
    );
    assert.equal(view.hasGa4ApiSecret, true);
    assert.equal(view.hasMetaCapiAccessToken, false);
    assert.equal(view.hasGoogleAdsOAuthRefreshToken, false);
  });

  it("echoes the non-secret identifiers", () => {
    const view = toSeoAdminView(
      seo({
        metaPixelId: "1120650977294654",
        googleAdsCustomerId: "3522581611327832",
        googleAdsApiVersion: "v22",
      }),
      true
    );
    assert.equal(view.metaPixelId, "1120650977294654");
    assert.equal(view.googleAdsCustomerId, "3522581611327832");
    assert.equal(view.googleAdsApiVersion, "v22");
  });
});

describe("admin patch merge", () => {
  it("keeps a stored credential when the field is left blank", () => {
    const current = seo({ ga4ApiSecret: "stored-secret" });
    const merged = mergeSeoConfigPatch(current, { ga4ApiSecret: "" });
    assert.equal(merged.ga4ApiSecret, "stored-secret");
  });

  it("replaces a credential when a new one is typed", () => {
    const merged = mergeSeoConfigPatch(seo({ ga4ApiSecret: "old" }), {
      ga4ApiSecret: "new-secret-value",
    });
    assert.equal(merged.ga4ApiSecret, "new-secret-value");
  });

  it("clears a credential on the off token", () => {
    for (const token of ["off", "-", "none", "clear", " OFF "]) {
      const merged = mergeSeoConfigPatch(seo({ metaCapiAccessToken: "old" }), {
        metaCapiAccessToken: token,
      });
      assert.equal(merged.metaCapiAccessToken, "");
    }
  });

  it("replaces a stored identifier even when blank", () => {
    const merged = mergeSeoConfigPatch(
      seo({ googleAdsCustomerId: "3522581611327832" }),
      { googleAdsCustomerId: "" }
    );
    assert.equal(merged.googleAdsCustomerId, "");
  });

  it("actually switches the channel off when a credential is cleared", () => {
    const cleared = mergeSeoConfigPatch(
      seo({ ga4MeasurementId: "G-66YC11GTZE", ga4ApiSecret: "old" }),
      { ga4ApiSecret: "off" }
    );
    assert.equal(buildConversionConfig(cleared).ga4, null);
  });

  it("closes the channel when a required identifier is removed", () => {
    const full = seo({
      metaPixelId: "1120650977294654",
      metaCapiAccessToken: "token",
    });
    assert.equal(buildConversionConfig(full).meta?.pixelId, "1120650977294654");
    const withoutPixel = mergeSeoConfigPatch(full, { metaPixelId: "" });
    assert.equal(buildConversionConfig(withoutPixel).meta, null);
  });
});

describe("admin patch validation", () => {
  it("accepts a realistic set of credentials", () => {
    assert.deepEqual(
      validateSeoConfigPatch({
        ga4ApiSecret: "bflgBYXfQ8C30kU5lBT-ng",
        metaPixelId: "1120650977294654",
        metaCapiAccessToken: "EAAG" + "x".repeat(40),
        googleAdsCustomerId: "352-258-1611",
        googleAdsConversionActionId: "12345",
        googleAdsApiVersion: "v21",
      }),
      []
    );
  });

  it("catches a truncated secret before the first charge would", () => {
    const errors = validateSeoConfigPatch({ ga4ApiSecret: "abc" });
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /GA4 Measurement Protocol secret/);
  });

  it("rejects a credential with whitespace inside it", () => {
    const errors = validateSeoConfigPatch({ metaCapiAccessToken: "a".repeat(30) + " b" });
    assert.match(errors[0]!, /must not contain spaces/);
  });

  it("rejects a non-numeric id", () => {
    const errors = validateSeoConfigPatch({ googleAdsCustomerId: "352258abc" });
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /Google Ads customer ID/);
  });

  it("rejects a malformed API version", () => {
    assert.match(validateSeoConfigPatch({ googleAdsApiVersion: "21" })[0]!, /v21/);
    assert.deepEqual(validateSeoConfigPatch({ googleAdsApiVersion: "v22" }), []);
  });

  it("lets a blank field through: blank means keep", () => {
    assert.deepEqual(
      validateSeoConfigPatch({ ga4ApiSecret: "", metaPixelId: "", googleAdsApiVersion: "" }),
      []
    );
  });

  it("lets the clear token through", () => {
    assert.deepEqual(validateSeoConfigPatch({ ga4ApiSecret: "off" }), []);
  });
});
