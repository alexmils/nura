import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { backdropPlan, gradientLayerStyle } from "../lib/marketing-sections.ts";

const GRAD = { gradOn: "1", gradFrom: "#14301f", gradTo: "#c6d67e", gradAngle: "120", gradOpacity: "55" };

describe("section backdrop plan (ownBackground sections such as home-close)", () => {
  it("'As the background' paints the gradient over the solid colour", () => {
    const plan = backdropPlan({ bgKind: "color", bgColor: "#c93131", ...GRAD, gradMode: "background" });
    assert.equal(plan.showBg, true);
    assert.equal(plan.bg?.color, "#c93131");
    assert.equal(plan.gradientAt, "under");
    assert.ok(plan.gradient);
    assert.deepEqual(gradientLayerStyle(plan.gradient!), {
      backgroundImage: "linear-gradient(120deg, #14301f, #c6d67e)",
      opacity: 0.55,
    });
  });

  it("'As the background' replaces an image and the built-in photo", () => {
    const img = backdropPlan({ bgKind: "image", bgImage: "https://x/y.jpg", ...GRAD, gradMode: "background" });
    assert.equal(img.showBg, false);
    assert.equal(img.gradientAt, "under");
    const builtIn = backdropPlan({ ...GRAD, gradMode: "background" }, true);
    assert.equal(builtIn.showBuiltIn, false);
  });

  it("'Overlay' sits over image/video, and is the background over a plain colour", () => {
    const img = backdropPlan({ bgKind: "image", bgImage: "https://x/y.jpg", ...GRAD, gradMode: "overlay" });
    assert.equal(img.showBg, true);
    assert.equal(img.gradientAt, "over");
    const builtIn = backdropPlan({ ...GRAD, gradMode: "overlay" }, true);
    assert.equal(builtIn.showBuiltIn, true);
    assert.equal(builtIn.gradientAt, "over");
    const color = backdropPlan({ bgKind: "color", bgColor: "#c93131", ...GRAD, gradMode: "overlay" });
    assert.equal(color.showBg, true);
    assert.equal(color.gradientAt, "under");
  });

  it("no gradient keeps the old rendering", () => {
    const plan = backdropPlan({ bgKind: "color", bgColor: "#c93131" });
    assert.equal(plan.gradient, null);
    assert.equal(plan.gradientAt, null);
    assert.equal(plan.showBg, true);
    assert.equal(backdropPlan({}, true).showBuiltIn, true);
  });
});
