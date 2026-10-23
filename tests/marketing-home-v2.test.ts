import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MARKETING_PAGES } from "../lib/marketing-layout";
import {
  BETWEEN_TEMPLATES,
  BETWEEN_TEMPLATE_KEY,
  CLOSE_TEMPLATES,
  CLOSE_TEMPLATE_KEY,
  PAGE_CTA_PAGES,
  SECTION_OFF_KEY,
  betweenTemplate,
  closeTemplate,
  getSectionDef,
  isSectionOn,
  normalizeSection,
  pageCtaId,
  sectionList,
  sectionText,
} from "../lib/marketing-sections";

const HOME = ["home-hero", "home-trust", "home-how-intro", "custom-poster-heal0001", "custom-video-film0001", "home-how", "home-how-between", "home-how-languages", "home-modes", "home-session", "home-topics", "home-stories", "home-pricing", "home-faq", "home-blog", "home-close"];

describe("new homepage sections", () => {
  it("lays out every band of the new homepage in its live order", () => {
    assert.deepEqual(MARKETING_PAGES.home.slots.map((slot) => slot.id), HOME);
    for (const id of HOME) assert.ok(getSectionDef(id), id);
  });

  it("defaults match the live copy", () => {
    const hero = normalizeSection("home-hero", null);
    assert.equal(sectionText(hero, "accent"), "calm");
    assert.equal(sectionText(hero, "secondaryHref"), "#how-it-works");
    assert.deepEqual(sectionList(hero, "trust").map((item) => item.id), ["trial", "cancel", "selfhelp"]);
    assert.deepEqual(sectionList(normalizeSection("home-modes", null), "modes").map((item) => item.id), ["guided", "self"]);
    assert.deepEqual(sectionList(normalizeSection("home-pricing", null), "plans").map((item) => item.id), ["yearly", "monthly", "weekly"]);
    assert.equal(sectionText(normalizeSection("home-close", null), "title"), "A calmer next step.");
    assert.equal(sectionText(normalizeSection("home-stories", null), "rating"), "4.9");
  });

  it("hero and close paint their own background in place of the photo", () => {
    assert.equal(getSectionDef("home-hero")?.ownBackground, true);
    assert.equal(getSectionDef("home-close")?.ownBackground, true);
  });

  it("lets the editor pick one of sixteen closing CTA layouts (6 classic + 10 shared)", () => {
    assert.equal(CLOSE_TEMPLATES.length, 16);
    const field = getSectionDef("home-close")?.fields.find((f) => f.key === CLOSE_TEMPLATE_KEY);
    assert.ok(field && "options" in field && field.options?.length === 16);
    assert.equal(closeTemplate(normalizeSection("home-close", null)), "meadow");
    assert.equal(closeTemplate(normalizeSection("home-close", { [CLOSE_TEMPLATE_KEY]: "panel" })), "panel");
    assert.equal(closeTemplate(normalizeSection("home-close", { [CLOSE_TEMPLATE_KEY]: "nope" })), "meadow");
    const page = readFileSync(new URL("../app/components/frontend/HomeLandingV2.tsx", import.meta.url), "utf8");
    assert.match(page, /v2-close--tpl-\$\{closeTpl\}/);
  });

  it("lets the editor pick the between-sessions layout", () => {
    assert.equal(BETWEEN_TEMPLATES.length, 15);
    const field = getSectionDef("home-how-between")?.fields.find((f) => f.key === BETWEEN_TEMPLATE_KEY);
    assert.ok(field && "options" in field && field.options?.length === 15);
    assert.equal(betweenTemplate(normalizeSection("home-how-between", null)), "center");
    assert.equal(betweenTemplate(normalizeSection("home-how-between", { [BETWEEN_TEMPLATE_KEY]: "split" })), "split");
    assert.equal(betweenTemplate(normalizeSection("home-how-between", { [BETWEEN_TEMPLATE_KEY]: "nope" })), "center");
    const between = readFileSync(new URL("../app/components/frontend/BetweenSessionsSection.tsx", import.meta.url), "utf8");
    assert.match(between, /fe-between--tpl-\$\{tpl\}/);
  });

  it("every band of the new homepage has a chip", () => {
    const src = readFileSync(new URL("../app/components/frontend/HomeLandingV2.tsx", import.meta.url), "utf8");
    for (const id of ["home-hero", "home-trust", "home-modes", "home-session", "home-stories", "home-pricing", "home-close"]) {
      assert.match(src, new RegExp('EditablePart id="' + id + '"'), id);
    }
    assert.match(src, /<PageSections\s+page="home"/);
  });
});

describe("page call to action", () => {
  it("each public page has its own CTA slot, hidden by default", () => {
    for (const page of Object.keys(PAGE_CTA_PAGES)) {
      const id = pageCtaId(page);
      assert.ok(getSectionDef(id), id);
      assert.ok(MARKETING_PAGES[page as keyof typeof MARKETING_PAGES].slots.some((slot) => slot.id === id), id);
      assert.equal(isSectionOn(normalizeSection(id, null)), false, id);
    }
    for (const page of ["about", "faq", "blog", "learn", "knowledge", "support", "editorial", "safety", "limits", "clinical"]) {
      assert.ok(page in PAGE_CTA_PAGES, page);
    }
  });

  it("switching it on is remembered, switching it off hides it", () => {
    const on = normalizeSection("page-cta-about", { [SECTION_OFF_KEY]: "0", title: "Try it" });
    assert.equal(isSectionOn(on), true);
    assert.equal(sectionText(on, "title"), "Try it");
    assert.equal(isSectionOn(normalizeSection("page-cta-about", { [SECTION_OFF_KEY]: "1" })), false);
  });

  it("built-in sections stay on by default", () => {
    assert.equal(isSectionOn(normalizeSection("home-close", null)), true);
    assert.equal(isSectionOn(normalizeSection("home-close", { [SECTION_OFF_KEY]: "1" })), false);
  });

  it("existing CTAs keep their own section", () => {
    assert.ok(getSectionDef("pricing-cta"));
    assert.ok(getSectionDef("emdr-close"));
    assert.ok(MARKETING_PAGES.home.slots.some((slot) => slot.id === "home-close"));
  });
});
