import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  glowLevel,
  ORB_STATE_COLORS,
  ORB_TINTS,
  orbkitState,
  orbVolumes,
  PHONE_LANDSCAPE_QUERY,
  pickOrbRenderer,
  readLevel,
  sweepMotion,
  voiceLayout,
} from "../app/components/voice/voice-orb-env.ts";

describe("voice orb environment", () => {
  it("uses the shader orb everywhere, the CSS blob only under reduced motion or without WebGL", () => {
    assert.equal(pickOrbRenderer({ reducedMotion: true, webgl: true }), "css");
    assert.equal(pickOrbRenderer({ reducedMotion: false, webgl: false }), "css");
    assert.equal(pickOrbRenderer({ reducedMotion: false, webgl: true }), "webgl");
  });

  it("maps our four states onto Orbkit's three", () => {
    assert.equal(orbkitState("idle"), "idle");
    assert.equal(orbkitState("listening"), "idle");
    assert.equal(orbkitState("thinking"), "thinking");
    assert.equal(orbkitState("speaking"), "speaking");
  });

  it("keeps the chosen idle tint exactly and gives every state a tint", () => {
    assert.equal(ORB_TINTS.idle, "#87d539");
    assert.equal(ORB_STATE_COLORS.idle.light, "#87d539");
    for (const t of Object.values(ORB_TINTS)) assert.match(t, /^#[0-9a-f]{6}$/);
    assert.equal(new Set(Object.values(ORB_TINTS)).size, 4);
  });

  it("feeds the mic while listening and the reply while speaking", () => {
    assert.deepEqual(orbVolumes("listening", 0.6), { input: 0.6 });
    assert.deepEqual(orbVolumes("listening", 3), { input: 1 });
    const out = orbVolumes("speaking", 0.5)?.output ?? 0;
    assert.ok(out > 0.45 && out <= 1);
    assert.equal(orbVolumes("speaking", 0), undefined);
    assert.equal(orbVolumes("thinking", 0.9), undefined);
    assert.equal(orbVolumes("idle", 0.9), undefined);
  });

  it("clamps levels from numbers and getters", () => {
    assert.equal(readLevel(2), 1);
    assert.equal(readLevel(-1), 0);
    assert.equal(readLevel(() => 0.4), 0.4);
    assert.equal(readLevel(Number.NaN), 0);
    assert.equal(readLevel(undefined), 0);
  });
});

describe("landscape glow drive", () => {
  it("follows the mic while listening and the reply while speaking", () => {
    assert.equal(glowLevel("listening", 0.7, 0.1, 0), 0.7);
    assert.equal(glowLevel("speaking", 0.9, 0.6, 0), 0.6);
    assert.equal(glowLevel("idle", 0.9, 0.9, 0), 0);
  });

  it("falls back to a gentle pulse when the reply has no analyser", () => {
    for (const t of [0, 0.7, 1.9, 4.2]) {
      const v = glowLevel("speaking", 0, 0, t);
      assert.ok(v >= 0.2 && v <= 0.5, `pulse ${v} at ${t}`);
    }
  });

  it("gathers into a sweeping beam only while thinking", () => {
    const rest = sweepMotion(0, 3);
    assert.equal(rest.gather, 0);
    assert.ok(Math.abs(rest.offset) < 1e-9);
    const on = sweepMotion(1, 1);
    assert.equal(on.gather, 1);
    assert.ok(Math.abs(on.offset) <= 0.62);
  });
});
describe("voice mode layout", () => {
  it("shows the orb stage on desktop and tablets, landscape or not", () => {
    assert.equal(voiceLayout({ width: 1440, height: 900, coarsePointer: false }), "stage");
    assert.equal(voiceLayout({ width: 1920, height: 1080, coarsePointer: false }), "stage");
    assert.equal(voiceLayout({ width: 1280, height: 480, coarsePointer: false }), "stage");
    assert.equal(voiceLayout({ width: 1180, height: 820, coarsePointer: true }), "stage");
  });

  it("shows the orb stage on portrait phones", () => {
    assert.equal(voiceLayout({ width: 390, height: 844, coarsePointer: true }), "stage");
    assert.equal(voiceLayout({ width: 360, height: 640, coarsePointer: true }), "stage");
  });

  it("drops the orb for the bottom glow only on a phone held sideways", () => {
    assert.equal(voiceLayout({ width: 844, height: 390, coarsePointer: true }), "glow");
    assert.equal(voiceLayout({ width: 932, height: 430, coarsePointer: true }), "glow");
    assert.equal(voiceLayout({ width: 844, height: 390, coarsePointer: false }), "stage");
  });

  it("keeps the media query narrow: landscape + short + touch", () => {
    assert.match(PHONE_LANDSCAPE_QUERY, /\(orientation: landscape\)/);
    assert.match(PHONE_LANDSCAPE_QUERY, /\(max-height: 500px\)/);
    assert.match(PHONE_LANDSCAPE_QUERY, /\(pointer: coarse\)/);
  });
});
