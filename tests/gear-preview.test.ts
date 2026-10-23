import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewPan, togglePreview } from "../lib/gear-preview.ts";

describe("gear sound preview", () => {
  it("pans each row to its side, honoring reverse", () => {
    assert.equal(previewPan("left", false), -1);
    assert.equal(previewPan("right", false), 1);
    assert.equal(previewPan("left", true), 1);
    assert.equal(previewPan("right", true), -1);
  });

  it("tap again stops, another row replaces (one at a time)", () => {
    assert.deepEqual(togglePreview(null, "left"), { stop: null, start: "left" });
    assert.deepEqual(togglePreview("left", "left"), { stop: "left", start: null });
    assert.deepEqual(togglePreview("left", "right"), { stop: "left", start: "right" });
  });
});