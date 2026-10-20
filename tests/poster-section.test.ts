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
    assert.match(c, /if \(!root \|\| reducedMotion\(\) \|\| !letters\.length\) return;/);
    assert.match(c, /ctx\.revert\(\)/);
    // Animated props are transform/opacity/filter/colour only (no layout tweens).
    const tweens = c.slice(c.indexOf("const ctx = gsap.context"));
    assert.doesNotMatch(tweens, /\b(width|height|margin|padding|top|left):/);
    assert.match(c, /aria-label=\{letters\.join\(""\)\}/);
  });

  it("is the poster layout: one photo, feathered paper on top, word cut out of it", () => {
    const c = src("app/components/frontend/section-editor/PosterSection.tsx");
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    // ONE photo covers the stage; the paper (section colour, white by default) sits over the top.
    assert.match(css, /\.fe-poster-photo \{\s*position: absolute;\s*inset: 0;/);
    assert.match(css, /--poster-paper: #ffffff;/);
    assert.match(css, /\.fe-poster-paper \{[^}]*background: var\(--poster-paper\);/);
    // Soft feathered edge (mask), not a hard cut; the white copy uses the same feather inverted.
    assert.match(css, /\.fe-poster\.has-image \.fe-poster-paper \{[^}]*mask-image: linear-gradient\(\s*180deg,\s*#000 calc\(var\(--poster-cut\) - var\(--poster-feather\)\)/);
    assert.match(css, /\.fe-poster-word--white \{[^}]*mask-image: linear-gradient\(\s*180deg,\s*transparent calc\(var\(--poster-cut\) - var\(--poster-feather\)\)/);
    // Letters are windows onto the same photo: black letters blended "lighten" on the paper.
    assert.match(css, /mix-blend-mode: lighten;/);
    assert.match(c, /POSTER_ON_PAPER = 0\.55/);
    assert.match(c, /--poster-cut/);
    // Very large but fully visible.
    assert.match(c, /stage\.clientWidth \* \(stage\.clientWidth < 700 \? 0\.86 : 0\.9\)/);
    assert.match(c, /start: \(\) => layoutTop\(root\)/);
    assert.match(c, /color: fill/);
    assert.match(c, /diveScale\(/);
  });
  it("renders through CustomSection and scales down on phones", () => {
    assert.match(src("app/components/frontend/section-editor/CustomSection.tsx"), /type === "poster"[\s\S]*<PosterStage copy=\{copy\} id=\{id\} \/>/);
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    assert.match(css, /\.fe-custom\.fe-custom--poster/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.fe-poster\.is-scrolly \{/);
  });
});