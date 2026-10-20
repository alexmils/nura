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

  it("exposes word, image, alt, line and note with Heal defaults", () => {
    const t = CUSTOM_SECTION_TEMPLATES.poster;
    const keys = t.fields.map((f) => f.key);
    for (const k of ["word", "image", "alt", "line", "note"]) assert.ok(keys.includes(k), k);
    assert.equal(t.fields.find((f) => f.key === "image")?.kind, "image");
    assert.equal(t.defaults.word, "Heal");
    assert.match(String(t.defaults.image), /^\/marketing\/landing\/.+\.jpg$/);
  });

  it("is static: no scroll timeline, only the fit recalculates on resize", () => {
    const c = src("app/components/frontend/section-editor/PosterSection.tsx");
    assert.doesNotMatch(c, /scrub:|gsap\.timeline|is-scrolly|reducedMotion/);
    assert.match(c, /new ResizeObserver\(schedule\)/);
    assert.match(c, /aria-label=\{letters\.join\(""\)\}/);
  });

  it("is the reference poster: white block, hard edge, photo-filled HEAL", () => {
    const c = src("app/components/frontend/section-editor/PosterSection.tsx");
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    // ONE photo covers the stage.
    assert.match(css, /\.fe-poster-photo \{\s*position: absolute;\s*inset: 0;/);
    // White paper over the top with a clean, sharp edge (no fog / feather).
    assert.match(css, /\.fe-poster\.has-image \.fe-poster-paper \{[\s\S]*?clip-path: inset\(0 0 calc\(100% - var\(--poster-cut\)\) 0\);/);
    assert.doesNotMatch(css, /--poster-feather|mask-image: linear-gradient/);
    // The word is a window onto the same photo (image as the letters' background).
    assert.match(css, /\.fe-custom--poster \.fe-poster-word--photo \{[\s\S]*?background-clip: text;/);
    assert.match(css, /-webkit-text-fill-color: transparent/);
    // No gradient at the section edge; no scroll runway.
    assert.doesNotMatch(css, /\.fe-poster-stage::before \{/);
    assert.doesNotMatch(css, /\.fe-poster\.is-scrolly/);
    // Very large but fully visible: fit iteratively at the real optical size
    // (Fraunces glyph widths do not scale linearly from a 100px probe).
    assert.match(c, /const maxWidth = stage\.clientWidth \* \(stage\.clientWidth < 700 \? 0\.94 : 0\.98\)/);
    assert.match(c, /for \(let pass = 0; pass < 4; pass \+= 1\)/);
    // The hard edge sits on the word's baseline: the flat bottoms of the
    // letters stand on the photo (the Range rect is the font em box, so the
    // baseline comes from canvas font metrics).
    assert.match(c, /--poster-cut/);
    assert.match(c, /document\.createRange\(\)/);
    assert.match(c, /fontBoundingBoxAscent/);
    assert.match(c, /fontBoundingBoxDescent/);
    assert.match(c, /rect\.height \* POSTER_BASELINE/);
    assert.match(c, /POSTER_BASELINE = 0\.79/);
  });
  it("renders through CustomSection and scales down on phones", () => {
    assert.match(src("app/components/frontend/section-editor/CustomSection.tsx"), /type === "poster"[\s\S]*<PosterStage copy=\{copy\} id=\{id\} \/>/);
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    assert.match(css, /\.fe-custom\.fe-custom--poster/);
    assert.match(css, /@media \(max-width: 640px\)/);
  });
});