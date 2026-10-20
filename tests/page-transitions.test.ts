import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_PAGE_TRANSITIONS,
  PAGE_TRANSITIONS,
  TRANSITION_TIMING,
  pageTransitionAt,
  transitionLayers,
} from "../lib/page-transitions.ts";

describe("automatic page transition rotation", () => {
  it("cycles the calm set and wraps both ways", () => {
    const seen = AUTO_PAGE_TRANSITIONS.map((_, index) => pageTransitionAt(index));
    assert.deepEqual(seen, [...AUTO_PAGE_TRANSITIONS]);
    assert.equal(pageTransitionAt(AUTO_PAGE_TRANSITIONS.length), AUTO_PAGE_TRANSITIONS[0]);
    assert.equal(
      pageTransitionAt(-1),
      AUTO_PAGE_TRANSITIONS[AUTO_PAGE_TRANSITIONS.length - 1]
    );
  });

  it("stays subtle and renderable", () => {
    const aggressive = new Set([
      "none",
      "sageColumns",
      "stackUp",
      "doors",
      "iris",
      "dots",
    ]);
    for (const kind of AUTO_PAGE_TRANSITIONS) {
      assert.equal(aggressive.has(kind), false, kind);
      assert.ok(PAGE_TRANSITIONS.includes(kind));
      assert.ok(TRANSITION_TIMING[kind]);
      assert.ok(transitionLayers(kind).length > 0);
    }
  });
});
