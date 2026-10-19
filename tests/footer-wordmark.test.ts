import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getSectionDef, isSectionOn, normalizeSection, sectionText } from "../lib/marketing-sections";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("footer wordmark", () => {
  it("is its own footer section, on by default, with text and colour", () => {
    const def = getSectionDef("footer-wordmark");
    assert.ok(def);
    assert.deepEqual(def.fields.map((f) => f.key), ["text", "color"]);
    const cfg = normalizeSection("footer-wordmark", null);
    assert.equal(sectionText(cfg, "text"), "nura");
    assert.equal(sectionText(cfg, "color"), "#ffffff");
    assert.equal(isSectionOn(cfg), true);
    assert.equal(isSectionOn(normalizeSection("footer-wordmark", { _off: "1" })), false);
  });

  it("grows in and draws its divider once, transform only, skipped for reduced motion", () => {
    const tsx = src("app/components/frontend/FooterWordmark.tsx");
    assert.match(tsx, /scale: 0\.8/);
    assert.match(tsx, /scaleX: 0\.5/);
    assert.match(tsx, /once: true/);
    assert.match(tsx, /prefers-reduced-motion: no-preference/);
    assert.match(tsx, /isA11yReduceMotionPreferred/);
    assert.match(tsx, /HEX\.test\(rawColor\)/);
  });

  it("sits in the footer with a chip and replaces the after-footer peek only while shown", () => {
    const footer = src("app/components/frontend/FrontendFooter.tsx");
    assert.match(footer, /<EditablePart id="footer-wordmark">/);
    assert.match(footer, /wordmarkOn \? null : \(/);
  });
});
