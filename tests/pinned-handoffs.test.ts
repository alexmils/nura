import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("advanced pinned hand-offs (alexandermils port)", () => {
  const lib = src("app/components/motion/pinned-handoffs.ts");
  const home = src("app/components/frontend/useHomeChoreography.ts");

  const pairs: Array<[string, string, string]> = [
    [".v2-hero", ".fe-spath", "zoom"],
    [".v2-modes", ".v2-session", "iris"],
    [".v2-session", ".fe-topics", "bloom"],
    [".fe-topics", ".v2-stories", "morph"],
    [".v2-stories", ".v2-pricing", "slide"],
    [".v2-pricing", ".fe-faq", "curtain"],
    [".mo-swipe", ".v2-close", "lens"],
  ];

  it("wires a distinct effect to every desktop home boundary", () => {
    for (const [a, b, fx] of pairs) {
      assert.ok(home.includes(`pinnedHandoff(one("${a}"), one("${b}"), "${fx}"`), `${a} -> ${b} ${fx}`);
    }
    const effects = pairs.map((p) => p[2]);
    assert.equal(new Set(effects).size, effects.length, "no two boundaries share an effect");
  });

  it("implements every effect and names its alexandermils source", () => {
    for (const fx of ["zoom", "iris", "bloom", "morph", "slide", "curtain", "lens"]) {
      assert.match(lib, new RegExp(`case "${fx}"`));
    }
    for (const source of ["SectionHandoff", "CurtainPin", "ScrollBloom", "Aperture", "HomeProcessAbout"]) {
      assert.ok(lib.includes(source), source);
    }
  });

  it("scrubs 1:1 on the previous block and never animates layout", () => {
    assert.match(lib, /trigger: prev, start: "bottom bottom", end: "bottom top", scrub: true/);
    // Tweens only touch transform, opacity, clip-path, radius and colour.
    assert.doesNotMatch(lib, /tl\.(?:to|fromTo)\([^;]*\b(?:width|height|margin\w*|padding\w*|top|left)\s*:/);
    assert.doesNotMatch(lib, /margin|padding/);
    assert.doesNotMatch(lib, /pinSpacing|pin: true/);
  });

  it("only animates neighbours, keeps overlays inert and leaves phones on the light hand-offs", () => {
    assert.match(lib, /!adjacent\(prev, next\)/);
    assert.match(lib, /pointerEvents: "none"/);
    assert.match(home, /if \(mobile\)[\s\S]*handoff\(one\("\.v2-hero"\), one\("\.fe-spath"\), "stack", true\)[\s\S]*\} else \{[\s\S]*pinnedHandoff/);
  });

  it("paints the lens window from a proxy (inset() strings are normalised by browsers)", () => {
    assert.match(lib, /const lens = \{ p: 0 \}/);
    assert.match(lib, /gsap\.set\(next, \{ clipPath: "none" \}\)/);
  });
});