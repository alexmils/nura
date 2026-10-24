import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consecutiveMessagesRule,
  guardRepeatedReply,
  heuristicTurn,
  isNearDuplicateReply,
  lastAgentMessage,
  trailingUserMessages,
} from "../lib/agent-turn.ts";
import { threadPatchFromInterpretation, EMPTY_INTERPRETATION } from "../lib/session-interpreter.ts";
import type { Thread } from "../lib/types.ts";

const Q_THERAPY = "Clear goal. Have you ever tried EMDR or any other therapy before?";
const Q_UNREAL =
  "Do you ever experience moments when things feel unreal or like you are disconnected from yourself?";

describe("guide never repeats its previous line", () => {
  it("'No' then 'first time' must not get the identical previous question", () => {
    // Order the server sees once sends are serialized: the first reply is
    // stored before the late message is handled.
    const history = [
      { role: "agent", content: Q_THERAPY },
      { role: "user", content: "No" },
      { role: "agent", content: Q_UNREAL },
      { role: "user", content: "first time" },
    ];
    assert.equal(guardRepeatedReply({ reply: Q_UNREAL, history, retried: false }), "retry");
    assert.equal(guardRepeatedReply({ reply: Q_UNREAL, history, retried: true }), "drop");
    assert.equal(
      guardRepeatedReply({
        reply: "Got it, this is your first time. Do you sometimes feel unreal or cut off from yourself?",
        history,
        retried: false,
      }),
      "use"
    );
  });

  it("catches the parallel-request race too (both user messages before any reply)", () => {
    const history = [
      { role: "agent", content: Q_THERAPY },
      { role: "user", content: "No" },
      { role: "user", content: "first time" },
      { role: "agent", content: Q_UNREAL },
    ];
    assert.equal(guardRepeatedReply({ reply: Q_UNREAL, history, retried: false }), "retry");
  });

  it("a reply never equals the last assistant message (case, punctuation, accents)", () => {
    const prev = "That’s helpful. What would “better” look like for you regarding your anxiety?";
    assert.equal(isNearDuplicateReply(prev, prev), true);
    assert.equal(isNearDuplicateReply(prev.toUpperCase(), prev), true);
    assert.equal(
      isNearDuplicateReply("That's helpful, what would better look like for you regarding your anxiety", prev),
      true
    );
    assert.equal(isNearDuplicateReply("What would you like to feel or have changed about your anxiety?", prev), false);
    assert.equal(isNearDuplicateReply("Go with that.", null), false);
  });

  it("tells the guide when the user sent several messages in a row", () => {
    const history = [
      { role: "agent", content: Q_THERAPY },
      { role: "user", content: "No" },
      { role: "user", content: "first time" },
    ];
    assert.deepEqual(trailingUserMessages(history), ["No", "first time"]);
    assert.equal(lastAgentMessage(history), Q_THERAPY);
    assert.match(consecutiveMessagesRule(trailingUserMessages(history)), /2 messages in a row/);
    assert.equal(consecutiveMessagesRule(["only one"]), "");
  });
});

function thread(phase: Thread["phase"], target?: string): Thread {
  return {
    id: "t1",
    title: "Test",
    mode: "guided",
    phase,
    target,
    incomplete: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("grounding does not end on naming the safe place", () => {
  it("an echoed target does not move grounding to assessment", () => {
    const patch = threadPatchFromInterpretation(thread("grounding", "anxiety"), {
      ...EMPTY_INTERPRETATION,
      target: "anxiety",
      resources: "safe place: bedroom",
    });
    assert.equal(patch.phase, undefined);
    assert.equal(patch.target, undefined);
  });

  it("the safe place is not stored as the target", () => {
    const patch = threadPatchFromInterpretation(thread("grounding", "anxiety"), {
      ...EMPTY_INTERPRETATION,
      target: "bedroom",
    });
    assert.equal(patch.target, undefined);
    assert.equal(patch.phase, undefined);
  });

  it("a named negative cognition still moves on", () => {
    const patch = threadPatchFromInterpretation(thread("grounding", "anxiety"), {
      ...EMPTY_INTERPRETATION,
      negativeCognition: "I am not good enough",
    });
    assert.equal(patch.phase, "assessment");
  });

  it("heuristic fallback waits for 'ready' in grounding", () => {
    const base = { phase: "grounding" as const, target: "anxiety" };
    assert.equal(
      heuristicTurn({ thread: base, userMessage: "maybe when I'm in my bedroom", userTurns: 8 }).patch.phase,
      undefined
    );
    assert.equal(heuristicTurn({ thread: base, userMessage: "ready", userTurns: 9 }).patch.phase, "assessment");
    assert.equal(heuristicTurn({ thread: base, userMessage: "spremna sam", userTurns: 9 }).patch.phase, "assessment");
  });
});
