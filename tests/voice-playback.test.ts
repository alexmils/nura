import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSpokenTracker,
  MAX_CHIME_WAIT_MS,
  planTtsStart,
  TTS_PREROLL_MS,
} from "../lib/voice-playback.ts";

describe("voice mode: no replay of already-shown guide lines", () => {
  it("the line on screen when voice opens is never auto-spoken", () => {
    const t = createSpokenTracker();
    t.baseline("m-thank-you");
    assert.equal(t.claim("m-thank-you"), false);
  });

  it("a new reply that arrives after opening is spoken exactly once", () => {
    const t = createSpokenTracker();
    t.baseline("m1");
    assert.equal(t.claim("m2"), true);
    assert.equal(t.claim("m2"), false);
  });

  it("re-opening voice mode does not replay the last line again", () => {
    const t = createSpokenTracker();
    t.baseline("m1");
    assert.equal(t.claim("m2"), true); // spoken in voice
    t.baseline("m2"); // closed and opened again
    assert.equal(t.claim("m2"), false);
    // Typed in text mode meanwhile, guide answered m3, then voice opens:
    t.baseline("m3");
    assert.equal(t.claim("m3"), false);
  });

  it("brand-new session: first message arriving after voice opened is spoken", () => {
    const t = createSpokenTracker();
    t.baseline(null); // nothing on screen yet
    assert.equal(t.claim("welcome"), true);
  });

  it("replies played inside a turn are marked and not replayed by the effect", () => {
    const t = createSpokenTracker();
    t.mark("reply-1");
    assert.equal(t.has("reply-1"), true);
    assert.equal(t.claim("reply-1"), false);
  });

  it("ignores empty ids and stays bounded", () => {
    const t = createSpokenTracker(3);
    assert.equal(t.claim(null), false);
    assert.equal(t.claim(""), false);
    for (const id of ["a", "b", "c", "d"]) t.mark(id);
    assert.equal(t.has("a"), false);
    assert.equal(t.has("d"), true);
  });
});

describe("voice mode: TTS start plan (no clipped first syllable)", () => {
  it("always runs a 150-250 ms pre-roll that overlaps into speech", () => {
    const p = planTtsStart({ now: 1000 });
    assert.equal(p.chimeWaitMs, 0);
    assert.equal(p.prerollMs, TTS_PREROLL_MS);
    assert.ok(p.prerollMs >= 150 && p.prerollMs <= 250);
    assert.ok(p.silenceMs > p.prerollMs);
  });

  it("waits for the start chime to finish first", () => {
    const p = planTtsStart({ now: 1000, chimeEndsAt: 1450 });
    assert.equal(p.chimeWaitMs, 450);
    assert.equal(planTtsStart({ now: 2000, chimeEndsAt: 1450 }).chimeWaitMs, 0);
  });

  it("caps a stale / huge chime wait and handles bad input", () => {
    assert.equal(planTtsStart({ now: 0, chimeEndsAt: 1e9 }).chimeWaitMs, MAX_CHIME_WAIT_MS);
    assert.equal(planTtsStart({ now: 0, chimeEndsAt: Number.NaN }).chimeWaitMs, 0);
    assert.equal(planTtsStart({ now: 0, prerollMs: -5 }).prerollMs, 0);
  });
});
