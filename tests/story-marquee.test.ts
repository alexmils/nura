import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("Home stories phone ticker", () => {
  const tsx = src("app/components/frontend/HomeLandingV2.tsx");
  const css = src("app/components/frontend/story-marquee.css");

  it("renders the story set twice with an aria-hidden clone", () => {
    assert.match(tsx, /import "\.\/story-marquee\.css"/);
    assert.match(tsx, /\[false, true\]\.flatMap\(\(clone\) => STORIES\.map/);
    assert.match(tsx, /v2-story-card--clone/);
    assert.match(tsx, /aria-hidden=\{clone \? true : undefined\}/);
    assert.match(tsx, /"--story-count": STORIES\.length/);
  });

  it("hides clones by default and loops only on phones with motion allowed", () => {
    assert.match(css, /^\.v2-story-card--clone \{\s*display: none;/m);
    assert.match(css, /@media \(max-width: 760px\) and \(prefers-reduced-motion: no-preference\) \{/);
    assert.match(css, /html:not\(\[data-a11y-motion="reduced"\]\) \.v2-story-track \{[^}]*animation: v2-story-ticker [^;]* linear infinite/);
    assert.match(css, /translate3d\(-50%, 0, 0\)/);
  });

  it("keeps the seam clean, blocks manual swipe and never pauses", () => {
    assert.match(css, /\.v2-story-track \{[^}]*gap: 0;[^}]*padding-inline: 0;/);
    assert.match(css, /\.v2-story-card \{[^}]*margin-right: 1\.25rem;/);
    assert.match(css, /\.v2-story-viewport \{[^}]*overflow: hidden;[^}]*touch-action: pan-y;/);
    assert.doesNotMatch(css, /animation-play-state: paused/);
  });
});
