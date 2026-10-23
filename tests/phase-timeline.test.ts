import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  markersFromPhaseChanges,
  phaseAnchor,
  phaseBadges,
  shouldRecordPhaseChange,
  type TimelineMessage,
} from "../lib/phase-timeline.ts";

const msgs = (roles: string): TimelineMessage[] =>
  [...roles].map((r, i) => ({ id: `m${i}`, role: r === "a" ? "agent" : "user" }));

const flat = (b: ReturnType<typeof phaseBadges>) =>
  [...b.before.entries()].flatMap(([i, ps]) => ps.map((p) => `${i}:${p}`)).concat(b.end.map((p) => `end:${p}`));

describe("phase timeline badges", () => {
  it("shows nothing without messages", () => {
    assert.deepEqual(flat(phaseBadges([], "intake")), []);
  });

  it("opens every session with intake", () => {
    assert.deepEqual(flat(phaseBadges(msgs("aua"), "intake")), ["0:intake"]);
  });

  it("derives the current phase just before the latest guide message after a reload", () => {
    assert.deepEqual(flat(phaseBadges(msgs("auaua"), "grounding")), ["0:intake", "4:grounding"]);
  });

  it("puts a phase that began after the last user message at the end", () => {
    assert.deepEqual(flat(phaseBadges(msgs("auau"), "assessment")), ["0:intake", "end:assessment"]);
  });

  it("uses recorded markers as a timeline and adds only the missing current phase", () => {
    const stored = [
      { phase: "intake" as const, afterId: null },
      { phase: "grounding" as const, afterId: "m1" },
    ];
    assert.deepEqual(flat(phaseBadges(msgs("auauaua"), "grounding", stored)), ["0:intake", "2:grounding"]);
    assert.deepEqual(flat(phaseBadges(msgs("auauaua"), "assessment", stored)), ["0:intake", "2:grounding", "6:assessment"]);
  });

  it("drops markers whose message is gone and never repeats a phase back to back", () => {
    const stored = [
      { phase: "intake" as const, afterId: null },
      { phase: "intake" as const, afterId: "m1" },
      { phase: "grounding" as const, afterId: "gone" },
    ];
    assert.deepEqual(flat(phaseBadges(msgs("aua"), "intake", stored)), ["0:intake"]);
  });

  it("derives the anchor before the guide reply that came with a change", () => {
    assert.equal(phaseAnchor(msgs("aua")), "m1");
    assert.equal(phaseAnchor(msgs("au")), "m1");
    assert.equal(phaseAnchor([]), null);
  });
});

describe("server phase timeline (thread_phase_changes)", () => {
  it("writes a row only when the phase really changes", () => {
    assert.equal(shouldRecordPhaseChange("intake", "grounding"), true);
    assert.equal(shouldRecordPhaseChange("grounding", "grounding"), false);
    assert.equal(shouldRecordPhaseChange(undefined, "intake"), true);
  });

  it("turns server rows into badges anchored after the user message of that turn", () => {
    // Chat turn: user message m3 saved, phase updated (row anchored to m3), guide reply m4.
    const rows = [
      { phase: "grounding" as const, afterMessageId: "m1", messageIndex: 2, createdAt: "2026-10-23T10:00:00Z" },
      { phase: "assessment" as const, afterMessageId: "m3", messageIndex: 4, createdAt: "2026-10-23T10:05:00Z" },
    ];
    const markers = markersFromPhaseChanges(rows);
    assert.deepEqual(markers[1], { phase: "assessment", afterId: "m3", index: 4 });
    assert.deepEqual(flat(phaseBadges(msgs("auaua"), "assessment", markers)), ["0:intake", "2:grounding", "4:assessment"]);
  });

  it("is the same on any device: no local state, only rows + messages", () => {
    const rows = [{ phase: "grounding" as const, afterMessageId: "m1", messageIndex: 2, createdAt: "x" }];
    const a = flat(phaseBadges(msgs("auaua"), "grounding", markersFromPhaseChanges(rows)));
    const b = flat(phaseBadges(msgs("auaua"), "grounding", markersFromPhaseChanges(structuredClone(rows))));
    assert.deepEqual(a, b);
  });

  it("falls back to the stored position when the anchor message is gone", () => {
    const rows = [{ phase: "grounding" as const, afterMessageId: "deleted", messageIndex: 2, createdAt: "x" }];
    assert.deepEqual(flat(phaseBadges(msgs("auaua"), "grounding", markersFromPhaseChanges(rows))), ["0:intake", "2:grounding"]);
  });

  it("keeps the old-thread fallback when there are no rows", () => {
    assert.deepEqual(markersFromPhaseChanges(undefined), []);
    assert.deepEqual(flat(phaseBadges(msgs("auaua"), "grounding", markersFromPhaseChanges(null))), ["0:intake", "4:grounding"]);
  });
});
