import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeMicRms,
  rmsFromTimeDomain,
  smoothLevel,
} from "../lib/mic-level";

describe("mic-level", () => {
  it("rmsFromTimeDomain is ~0 for silence (128)", () => {
    const data = Uint8Array.from({ length: 32 }, () => 128);
    assert.ok(rmsFromTimeDomain(data) < 0.001);
  });

  it("rmsFromTimeDomain rises with amplitude", () => {
    const quiet = Uint8Array.from({ length: 32 }, () => 128);
    const loud = Uint8Array.from({ length: 32 }, (_, i) =>
      i % 2 === 0 ? 200 : 56
    );
    assert.ok(rmsFromTimeDomain(loud) > rmsFromTimeDomain(quiet));
  });

  it("normalizeMicRms gates noise and clamps", () => {
    assert.equal(normalizeMicRms(0.01), 0);
    assert.ok(normalizeMicRms(0.2) > 0.5);
    assert.equal(normalizeMicRms(1), 1);
  });

  it("smoothLevel attacks faster than it releases", () => {
    const up = smoothLevel(0, 1, 0.5, 0.1);
    const down = smoothLevel(1, 0, 0.5, 0.1);
    assert.ok(up > 0.4);
    assert.ok(down > 0.8);
  });
});
