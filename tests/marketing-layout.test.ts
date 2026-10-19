import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  builtInSlotIds,
  defaultLayout,
  isDefaultLayout,
  isSectionShown,
  MARKETING_PAGES,
  MAX_CUSTOM_SECTIONS_PER_PAGE,
  normalizeLayout,
} from "../lib/marketing-layout.ts";
import {
  customSectionType,
  getSectionDef,
  isCustomSectionId,
  isMarketingSectionId,
  newCustomSectionId,
  normalizeSection,
  safeHref,
  sectionList,
  sectionText,
} from "../lib/marketing-sections.ts";
import { parseArticle } from "../lib/rich-article.ts";

describe("page layouts", () => {
  it("defaults to code order with everything shown", () => {
    const layout = defaultLayout("home");
    assert.deepEqual(
      layout.sections.map((entry) => entry.id),
      builtInSlotIds("home")
    );
    assert.equal(isDefaultLayout("home", layout), true);
    assert.equal(normalizeLayout("home", null), defaultLayout("home"));
    assert.equal(normalizeLayout("home", { nope: 1 }), defaultLayout("home"));
  });

  it("keeps order and hidden flags, drops unknown and duplicate ids", () => {
    const layout = normalizeLayout("pricing", {
      sections: [
        { id: "pricing-faq", hidden: true },
        { id: "pricing-plans" },
        { id: "pricing-plans" },
        { id: "home-hero" },
        { id: "<script>" },
        { id: "custom-text-abcd1234" },
        { id: "pricing-cta", hidden: "yes" },
      ],
    });
    assert.deepEqual(layout.sections, [
      { id: "pricing-faq", hidden: true },
      { id: "pricing-plans" },
      { id: "pricing-included" },
      { id: "custom-text-abcd1234" },
      { id: "pricing-cta" },
    ]);
    assert.equal(isSectionShown(layout, "pricing-faq"), false);
    assert.equal(isSectionShown(layout, "pricing-cta"), true);
    assert.equal(isSectionShown(undefined, "pricing-faq"), true);
  });

  it("re-inserts built-ins missing from a saved layout after their neighbour", () => {
    const layout = normalizeLayout("home", {
      sections: [{ id: "home-faq" }, { id: "home-hero" }],
    });
    const ids = layout.sections.map((entry) => entry.id);
    assert.equal(ids.length, builtInSlotIds("home").length);
    assert.equal(ids[0], "home-faq");
    assert.equal(ids[1], "home-blog");
    assert.equal(ids[2], "home-close");
    assert.equal(ids[3], "home-hero");
    assert.equal(ids[4], "home-trust");
  });

  it("caps added sections per page", () => {
    const sections = Array.from({ length: MAX_CUSTOM_SECTIONS_PER_PAGE + 5 }, (_, i) => ({
      id: `custom-text-${String(i).padStart(8, "0")}`,
    }));
    const layout = normalizeLayout("about", { sections });
    assert.equal(
      layout.sections.filter((entry) => isCustomSectionId(entry.id)).length,
      MAX_CUSTOM_SECTIONS_PER_PAGE
    );
  });

  it("every built-in slot is a known section or a labelled layout-only slot", () => {
    for (const page of Object.values(MARKETING_PAGES)) {
      for (const slot of page.slots) {
        assert.ok(getSectionDef(slot.id) || "label" in slot, slot.id);
      }
    }
  });
});

describe("added sections", () => {
  it("creates valid ids and resolves templates", () => {
    const id = newCustomSectionId("media");
    assert.match(id, /^custom-media-[a-z0-9]{8}$/);
    assert.equal(customSectionType(id), "media");
    assert.equal(isMarketingSectionId(id), true);
    assert.equal(isMarketingSectionId("custom-evil-abcd1234"), false);
    assert.equal(isMarketingSectionId("layout-home"), false);
    const config = normalizeSection(id, { title: "Hello", side: "right", mediaImage: "javascript:x" });
    assert.equal(sectionText(config, "title"), "Hello");
    assert.equal(sectionText(config, "mediaImage"), "");
  });
});

describe("list items and links", () => {
  it("keeps hidden items saved but skips them in sectionList", () => {
    const config = normalizeSection("home-faq", {
      items: [
        { q: "Shown", a: "Yes" },
        { q: "Hidden", a: "No", _hidden: "1" },
      ],
    });
    const raw = config.items as Record<string, string>[];
    assert.equal(raw.length, 2);
    assert.equal(raw[1]?._hidden, "1");
    assert.deepEqual(
      sectionList(config, "items").map((item) => item.q),
      ["Shown"]
    );
  });

  it("allows tel: links", () => {
    assert.equal(safeHref("tel:988", "/"), "tel:988");
    assert.equal(safeHref("tel:javascript", "/"), "/");
  });
});

describe("article text", () => {
  it("parses headings, lists, notes and paragraphs", () => {
    const blocks = parseArticle("# Title\n\nOne\ntwo\n\n- a\n- b\n\n> **Note** here\n\n### Small");
    assert.deepEqual(blocks, [
      { kind: "h1", text: "Title" },
      { kind: "p", text: "One two" },
      { kind: "ul", items: ["a", "b"] },
      { kind: "note", text: "**Note** here" },
      { kind: "h3", text: "Small" },
    ]);
  });

  it("long-form defaults fit their field caps", () => {
    for (const id of ["safety-page", "limits-page", "emdr-intro", "emdr-guide", "clinical-intro"]) {
      const def = getSectionDef(id);
      assert.ok(def, id);
      const body = def.defaults.body as string;
      assert.equal(sectionText(normalizeSection(id, null), "body"), body, id);
    }
    const support = normalizeSection("support-sections", null);
    assert.match(sectionList(support, "sections")[0]?.body ?? "", /^Open Need help from/);
  });
});