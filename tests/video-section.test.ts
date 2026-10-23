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

describe("video screen section", () => {
  it("is an addable custom section type", () => {
    assert.ok((CUSTOM_SECTION_TYPES as readonly string[]).includes("video"));
    assert.ok(isCustomSectionId("custom-video-film0001"));
    assert.equal(customSectionType("custom-video-film0001"), "video");
    assert.match(newCustomSectionId("video"), /^custom-video-[a-z0-9]{8}$/);
  });

  it("exposes a Cloudinary video slot", () => {
    const t = CUSTOM_SECTION_TEMPLATES.video;
    assert.equal(t.fields.find((f) => f.key === "media")?.kind, "media");
    const names = mediaNames("media");
    assert.equal(t.defaults[names.kind], "video");
    // custom-video-film0001 is code-defined (stored as a still image); a fresh id gets the template.
    assert.equal(normalizeSection("custom-video-abcd1234", null)[names.kind], "video");
  });

  it("has its own Edit chip on the screen", () => {
    const c = src("app/components/frontend/section-editor/VideoSection.tsx");
    const custom = src("app/components/frontend/section-editor/CustomSection.tsx");
    assert.match(c, /<SectionEdit id=\{id\} lift \/>/);
    assert.match(custom, /type === "video"[\s\S]*<VideoScreen copy=\{copy\} id=\{id\} \/>/);
    assert.match(custom, /prevType === "poster" \? " fe-custom--video-under"/);
  });

  it("is pinned under the poster and then plays in place", () => {
    const c = src("app/components/frontend/section-editor/VideoSection.tsx");
    const css = src("app/components/frontend/section-editor/custom-sections.css");
    // The block is pulled up behind the poster and the screen pins for the
    // poster's runway plus one more screen of its own.
    assert.match(
      css,
      /\.fe-custom--video-under \{[\s\S]*?margin-top: calc\(-1 \* \(var\(--poster-runway\) \+ max\(560px, 100svh\)\)\);[\s\S]*?height: calc\(var\(--poster-runway\) \+ 2 \* max\(560px, 100svh\)\);/
    );
    assert.match(css, /\.fe-custom--video-under \.fe-video-screen \{\s*position: sticky;\s*top: 0;/);
    assert.match(css, /\.fe-custom--video-under \{\s*--poster-runway: 100svh;/);
    // Plays only in view; reduced motion uses a still and normal flow.
    assert.match(c, /\.play\(\)/);
    assert.match(c, /\.pause\(\)/);
    assert.match(c, /isA11yReduceMotionPreferred/);
    assert.match(
      css,
      /html\[data-a11y-motion="reduced"\] \.fe-custom--video-under \{\s*margin-top: 0;\s*height: auto;/
    );
  });

  it("is paired with its neighbours by PageSections", () => {
    const p = src("app/components/frontend/section-editor/PageSections.tsx");
    assert.match(p, /nextType=\{typeOf\(shown\[at \+ 1\]\?\.id\)\}/);
    assert.match(p, /prevType=\{typeOf\(shown\[at - 1\]\?\.id\)\}/);
  });
});
