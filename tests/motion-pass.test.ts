import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("motion pass: scroll choreography", () => {
  const lib = src("app/components/motion/choreography.ts");
  const home = src("app/components/frontend/useHomeChoreography.ts");

  it("never animates layout (no size, margin or padding tweens)", () => {
    for (const file of [lib, home]) {
      assert.doesNotMatch(file, /maskImage|[^-]width:|[^-]height:|margin|padding/);
    }
  });

  it("has section-level hand-offs at every home boundary (adapted SectionHandoff rise)", () => {
    assert.match(lib, /SectionHandoff effect="rise"/);
    assert.match(lib, /export function handoff\(/);
    assert.match(lib, /filter: "brightness\(0\.55\)"/);
    for (const pair of [
      [".v2-hero", ".fe-spath"],
      [".v2-modes", ".v2-session"],
      [".v2-session", ".fe-topics"],
      [".fe-topics", ".v2-stories"],
      [".v2-stories", ".v2-pricing"],
      [".v2-pricing", ".fe-faq"],
      [".mo-swipe", ".v2-close"],
    ]) {
      assert.ok(home.includes(`handoff(one("${pair[0]}"), one("${pair[1]}")`), pair.join(" -> "));
    }
    const css = src("app/components/motion/handoffs.css");
    assert.match(css, /\.mo-curve::before/);
    assert.match(css, /data-a11y-motion="reduced"\] \.mo-curve::before/);
  });

  it("is linear in scroll for scrubbed moves and uses the motion tokens for arrivals", () => {
    assert.match(lib, /ease: "none",\s*scrollTrigger: \{ trigger, start, end, scrub/);
    assert.match(lib, /MOTION_DURATION\.slow/);
    assert.match(lib, /MOTION_STAGGER/);
  });

  it("builds nothing under reduced motion and reverts when the a11y widget turns it on", () => {
    assert.match(lib, /prefers-reduced-motion: reduce/);
    assert.match(lib, /isA11yReduceMotionPreferred\(\)/);
    assert.match(lib, /attributeFilter: \["data-a11y-motion"\]/);
    assert.match(lib, /if \(motionReduced\(\)\) return;/);
  });

  it("rebuilds when editable sections are shown, hidden or reordered", () => {
    assert.match(lib, /querySelectorAll\("\[data-section\]"\)/);
    assert.match(lib, /new MutationObserver\(onMutate\)/);
    assert.match(lib, /n\+\+ % 2 \? "curve" : "stack"/);
  });

  it("leaves the topics ring, plans spread, footer wordmark, CTA marquee and sticky stages alone", () => {
    for (const sel of [".fe-topics", ".v2-price-grid", ".fe-ft-wordmark", ".fe-custom--marquee", ".fe-spath"]) {
      assert.ok(lib.includes(`"${sel}"`), sel);
    }
    // Pinned sections are never transformed as the outgoing block.
    assert.match(lib, /const movePrev = prev && !pinnedInside\(prev\)/);
  });

  it("phones get arrivals only", () => {
    assert.match(lib, /if \(mobile\) return;/);
  });

  it("is wired on home and on every other public page", () => {
    assert.match(src("app/components/frontend/HomeLandingV2.tsx"), /useHomeChoreography\(landingRef\)/);
    assert.match(src("app/components/frontend/HomeLandingV2.tsx"), /<SectionRise from=\{4\} radius=\{40\}>/);
    assert.match(src("app/components/frontend/FrontendShellClient.tsx"), /<PageChoreography \/>/);
  });
});

describe("pageGetsChoreography", async () => {
  const { pageGetsChoreography } = await import("../app/components/motion/PageChoreography");
  it("skips home and the app", () => {
    assert.equal(pageGetsChoreography("/"), false);
    assert.equal(pageGetsChoreography("/app/login"), false);
    assert.equal(pageGetsChoreography("/about"), true);
    assert.equal(pageGetsChoreography("/blog/some-post"), true);
  });
});