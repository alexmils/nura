import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CUSTOM_SECTION_TEMPLATES,
  CUSTOM_SECTION_TYPES,
  customSectionType,
  isCustomSectionId,
  newCustomSectionId,
} from "../lib/marketing-sections";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("poster word section (Heal)", () => {
  it("is an addable custom section type", () => {
    assert.ok((CUSTOM_SECTION_TYPES as readonly string[]).includes("poster"));
    const id = newCustomSectionId("poster");
    assert.ok(isCustomSectionId(id));
    assert.equal(customSectionType(id), "poster");
    assert.ok(isCustomSectionId("custom-poster-heal0001"));
  });

  it("exposes word, image, alt, kicker, line and note with Heal defaults", () => {
    const t = CUSTOM_SECTION_TEMPLATES.poster;
    const keys = t.fields.map((f) => f.key);
    for (const k of ["word", "image", "alt", "kicker", "line", "note"]) assert.ok(keys.includes(k), k);
    assert.equal(t.fields.find((f) => f.key === "image")?.kind, "image");
    assert.equal(t.defaults.word, "Heal");
    assert.match(String(t.defaults.image), /^\/marketing\/landing\/.+\.jpg$/);
  });

  it("reveals letter by letter on a reversible scrub, transform/opacity/filter only, static under reduced motion", () => {
    const c = src("app/components/frontend/section-editor/PosterSection.tsx");
    assert.match(c, /scrub: 0\.5/);
    assert.match(c, /yPercent: 62, opacity: 0, filter: "blur\(18px\)"/);
    assert.match(c, /if \(!stage \|\| reducedMotion\(\)\) return;/);
    assert.match(c, /ctx\.revert\(\)/);
    assert.doesNotMatch(c, /width:|height:|margin|padding/);
    assert.match(c, /aria-label=\{letters\.join\(""\)\}/);
  });

  it("renders through CustomSection and scales down on phones", () => {
    assert.match(src("app/components/frontend/section-editor/CustomSection.tsx"), /type === "poster"[\s\S]*<PosterStage copy=\{copy\} \/>/);
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    assert.match(css, /\.fe-custom\.fe-custom--poster/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.fe-poster \{/);
  });
});