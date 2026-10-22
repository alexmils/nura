import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("advanced pinned hand-offs (alexandermils port)", () => {
  const lib = src("app/components/motion/pinned-handoffs.ts");
  const home = src("app/components/frontend/useHomeChoreography.ts");

  const pairs: Array<[string, string, string]> = [
    [".v2-modes", ".v2-session", "lift"],
    [".v2-session", ".fe-topics", "focus"],
    [".fe-topics", ".v2-stories", "morph"],
    [".v2-stories", ".v2-pricing", "morph"],
    [".fe-blog", ".v2-close", "lens"],
  ];

  it("wires an effect to every desktop home boundary", () => {
    assert.ok(home.includes('const afterHero = following(one(".v2-hero"))'), "hero -> next target");
    assert.ok(home.includes('pinnedHandoff(one(".v2-hero"), afterHero, "zoom"'), "hero -> next zoom");
    for (const [a, b, fx] of pairs) {
      assert.ok(home.includes(`pinnedHandoff(one("${a}"), one("${b}"), "${fx}"`), `${a} -> ${b} ${fx}`);
    }
    // Pricing -> FAQ and FAQ -> blog are plain scroll with a gradient seam.
    assert.ok(!home.includes('pinnedHandoff(one(".v2-pricing")'));
    assert.ok(!home.includes('pinnedHandoff(one(".fe-faq")'));
    // Every boundary is a deliberate morph join except the two colour blends.
    assert.equal(pairs.filter((p) => p[2] === "morph").length, 2);
  });

  it("implements every effect and names its alexandermils source", () => {
    for (const fx of ["zoom", "lift", "halo", "morph", "settle", "focus", "curtain", "lens"]) {
      assert.match(lib, new RegExp(`case "${fx}"`));
    }
    for (const source of ["SectionHandoff", "CurtainPin", "Aperture"]) {
      assert.ok(lib.includes(source), source);
    }
  });

  it("scrubs 1:1 on the previous block and never animates layout", () => {
    assert.match(lib, /trigger: prev,[\s\S]*?start: \(\) => layoutBottom\(prev\) - vh\(\)/);
    assert.match(lib, /end: \(\) => layoutBottom\(prev\) \+ holdPx\(\),[\s\S]*?scrub: true/);
    // Tweens only touch transform, opacity, clip-path, radius and colour.
    assert.doesNotMatch(lib, /tl\.(?:to|fromTo)\([^;]*\b(?:width|height|margin\w*|padding\w*|top|left)\s*:/);
    // The hold runway is a one-off static margin, never a tween.
    assert.match(lib, /gsap\.set\(prev, \{ marginBottom: holdPx\(\) \}\)/);
    assert.doesNotMatch(lib, /padding/);
    assert.doesNotMatch(lib, /pinSpacing|pin: true/);
  });

  it("pins the outgoing block for `hold` viewports before the effect", () => {
    assert.match(lib, /opts\.hold \?\? DEFAULT_HANDOFF_HOLD/);
    assert.match(lib, /const holdPx = \(\) => hold \* vh\(\)/);
    // Every effect child starts after the hold; the hold itself only moves y.
    assert.match(lib, /tl\.shiftChildren\(hold, false, -1\)/);
    assert.match(lib, /tl\.fromTo\(prev, \{ y: 0 \}, \{ y: holdPx, duration: hold, ease: "none" \}, 0\)/);
    // Proxy effects ignore the hold segment.
    assert.match(lib, /tl\.time\(\) - hold/);
  });

  it("only animates neighbours, keeps overlays inert and leaves phones on the light hand-offs", () => {
    assert.match(lib, /!adjacent\(prev, next\)/);
    assert.match(lib, /pointerEvents: "none"/);
    assert.match(home, /if \(mobile\)[\s\S]*handoff\(one\("\.v2-hero"\), following\(one\("\.v2-hero"\)\), "stack", true\)[\s\S]*\} else \{[\s\S]*pinnedHandoff/);
  });

  it("leads with the nura mark instead of a full-screen disc", () => {
    assert.match(lib, /\.fe-topics-glow/);
    assert.match(lib, /\.fe-topics-core/);
    assert.doesNotMatch(lib, /layer\(document\.body/);
    assert.match(src("app/components/motion/choreography.ts"), /document\.querySelectorAll\("\.mo-layer"\)\.forEach\(\(el\) => el\.remove\(\)\)/);
  });

  it("repaints proxy effects on refresh and never rebuilds on its own overlays", () => {
    assert.match(lib, /onRefresh: \(\) => refreshers\.forEach/);
    assert.match(src("app/components/motion/choreography.ts"), /sign after building/);
  });

  it("grows the closing CTA out of the nearest visible blog card, copy last", () => {
    assert.match(home, /from: \(\) => q<HTMLElement>\(root, ".fe-blog .fe-blog-masonry-card"\)/);
    assert.match(lib, /if \(!el.offsetParent\) continue;/);
    assert.match(lib, /opts.content, \{ opacity: 0, y: 28 \}/);
    assert.doesNotMatch(src("app/components/frontend/HomeLandingV2.tsx"), /SectionWipe/);
    assert.match(lib, /gsap\.set\(next, \{ clipPath: "none" \}\)/);
  });
});