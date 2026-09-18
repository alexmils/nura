import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRAND_LEGAL,
  BRAND_SPOKEN,
  chromeBrandName,
  rewriteRetiredBrandCopy,
} from "../lib/brand.ts";
import { normalizeSettingsForTest } from "../lib/platform-settings.ts";

describe("chromeBrandName", () => {
  it("maps leftover NuraHelp defaults to Nura", () => {
    assert.equal(chromeBrandName("NuraHelp AI"), BRAND_SPOKEN);
    assert.equal(chromeBrandName("NuraHelp"), BRAND_SPOKEN);
    assert.equal(chromeBrandName(""), BRAND_SPOKEN);
    assert.equal(chromeBrandName(null), BRAND_SPOKEN);
  });

  it("keeps a custom admin name", () => {
    assert.equal(chromeBrandName("Clinic Lab"), "Clinic Lab");
  });

  it("uses Nura for public brand lockup", () => {
    assert.equal(BRAND_LEGAL, "Nura");
    assert.equal(BRAND_SPOKEN, BRAND_LEGAL);
  });

  it("maps stored NuraHelp AI platform defaults to Nura", () => {
    const s = normalizeSettingsForTest({
      siteName: "NuraHelp AI",
      fromName: "NuraHelp AI",
    });
    assert.equal(s.siteName, BRAND_SPOKEN);
    assert.equal(s.fromName, BRAND_SPOKEN);
    assert.equal(s.email.brevoApiKey, "");
    assert.equal(s.faviconUrl, "");
    assert.equal(s.appLogoUrl, "");
  });

  it("keeps favicon and app logo brand assets", () => {
    const s = normalizeSettingsForTest({
      faviconUrl: "/brand/mark.png",
      appLogoUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
    assert.equal(s.faviconUrl, "/brand/mark.png");
    assert.ok(s.appLogoUrl.startsWith("data:image/png"));
  });

  it("drops invalid brand asset URLs", () => {
    const s = normalizeSettingsForTest({
      faviconUrl: "javascript:alert(1)",
      appLogoUrl: "http://insecure.example/x.png",
    });
    assert.equal(s.faviconUrl, "");
    assert.equal(s.appLogoUrl, "");
  });
});

describe("rewriteRetiredBrandCopy", () => {
  it("strips NuraHelp and old help phrases", () => {
    assert.equal(rewriteRetiredBrandCopy("NuraHelp AI is a tool"), "Nura is a tool");
    assert.equal(rewriteRetiredBrandCopy("NuraHelp builds tools"), "Nura builds tools");
    assert.equal(
      rewriteRetiredBrandCopy("Hi — I’m the NuraHelp assistant."),
      "Hi — I’m the Nura assistant."
    );
    assert.equal(rewriteRetiredBrandCopy("What NuraHelp is"), "What Nura is");
    assert.equal(
      rewriteRetiredBrandCopy("Trial includes 10 minutes of free BLS"),
      "Trial includes 10 minutes of self-guided set time"
    );
    assert.equal(
      rewriteRetiredBrandCopy("Free mode is BLS-only controls"),
      "self-guided session is sets you run yourself"
    );
    assert.equal(
      rewriteRetiredBrandCopy(
        "overview of bilateral stimulation and how guided sessions are structured"
      ),
      "overview of visual sets and how Guided sessions are structured"
    );
    assert.equal(
      rewriteRetiredBrandCopy(
        "use **bilateral stimulation** — rhythmically tracking something left and right — while"
      ),
      "follow **a moving target left and right** during a visual set — while"
    );
  });
});
