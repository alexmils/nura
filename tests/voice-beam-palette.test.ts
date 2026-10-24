import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEAM_PALETTES,
  blendPalette,
  easeBeam,
  edgeIntensity,
  mixHex,
} from "../app/components/voice/voice-beam-palette.ts";

const YELLOWS = ["#f5d742", "#ffe970"];
const GREENS = ["#9be84a", "#3fae4f", "#2f8a22"];

describe("voice beam palette (landscape phone)", () => {
  it("every state has 7 lobe colours and a full band", () => {
    for (const p of Object.values(BEAM_PALETTES)) {
      assert.equal(p.colors.length, 7);
      for (const c of [...p.colors, ...Object.values(p.bandColors)]) assert.match(c, /^#[0-9a-f]{6}$/i);
    }
  });

  it("active states mix golden yellow with lime / green (iridescent)", () => {
    for (const state of ["listening", "thinking", "speaking"] as const) {
      const all = [...BEAM_PALETTES[state].colors, ...Object.values(BEAM_PALETTES[state].bandColors)];
      assert.ok(YELLOWS.some((y) => all.includes(y)), state + " has yellow");
      assert.ok(GREENS.filter((g) => all.includes(g)).length >= 2, state + " has greens");
    }
    assert.ok(BEAM_PALETTES.speaking.colors.includes("#2f8a22"));
  });

  it("speaking is the most vivid, idle the faintest", () => {
    const s = BEAM_PALETTES;
    assert.ok(s.speaking.strength > s.listening.strength);
    assert.ok(s.speaking.strength > s.thinking.strength);
    assert.ok(s.idle.strength < s.thinking.strength && s.idle.strength <= 0.4);
  });

  it("edge intensity: speaking > listening, follows level; idle faint and flat", () => {
    assert.ok(edgeIntensity("speaking", 1) > edgeIntensity("listening", 1));
    assert.ok(edgeIntensity("speaking", 0.5) > edgeIntensity("listening", 0.5));
    assert.ok(edgeIntensity("listening", 0.9) > edgeIntensity("listening", 0.1));
    assert.equal(edgeIntensity("idle", 0), edgeIntensity("idle", 1));
    assert.ok(edgeIntensity("idle", 1) < 0.3);
    assert.equal(edgeIntensity("thinking", 0), edgeIntensity("thinking", 1));
    for (const st of ["idle", "listening", "thinking", "speaking"] as const) {
      for (const l of [-1, 0, 0.5, 1, 3, Number.NaN]) {
        const v = edgeIntensity(st, l);
        assert.ok(v >= 0 && v <= 1, st + " " + l);
      }
    }
  });

  it("mixHex blends linearly and clamps", () => {
    assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
    assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(mixHex("#000", "#fff", 2), "#ffffff");
  });

  it("blendPalette cross-fades colours and strength smoothly", () => {
    const a = BEAM_PALETTES.listening;
    const b = BEAM_PALETTES.speaking;
    assert.deepEqual(blendPalette(a, b, 0), a);
    assert.deepEqual(blendPalette(a, b, 1), b);
    const mid = blendPalette(a, b, 0.5);
    assert.ok(mid.strength > a.strength && mid.strength < b.strength);
    assert.notEqual(mid.colors[0], a.colors[0]);
    assert.notEqual(mid.colors[0], b.colors[0]);
  });

  it("easeBeam is a 0..1 smoothstep", () => {
    assert.equal(easeBeam(0), 0);
    assert.equal(easeBeam(1), 1);
    assert.equal(easeBeam(0.5), 0.5);
    assert.ok(easeBeam(0.1) < 0.1);
  });
});
