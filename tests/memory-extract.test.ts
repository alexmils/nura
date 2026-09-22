import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bodyPrefixKey,
  isDuplicateMemoryNote,
  MEMORY_EXTRACT_BODY_MAX,
  MEMORY_EXTRACT_MAX_NOTES,
  MEMORY_EXTRACT_TITLE_MAX,
  mergeProfilePatchFromExtract,
  normalizeMemoryTitle,
  parseMemoryExtractPayload,
  shouldScheduleMemoryExtract,
} from "@/lib/memory-extract";

describe("shouldScheduleMemoryExtract", () => {
  const base = {
    memoryFlagEnabled: true,
    mode: "guided" as const,
    previousPhase: "body_scan" as const,
    previousIncomplete: true,
    nextPhase: "closure" as const,
    nextIncomplete: false,
    alreadyExtracted: false,
  };

  it("schedules when a guided session reaches proper closure", () => {
    assert.equal(shouldScheduleMemoryExtract(base), true);
  });

  it("skips when memory flag is off", () => {
    assert.equal(
      shouldScheduleMemoryExtract({ ...base, memoryFlagEnabled: false }),
      false
    );
  });

  it("skips self-guided", () => {
    assert.equal(shouldScheduleMemoryExtract({ ...base, mode: "free" }), false);
  });

  it("skips leave-anyway incomplete", () => {
    assert.equal(
      shouldScheduleMemoryExtract({ ...base, nextIncomplete: true }),
      false
    );
  });

  it("retries while still closed if claim was cleared (failed extract)", () => {
    assert.equal(
      shouldScheduleMemoryExtract({
        ...base,
        previousPhase: "closure",
        previousIncomplete: false,
        alreadyExtracted: false,
      }),
      true
    );
  });

  it("skips when already extracted", () => {
    assert.equal(
      shouldScheduleMemoryExtract({ ...base, alreadyExtracted: true }),
      false
    );
    assert.equal(
      shouldScheduleMemoryExtract({
        ...base,
        previousPhase: "closure",
        previousIncomplete: false,
        alreadyExtracted: true,
      }),
      false
    );
  });
});

describe("parseMemoryExtractPayload", () => {
  it("caps notes and strips em dashes", () => {
    const notes = Array.from({ length: 8 }, (_, i) => ({
      title: `Theme ${i}`,
      body: `Fact ${i} — with dash`,
    }));
    const parsed = parseMemoryExtractPayload(
      JSON.stringify({ notes, profilePatch: {} }),
      []
    );
    assert.equal(parsed.notes.length, MEMORY_EXTRACT_MAX_NOTES);
    assert.ok(parsed.notes.every((n) => !n.body.includes("\u2014")));
    assert.ok(
      parsed.notes.every(
        (n) =>
          n.title.length <= MEMORY_EXTRACT_TITLE_MAX &&
          n.body.length <= MEMORY_EXTRACT_BODY_MAX
      )
    );
  });

  it("dedupes against existing titles and body prefixes", () => {
    const existing = [{ title: "Safe place", body: "Beach with soft sand" }];
    const parsed = parseMemoryExtractPayload(
      JSON.stringify({
        notes: [
          { title: "Safe place", body: "Different body" },
          { title: "Other", body: "Beach with soft sand and more" },
          { title: "New theme", body: "Prefers shorter sets" },
        ],
      }),
      existing
    );
    assert.equal(parsed.notes.length, 1);
    assert.equal(parsed.notes[0]?.title, "New theme");
  });

  it("drops crisis-shaped notes", () => {
    const parsed = parseMemoryExtractPayload(
      JSON.stringify({
        notes: [
          { title: "Crisis", body: "Wants to end my life tonight" },
          { title: "Goal", body: "Sleep better this week" },
        ],
      }),
      []
    );
    assert.equal(parsed.notes.length, 1);
    assert.equal(parsed.notes[0]?.title, "Goal");
  });

  it("returns skipReason on empty JSON", () => {
    const parsed = parseMemoryExtractPayload("not json", []);
    assert.equal(parsed.skipReason, "no_json");
    assert.equal(parsed.notes.length, 0);
  });
});

describe("mergeProfilePatchFromExtract", () => {
  it("fills empty profile fields", () => {
    const merged = mergeProfilePatchFromExtract(null, {
      presentingProblem: "Work stress",
      goals: "Feel calmer",
    });
    assert.equal(merged.presentingProblem, "Work stress");
    assert.equal(merged.goals, "Feel calmer");
  });

  it("appends when new text is not already contained", () => {
    const merged = mergeProfilePatchFromExtract(
      {
        userId: "u1",
        redFlag: false,
        updatedAt: new Date().toISOString(),
        resources: "Butterfly hug",
      },
      { resources: "Safe place beach" }
    );
    assert.match(merged.resources ?? "", /Butterfly hug/);
    assert.match(merged.resources ?? "", /Safe place beach/);
  });

  it("skips when existing already contains the new text", () => {
    const merged = mergeProfilePatchFromExtract(
      {
        userId: "u1",
        redFlag: false,
        updatedAt: new Date().toISOString(),
        goals: "Feel calmer at work",
      },
      { goals: "Feel calmer" }
    );
    assert.equal(merged.goals, undefined);
  });
});

describe("memory note keys", () => {
  it("normalizes titles and body prefixes", () => {
    assert.equal(normalizeMemoryTitle("  Safe  Place "), "safe place");
    assert.equal(bodyPrefixKey("Hello   world"), "hello world");
    assert.equal(
      isDuplicateMemoryNote(
        { title: "Safe place", body: "x" },
        [{ title: "SAFE PLACE", body: "other" }]
      ),
      true
    );
  });
});
