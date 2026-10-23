import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BETWEEN_TEMPLATES,
  BETWEEN_TEMPLATE_KEY,
  CLOSE_TEMPLATES,
  CLOSE_TEMPLATE_KEY,
  CTA_SHOWCASE_DEFAULT_WORDS,
  CTA_SHOWCASE_TEMPLATES,
  HERO_TEMPLATES,
  betweenTemplate,
  closeTemplate,
  ctaShowcaseWords,
  fieldInTemplate,
  getSectionDef,
  isCtaShowcase,
  normalizeSection,
} from "../lib/marketing-sections";

const SHARED = ["orb", "pulse", "quote", "minidemo", "fullbleed", "aurora", "horizon", "ripple", "stacked", "typewriter"];
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("shared CTA showcase templates", () => {
  it("registers ten templates in two groups (5 Calm, 5 Creative)", () => {
    assert.deepEqual(CTA_SHOWCASE_TEMPLATES.map((t) => t.value), SHARED);
    assert.equal(CTA_SHOWCASE_TEMPLATES.filter((t) => t.group === "Calm").length, 5);
    assert.equal(CTA_SHOWCASE_TEMPLATES.filter((t) => t.group === "Creative").length, 5);
    for (const t of CTA_SHOWCASE_TEMPLATES) assert.ok(t.label && t.hint, `${t.value} needs a label and hint`);
  });

  it("is offered by both the closing CTA and Between sessions", () => {
    for (const value of SHARED) {
      assert.ok(CLOSE_TEMPLATES.some((t) => t.value === value), `close is missing ${value}`);
      assert.ok(BETWEEN_TEMPLATES.some((t) => t.value === value), `between is missing ${value}`);
      assert.ok(isCtaShowcase(value));
    }
    assert.ok(!isCtaShowcase("meadow"));
    assert.ok(!isCtaShowcase("center"));
  });

  it("uses values unique across hero, close and between (thumbnail classes)", () => {
    const classic: string[] = [
      ...HERO_TEMPLATES.map((t) => t.value),
      ...CLOSE_TEMPLATES.filter((t) => !isCtaShowcase(t.value)).map((t) => t.value),
      ...BETWEEN_TEMPLATES.filter((t) => !isCtaShowcase(t.value)).map((t) => t.value),
    ];
    for (const value of SHARED) assert.ok(!classic.includes(value), `${value} collides with an existing template`);
  });

  it("keeps the original defaults and accepts the new values", () => {
    assert.equal(closeTemplate(normalizeSection("home-close", null)), "meadow");
    assert.equal(betweenTemplate(normalizeSection("home-how-between", null)), "center");
    for (const value of SHARED) {
      assert.equal(closeTemplate(normalizeSection("home-close", { [CLOSE_TEMPLATE_KEY]: value })), value);
      assert.equal(betweenTemplate(normalizeSection("home-how-between", { [BETWEEN_TEMPLATE_KEY]: value })), value);
    }
  });

  it("gives the extra fields defaults and shows them only on their templates", () => {
    const close = normalizeSection("home-close", null);
    assert.ok(String(close.quote).length > 0);
    assert.equal(close.words, CTA_SHOWCASE_DEFAULT_WORDS);
    const between = normalizeSection("home-how-between", null);
    assert.ok(String(between.betweenQuote).length > 0);
    assert.equal(between.betweenWords, CTA_SHOWCASE_DEFAULT_WORDS);

    const fields = getSectionDef("home-close")?.fields ?? [];
    const quote = fields.find((f) => f.key === "quote")!;
    const words = fields.find((f) => f.key === "words")!;
    assert.ok(fieldInTemplate(quote, "quote"));
    assert.ok(!fieldInTemplate(quote, "meadow"));
    assert.ok(fieldInTemplate(words, "stacked") && fieldInTemplate(words, "typewriter"));
    assert.ok(!fieldInTemplate(words, "orb"));
  });

  it("splits words on commas or lines, caps at six and falls back when blank", () => {
    assert.deepEqual(ctaShowcaseWords("a, b,\nc"), ["a", "b", "c"]);
    assert.equal(ctaShowcaseWords("1,2,3,4,5,6,7,8").length, 6);
    assert.deepEqual(ctaShowcaseWords("  "), ctaShowcaseWords(CTA_SHOWCASE_DEFAULT_WORDS));
  });

  it("renders through CtaShowcase in both sections, with thumbnails, reduced motion and phone rules", () => {
    assert.match(read("app/components/frontend/HomeLandingV2.tsx"), /<CtaShowcase[\s\S]*variant="close"/);
    assert.match(read("app/components/frontend/BetweenSessionsSection.tsx"), /<CtaShowcase[\s\S]*variant="between"/);
    const component = read("app/components/frontend/CtaShowcase.tsx");
    assert.match(component, /useReducedMotion/);
    assert.match(component, /plan\.gradient/);
    const css = read("app/components/frontend/cta-showcase.css");
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /@media \(max-width: 760px\)/);
    const thumbs = read("app/components/frontend/section-editor/editor-templates.css");
    for (const value of SHARED) {
      assert.match(css, new RegExp(`\\.cta-show--${value}\\b`), `missing styles for ${value}`);
      assert.match(thumbs, new RegExp(`\\.fe-tpl-thumb--${value}\\b`), `missing thumbnail for ${value}`);
    }
  });
});
