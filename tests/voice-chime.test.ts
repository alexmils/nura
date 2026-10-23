import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHIMES,
  chimeDuration,
  createChimeGate,
  dbToGain,
  shouldPlayChime,
  START_CHIME_MIC_GUARD_MS,
} from "../lib/voice-chime.ts";

describe("voice chimes", () => {
  it("are short, soft and click-free", () => {
    const start = chimeDuration(CHIMES.start);
    const end = chimeDuration(CHIMES.end);
    assert.ok(start >= 0.4 && start <= 0.8, `start ${start}`);
    assert.ok(end >= 0.4 && end <= 0.8, `end ${end}`);
    assert.ok(CHIMES.start.peakDb <= -18);
    assert.ok(CHIMES.end.peakDb < CHIMES.start.peakDb, "end is softer");
    for (const spec of Object.values(CHIMES)) {
      assert.ok(spec.attack >= 0.015, "gentle attack");
      for (const n of spec.notes) {
        assert.ok(n.type === "sine" || n.type === "triangle");
        assert.ok(n.level > 0 && n.level <= 1);
        assert.ok(n.dur > spec.attack + 0.1, "room for a release");
      }
    }
    assert.ok(Math.abs(dbToGain(-18) - 0.1259) < 0.001);
  });

  it("start rises, end falls lower", () => {
    const s = CHIMES.start.notes.filter((n) => n.type === "sine");
    const e = CHIMES.end.notes;
    assert.ok(s[1].freq > s[0].freq);
    assert.ok(e[1].freq < e[0].freq);
    assert.ok(Math.max(...e.map((n) => n.freq)) < Math.min(...s.map((n) => n.freq)));
  });

  it("guards the mic for the whole start chime", () => {
    assert.ok(START_CHIME_MIC_GUARD_MS >= chimeDuration(CHIMES.start) * 1000);
    assert.ok(START_CHIME_MIC_GUARD_MS < 1200);
  });

  it("plays once per entry and once per exit", () => {
    const g = createChimeGate();
    assert.equal(g.exit(), false, "no end chime before a start");
    assert.equal(g.enter(), true);
    // State changes / a second tap while active: no replay.
    assert.equal(g.enter(), false);
    assert.equal(g.enter(), false);
    assert.equal(g.exit(), true);
    assert.equal(g.exit(), false, "double End voice");
    assert.equal(g.enter(), true, "next entry chimes again");
    assert.equal(g.open, true);
  });

  it("stays silent when off, hidden, or without Web Audio", () => {
    const on = { enabled: true, visibility: "visible", audioState: "running" };
    assert.equal(shouldPlayChime(on), true);
    assert.equal(shouldPlayChime({ ...on, audioState: "suspended" }), true, "scheduled; plays once resumed by the tap");
    assert.equal(shouldPlayChime({ ...on, enabled: false }), false);
    assert.equal(shouldPlayChime({ ...on, visibility: "hidden" }), false);
    assert.equal(shouldPlayChime({ ...on, audioState: null }), false);
    assert.equal(shouldPlayChime({ ...on, audioState: "closed" }), false);
  });
});
