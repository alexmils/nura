import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("advanced pinned hand-offs (alexandermils port)", () => {
  const lib = src("app/components/motion/pinned-handoffs.ts");
  const home = src("app/components/frontend/useHomeChoreography.ts");

  const pairs: Array<[string, string, string]> = [
    [".v2-modes", ".v2-session", "lift"],
    [".v2-session", ".fe-topics", "settle"],
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
    // Pricing -> FAQ is intentionally a plain cut.
    assert.ok(!home.includes('pinnedHandoff(one(".v2-pricing")'), "pricing -> FAQ cut");
    // Every boundary is a deliberate morph join except the two colour blends.
    assert.equal(pairs.filter((p) => p[2] === "morph").length, 2);
  });

  it("implements every effect and names its alexandermils source", () => {
    for (const fx of ["zoom", "lift", "halo", "morph", "settle", "curtain", "lens"]) {
      assert.match(lib, new RegExp(`case "${fx}"`));
    }
    for (const source of ["SectionHandoff", "CurtainPin", "Aperture"]) {
      assert.ok(lib.includes(source), source);
    }
  });

  it("scrubs 1:1 on the previous block and never animates layout", () => {
    assert.match(lib, /trigger: prev,[\s\S]*?start: \(\) => layoutBottom\(prev\) - vh\(\),\s*end: \(\) => layoutBottom\(prev\),\s*scrub: true/);
    // Tweens only touch transform, opacity, clip-path, radius and colour.
    assert.doesNotMatch(lib, /tl\.(?:to|fromTo)\([^;]*\b(?:width|height|margin\w*|padding\w*|top|left)\s*:/);
    assert.doesNotMatch(lib, /margin|padding/);
    assert.doesNotMatch(lib, /pinSpacing|pin: true/);
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