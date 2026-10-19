import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("home plan cards spread", () => {
  it("scrubs x/rotation only, from measured offsets, desktop + motion-ok only", () => {
    const hook = src("app/components/frontend/usePlanSpread.ts");
    assert.match(hook, /min-width: 901px\) and \(prefers-reduced-motion: no-preference\)/);
    assert.match(hook, /isA11yReduceMotionPreferred/);
    assert.match(hook, /scrub: 0\.6/);
    assert.match(hook, /x: 0,\s+rotation: 0/);
    assert.doesNotMatch(hook, /opacity:/);
    assert.match(hook, /offsetLeft/);
  });

  it("re-measures when shown cards change and re-spaces the row", () => {
    const page = src("app/components/frontend/HomeLandingV2.tsx");
    assert.match(page, /usePlanSpread\(planGridRef, PLANS\.map\(\(plan\) => plan\.id\)\.join\(","\)\)/);
    assert.match(page, /"--plans-n" as string\]: PLANS\.length/);
    assert.match(src("app/components/frontend/plan-spread.css"), /repeat\(var\(--plans-n, 3\)/);
  });
});
