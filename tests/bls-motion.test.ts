import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ballTravelOffset,
  brightenFlashColor,
  flashClipPaths,
  flashPaint,
  motionAxisFromSize,
  pickRandomAnimationPath,
  resolveAnimationPath,
} from "../lib/bls-motion.ts";

describe("motionAxisFromSize", () => {
  it("uses horizontal for landscape / square", () => {
    assert.equal(motionAxisFromSize(844, 390), "horizontal");
    assert.equal(motionAxisFromSize(800, 800), "horizontal");
  });

  it("uses vertical for portrait", () => {
    assert.equal(motionAxisFromSize(390, 844), "vertical");
  });

  it("falls back safely for bad sizes", () => {
    assert.equal(motionAxisFromSize(0, 100), "horizontal");
    assert.equal(motionAxisFromSize(NaN, 100), "horizontal");
  });
});

describe("animation path", () => {
  it("follows the screen until a path is chosen", () => {
    assert.equal(resolveAnimationPath("auto", 844, 390), "horizontal");
    assert.equal(resolveAnimationPath("auto", 390, 844), "vertical");
    assert.equal(resolveAnimationPath("diagonal-up", 390, 844), "diagonal-up");
    assert.equal(resolveAnimationPath("random", 800, 400, "vertical"), "vertical");
    assert.equal(resolveAnimationPath("random", 800, 400, null), "horizontal");
  });

  it("picks a straight path for surprise", () => {
    assert.equal(pickRandomAnimationPath(() => 0), "horizontal");
    assert.equal(pickRandomAnimationPath(() => 0.99), "vertical");
  });

  it("travels the corners for diagonals and stays centered on a straight axis", () => {
    assert.deepEqual(ballTravelOffset("horizontal", 1, 100, 40), { x: 100, y: 20 });
    assert.deepEqual(ballTravelOffset("vertical", 0, 100, 40), { x: 50, y: 0 });
    assert.deepEqual(ballTravelOffset("diagonal-up", 0, 100, 40), { x: 0, y: 40 });
    assert.deepEqual(ballTravelOffset("diagonal-up", 1, 100, 40), { x: 100, y: 0 });
    assert.deepEqual(ballTravelOffset("diagonal-down", 1, 100, 40), { x: 100, y: 40 });
  });

  it("clips flashes to each end and brightens the chosen color", () => {
    assert.equal(flashClipPaths("horizontal").start, "inset(0 50% 0 0)");
    assert.match(flashClipPaths("diagonal-down").end, /polygon/);

    const lit = flashPaint("standard", "#ff0000", true, "#ffffff");
    assert.equal(lit.opacity, "1");
    assert.equal(lit.color, brightenFlashColor("#ff0000"));
    assert.notEqual(lit.color, "#ffffff");
    assert.notEqual(lit.color, "#000000");
    const litRgb = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(lit.color);
    assert.ok(litRgb);
    assert.ok(parseInt(litRgb[1], 16) > parseInt(litRgb[2], 16) + 40);

    const rest = flashPaint("standard", "#ff0000", false, "#ffffff");
    assert.equal(rest.color, "#ff0000");
    assert.equal(rest.opacity, "0.28");
    assert.equal(flashPaint("standard", "#ff0000", false, "#000000").opacity, "0");
    assert.equal(flashPaint("standard", "#ff0000", false, "#000000").color, "#ff0000");

    assert.equal(flashPaint("standard", "#ffffff", true).color, "#ffffff");
    assert.equal(brightenFlashColor("#ffffff"), "#ffffff");
    assert.equal(flashPaint("off", "#abcdef", false).color, "#abcdef");
    assert.equal(flashPaint("off", "#ff0000", true).color, "#ff0000");
  });
});
