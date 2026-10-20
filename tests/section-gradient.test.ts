import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getSectionDef, gradientCss, gradientIsOverlay, sectionGradient } from "../lib/marketing-sections";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("optional section gradient", () => {
  it("is off by default for every section", () => {
    for (const id of ["home-hero", "footer-cta", "home-cta"]) {
      const def = getSectionDef(id);
      if (def) assert.equal(sectionGradient(def.defaults as never), null, id);
    }
    assert.equal(sectionGradient({}), null);
  });

  it("keeps two stops, angle, opacity and placement only when switched on", () => {
    const on = sectionGradient({ gradOn: "1", gradMode: "background", gradFrom: "#112233", gradTo: "#AABBCC", gradAngle: "90", gradOpacity: "40" });
    assert.deepEqual(on, { mode: "background", from: "#112233", to: "#aabbcc", angle: 90, opacity: 40 });
    assert.equal(gradientCss(on!), "linear-gradient(90deg, #112233, #aabbcc)");
    assert.equal(sectionGradient({ gradOn: "0", gradFrom: "#112233" }), null);
    assert.equal(gradientIsOverlay({ ...on!, mode: "overlay" }, { kind: "image" } as never), true);
    assert.equal(gradientIsOverlay({ ...on!, mode: "overlay" }, null), false);
    assert.equal(gradientIsOverlay(on!, { kind: "image" } as never), false);
  });

  it("the hero has no flowers and no tint/scrim by default, and renders the optional gradient", () => {
    const hero = src("app/components/frontend/HomeLandingV2.tsx");
    assert.doesNotMatch(hero, /MeadowFlowers|v2-hero-tint|v2-hero-scrim/);
    assert.match(hero, /sectionGradient\(hero\)/);
    assert.match(src("app/components/frontend/section-editor/MarketingSectionEditor.tsx"), /<GradientControls values=\{values\} onChange=\{onChange\} \/>/);
  });
});