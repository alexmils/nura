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

  it("is the poster layout: white top, photo below the edge, word straddling it", () => {
    const c = src("app/components/frontend/section-editor/PosterSection.tsx");
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    // Photo covers the stage but is clipped to below the edge; the top stays white.
    assert.match(css, /\.fe-poster-photo \{[^}]*clip-path: inset\(var\(--poster-cut\) 0 0 0\)/);
    assert.match(css, /\.fe-poster-stage \{[^}]*background: #fff;/);
    // Above the edge the letters are filled with the photo; below it they are white.
    assert.match(css, /\.fe-poster-layer--photo\.has-photo \.fe-poster-letter \{[^}]*background-clip: text;/);
    assert.match(css, /\.fe-poster-layer--white \{[^}]*clip-path: inset\(var\(--poster-cut\) 0 0 0\)/);
    assert.match(c, /fe-poster-layer--photo/);
    assert.match(c, /backgroundPosition = /);
    // Very large but fully visible.
    assert.match(c, /stage\.clientWidth \* \(stage\.clientWidth < 700 \? 0\.86 : 0\.9\)/);
    assert.match(c, /start: \(\) => layoutTop\(root\)/);
    assert.match(c, /color: fill/);
    assert.match(c, /diveScale\(/);
  });
  it("renders through CustomSection and scales down on phones", () => {
    assert.match(src("app/components/frontend/section-editor/CustomSection.tsx"), /type === "poster"[\s\S]*<PosterStage copy=\{copy\} \/>/);
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    assert.match(css, /\.fe-custom\.fe-custom--poster/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.fe-poster\.is-scrolly \{/);
  });
});