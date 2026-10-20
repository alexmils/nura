import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CUSTOM_SECTION_TEMPLATES,
  CUSTOM_SECTION_TYPES,
  customSectionType,
  isCustomSectionId,
  mediaNames,
  newCustomSectionId,
  normalizeSection,
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

  it("exposes word, image, alt, line, note and a Cloudinary video", () => {
    const t = CUSTOM_SECTION_TEMPLATES.poster;
    const keys = t.fields.map((f) => f.key);
    for (const k of ["word", "image", "alt", "line", "note", "media"]) assert.ok(keys.includes(k), k);
    assert.equal(t.fields.find((f) => f.key === "image")?.kind, "image");
    assert.equal(t.defaults.word, "Heal");
    assert.match(String(t.defaults.image), /^\/marketing\/landing\/.+\.jpg$/);
    const names = mediaNames("media");
    assert.equal(t.defaults[names.kind], "video");
    assert.equal(normalizeSection("custom-poster-heal0001", null)[names.kind], "video");
  });

  it("pins and dives into the video only when one is set", () => {
    const c = src("app/components/frontend/section-editor/PosterSection.tsx");
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    // Statically no runway; the has-through modifier adds the 170svh dive.
    assert.match(c, /const hasThrough = Boolean\(through\)/);
    assert.match(c, /POSTER_DIVE_VH = 170/);
    assert.match(css, /\.fe-poster\.has-through \.fe-poster-pin \{\s*position: sticky;\s*top: 0;/);
    assert.match(css, /perspective: 1100px/);
    // Scroll-scrubbed camera: scale + 3D tilt through the letters, then the film.
    assert.match(c, /start: "top top"[\s\S]*?end: "bottom bottom"[\s\S]*?scrub: true/);
    assert.match(c, /scale: 3\.4, rotateX: 7, rotateY: -3/);
    assert.match(c, /autoAlpha: 1, scale: 1/);
    // Video plays only in view, reduced motion stays the static poster.
    assert.match(c, /\.play\(\)/);
    assert.match(c, /\.pause\(\)/);
    assert.match(c, /isA11yReduceMotionPreferred/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.fe-poster\.has-through \{\s*height: max\(560px, 100svh\);/);
    assert.match(css, /html\[data-a11y-motion="reduced"\] \.fe-poster\.has-through/);
    // The word still fits to the stage and is recalculated on resize.
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
    // No gradient at the section edge; the old scrolly class is gone.
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