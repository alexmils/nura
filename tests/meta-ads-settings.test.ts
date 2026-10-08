import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_META_ADS_SETTINGS,
  mergeMetaAdsPatch,
  shouldRefreshMetaToken,
  toMetaAdsAdminView,
  validateMetaAdsPatch,
} from "../lib/meta-ads-settings.ts";

const now = Math.floor(Date.parse("2026-10-08T00:00:00Z") / 1000);

describe("meta ads connection", () => {
  it("keeps a saved token when the field is left blank", () => {
    const next = mergeMetaAdsPatch(
      { ...DEFAULT_META_ADS_SETTINGS, accessToken: "saved-token-value-12345", expiresAt: 100 },
      { accessToken: "  ", accountId: "3522581611327832" }
    );
    assert.equal(next.accessToken, "saved-token-value-12345");
    assert.equal(next.expiresAt, 100);
    assert.equal(next.accountId, "3522581611327832");
  });

  it("clears a secret when the field is off and forgets the old expiry", () => {
    const next = mergeMetaAdsPatch(
      { ...DEFAULT_META_ADS_SETTINGS, accessToken: "saved-token-value-12345", expiresAt: 100 },
      { accessToken: "off" }
    );
    assert.equal(next.accessToken, "");
    assert.equal(next.expiresAt, null);
  });

  it("refreshes only inside the two-week window", () => {
    const inTenDays = now + 10 * 24 * 60 * 60;
    const inFortyDays = now + 40 * 24 * 60 * 60;
    assert.equal(shouldRefreshMetaToken(inTenDays, now), true);
    assert.equal(shouldRefreshMetaToken(inFortyDays, now), false);
    assert.equal(shouldRefreshMetaToken(0, now), false);
    assert.equal(shouldRefreshMetaToken(null, now), false);
  });

  it("turns auto refresh on only when the app secret is saved and the token can expire", () => {
    const view = toMetaAdsAdminView(
      {
        ...DEFAULT_META_ADS_SETTINGS,
        appId: "123",
        appSecret: "secret-value",
        accessToken: "token-value-that-is-long",
        expiresAt: now + 40 * 24 * 60 * 60,
      },
      { accountId: "", accessToken: "", appId: "", appSecret: "" },
      true
    );
    assert.equal(view.autoRefresh, true);
    assert.equal(view.hasAccessToken, true);
    const never = toMetaAdsAdminView(
      { ...DEFAULT_META_ADS_SETTINGS, accessToken: "t".repeat(20), appId: "1", appSecret: "s".repeat(8), expiresAt: 0 },
      { accountId: "", accessToken: "", appId: "", appSecret: "" },
      true
    );
    assert.equal(never.autoRefresh, false);
  });

  it("rejects a short token", () => {
    assert.equal(validateMetaAdsPatch({ accessToken: "short" })[0]?.includes("short"), true);
  });
});
