import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ballTravelOffset,
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

  it("clips flashes to each end and brightens to white", () => {
    assert.equal(flashClipPaths("horizontal").start, "inset(0 50% 0 0)");
    assert.match(flashClipPaths("diagonal-down").end, /polygon/);
    assert.deepEqual(flashPaint("standard", "#111111", true), {
      color: "#ffffff",
      opacity: "1",
    });
    assert.equal(flashPaint("standard", "#111111", false, "#ffffff").opacity, "0.28");
    assert.equal(flashPaint("standard", "#111111", false, "#000000").opacity, "0");
    assert.equal(flashPaint("off", "#abcdef", false).color, "#abcdef");
  });
});
