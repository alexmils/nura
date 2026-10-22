import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CUSTOM_SECTION_TYPES,
  customSectionType,
  getSectionDef,
  isCustomSectionId,
  newCustomSectionId,
  normalizeSection,
  sectionList,
  sectionText,
} from "../lib/marketing-sections";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("CTA with image marquee section type", () => {
  it("is an addable custom section type with its own ids", () => {
    assert.ok((CUSTOM_SECTION_TYPES as readonly string[]).includes("marquee"));
    const id = newCustomSectionId("marquee");
    assert.ok(isCustomSectionId(id));
    assert.equal(customSectionType(id), "marquee");
  });

  it("edits heading, text, two buttons and an image list", () => {
    const def = getSectionDef("custom-marquee-abcd1234");
    assert.ok(def);
    const keys = def.fields.map((f) => f.key);
    for (const k of ["title", "body", "ctaLabel", "ctaHref", "secondaryLabel", "secondaryHref", "images"]) {
      assert.ok(keys.includes(k), k);
    }
    const images = def.fields.find((f) => f.key === "images");
    assert.equal(images?.kind, "list");
    assert.ok(!(images as { fixed?: unknown }).fixed, "admins can add, remove and reorder images");
    const cfg = normalizeSection("custom-marquee-abcd1234", null);
    assert.ok(sectionText(cfg, "title"));
    assert.ok(sectionList(cfg, "images").length >= 6);
    const hidden = normalizeSection("custom-marquee-abcd1234", {
      images: [{ image: "/a.jpg", alt: "" }, { image: "/b.jpg", alt: "", _hidden: "1" }],
    });
    assert.equal(sectionList(hidden, "images").length, 1);
  });

  it("renders a dark band, two pill buttons and a seamless, reduced-motion-safe marquee", () => {
    const tsx = src("app/components/frontend/section-editor/CustomSection.tsx");
    assert.match(tsx, /type === "marquee"/);
    assert.match(tsx, /<Marquee/);
    assert.match(tsx, /is-short/);
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    assert.match(css, /\.fe-custom--marquee \{[^}]*background: var\(--mq-bg\)/);
    assert.match(css, /border-radius: 12px 12px 0 0/);
    const mq = src("app/components/motion/marquee.css");
    assert.match(mq, /prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
    assert.match(mq, /data-a11y-motion="reduced"\] \.mo-marquee-track/);
  });

  it("is not on any page until an admin adds it", () => {
    const layout = src("lib/marketing-layout.ts");
    assert.doesNotMatch(layout, /custom-marquee/);
  });
});