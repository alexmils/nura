import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("home plan cards spread", () => {
  it("uses Mindix's IX3 values: 250px / 20px / 10deg, 0.4s linear, once at top 50%", () => {
    const hook = src("app/components/frontend/usePlanSpread.ts");
    assert.match(hook, /x: 250, y: 20, rotation: 10, duration: 0\.4, ease: "none", start: 0\.5/);
    assert.match(hook, /once: true,\s*onEnter: \(\) => tween\.play\(\)/);
    assert.match(hook, /min-width: 901px\) and \(prefers-reduced-motion: no-preference\)/);
    assert.match(hook, /isA11yReduceMotionPreferred/);
    assert.doesNotMatch(hook, /opacity:|scrub/);
    assert.match(hook, /offsetLeft/);
    assert.match(hook, /layoutTop\(grid\)/);
  });

  it("is the only motion on the plan cards (landing reveal skips them)", () => {
    assert.match(src("app/components/frontend/useLandingMotion.ts"), /if \(el\.closest\("\.v2-price-grid"\)\) return false;/);
  });

  it("re-measures when shown cards change and re-spaces the row", () => {
    const page = src("app/components/frontend/HomeLandingV2.tsx");
    assert.match(
      page,
      /usePlanSpread\(planGridRef, `\$\{PLANS\.map\(\(plan\) => plan\.id\)\.join\(","\)\}\|/
    );
    assert.match(page, /"--plans-n" as string\]: PLANS\.length/);
    assert.match(src("app/components/frontend/plan-spread.css"), /repeat\(var\(--plans-n, 3\)/);
  });
});
