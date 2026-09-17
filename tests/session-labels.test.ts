import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkInPlaceholder,
  checkInQuickReplies,
  phaseLabel,
  showsSessionQuickReplies,
} from "../lib/session-labels.ts";

describe("session labels", () => {
  it("labels protocol phases", () => {
    assert.equal(phaseLabel("intake"), "Getting to know you");
    assert.equal(phaseLabel("desensitization"), "Desensitization");
    assert.equal(phaseLabel("body_scan"), "Body scan");
  });

  it("offers SUDs quick replies after desensitization sets", () => {
    const replies = checkInQuickReplies("desensitization");
    assert.ok(replies.some((r) => r.value.includes("SUDs is 0")));
    assert.ok(replies.some((r) => r.value.includes("SUDs is 10")));
  });

  it("offers intake topic quick replies", () => {
    const replies = checkInQuickReplies("intake");
    assert.ok(replies.some((r) => /anxiety/i.test(r.value)));
  });

  it("offers rerun/done instead of ratings after a stopped set", () => {
    const replies = checkInQuickReplies("desensitization", {
      setStopped: true,
    });
    assert.deepEqual(
      replies.map((r) => r.value),
      ["again", "done"]
    );
    assert.match(
      checkInPlaceholder("desensitization", { setStopped: true }),
      /rerun/i
    );
  });

  it("uses phase-specific check-in placeholders", () => {
    assert.equal(checkInPlaceholder("intake"), "Type here…");
    assert.match(checkInPlaceholder("installation"), /VoC/i);
    assert.match(checkInPlaceholder("desensitization"), /SUDs/i);
  });

  it("shows topic starters only before the first user message", () => {
    const before = {
      sessionMode: "idle" as const,
      phase: "intake" as const,
      conversationStarted: false,
    };
    assert.equal(showsSessionQuickReplies(before), true);
    assert.equal(
      showsSessionQuickReplies({ ...before, conversationStarted: true }),
      false
    );
  });

  it("keeps set-rating chips during check-in, even mid-conversation", () => {
    assert.equal(
      showsSessionQuickReplies({
        sessionMode: "check_in",
        phase: "desensitization",
        conversationStarted: true,
      }),
      true
    );
    // ...but not while the set is running or idle outside intake.
    assert.equal(
      showsSessionQuickReplies({
        sessionMode: "running",
        phase: "desensitization",
        conversationStarted: true,
      }),
      false
    );
    assert.equal(
      showsSessionQuickReplies({
        sessionMode: "idle",
        phase: "grounding",
        conversationStarted: false,
      }),
      false
    );
  });
});
