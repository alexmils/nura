import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baselinePatch,
  classifyInterpreterOutput,
  closedSessionReply,
  CLOSED_SESSION_LINE,
  guideAppStateBlock,
  guardSetEntry,
  heuristicTurn,
  isFarewell,
  usagePurposeForOutcome,
} from "../lib/agent-turn.ts";
import { openAiCompatibleBodyExtras } from "../lib/llm.ts";
import { closureCardData, changeLabel } from "../lib/session-closure-card.ts";
import {
  canManualStartGuidedSet,
  shouldAutoStartSet,
} from "../lib/session-mode.ts";
import * as sessionMode from "../lib/session-mode.ts";
import {
  isStuckThread,
  setsPerThreadSummary,
  summarizeInterpreterHealth,
} from "../lib/agent-health-format.ts";

// What production actually returned: DeepSeek V4 spent the 512-token budget on
// reasoning and the JSON stopped mid-field.
const TRUNCATED =
  '{\n  "suds": 6,\n  "voc": null,\n  "target": "classroom at 12, everyone laughing",\n  "negativeCognition": null,\n  "positiveCognition": null,\n  "suggestedPhase": null,\n  "distress": "ok",\n  "outOfWindow": false,\n  "setReport": null,\n  "needsGrounding": false,\n  "summary": "User rates the classroom memory at 6 and is rea';

describe("interpreter output classification", () => {
  it("treats finish_reason=length as a cutoff even if it looks like JSON", () => {
    assert.equal(classifyInterpreterOutput(TRUNCATED, "length").outcome, "cutoff");
    assert.equal(classifyInterpreterOutput('{"suds": 3}', "length").outcome, "cutoff");
  });

  it("treats unterminated or non-JSON output as unparsable", () => {
    assert.equal(classifyInterpreterOutput(TRUNCATED, "stop").outcome, "unparsable");
    assert.equal(classifyInterpreterOutput("", "stop").outcome, "unparsable");
    assert.equal(classifyInterpreterOutput("Sure! Here you go.", "stop").outcome, "unparsable");
  });

  it("accepts a complete object", () => {
    const r = classifyInterpreterOutput('{"suds": 4, "startSet": true}', "stop");
    assert.equal(r.outcome, "ok");
    assert.deepEqual(r.raw, { suds: 4, startSet: true });
  });

  it("maps outcomes to countable usage purposes", () => {
    assert.equal(usagePurposeForOutcome("ok"), "interpreter");
    assert.equal(usagePurposeForOutcome("cutoff"), "interpreter_cutoff");
    assert.equal(usagePurposeForOutcome("unparsable"), "interpreter_unparsed");
    assert.equal(usagePurposeForOutcome("error"), "interpreter_unparsed");
  });

  it("gives the interpreter its own budget, JSON mode and no hidden reasoning", () => {
    const ds = openAiCompatibleBodyExtras("deepseek", "deepseek-v4-flash", {
      maxTokens: 2048,
      json: true,
      disableThinking: true,
    });
    assert.equal(ds.max_tokens, 2048);
    assert.deepEqual(ds.response_format, { type: "json_object" });
    assert.deepEqual(ds.thinking, { type: "disabled" });
    const oa = openAiCompatibleBodyExtras("openai", "gpt-4.1-mini", {
      maxTokens: 2048,
      json: true,
      disableThinking: true,
    });
    assert.equal(oa.max_completion_tokens, 2048);
    assert.equal(oa.thinking, undefined);
    // The guide keeps its old defaults.
    const guide = openAiCompatibleBodyExtras("deepseek", "deepseek-v4-flash");
    assert.equal(guide.max_tokens, 512);
    assert.equal(guide.thinking, undefined);
    assert.equal(guide.response_format, undefined);
  });
});

describe("truncated interpreter JSON -> heuristic fallback", () => {
  it("advances assessment with target + SUDs into desensitization and starts the set", () => {
    const { outcome } = classifyInterpreterOutput(TRUNCATED, "length");
    assert.equal(outcome, "cutoff");
    const turn = heuristicTurn({
      thread: { phase: "assessment", target: "classroom at 12", intakeComplete: true },
      userMessage: "I'd say a 6.",
      userTurns: 9,
      firstUserMessage: "A teacher mocked me in front of the class",
    });
    assert.equal(turn.patch.phase, "desensitization");
    assert.equal(turn.patch.suds, 6);
    assert.equal(turn.interpretation.startSet, true);
    assert.equal(
      shouldAutoStartSet({
        startSet: turn.interpretation.startSet,
        sessionKind: "guided",
        phase: turn.patch.phase!,
        sessionMode: "idle",
      }),
      true
    );
  });

  it("uses the first substantive user message as target when none is stored", () => {
    const turn = heuristicTurn({
      thread: { phase: "assessment" },
      userMessage: "10",
      userTurns: 8,
      firstUserMessage: "loneliness, sitting in a wardrobe at 10",
    });
    assert.equal(turn.patch.phase, "desensitization");
    assert.equal(turn.patch.target, "loneliness, sitting in a wardrobe at 10");
    assert.equal(turn.interpretation.startSet, true);
  });

  it("does not leave intake stuck forever and does not start a set from intake", () => {
    const early = heuristicTurn({ thread: { phase: "intake" }, userMessage: "stress", userTurns: 1 });
    assert.equal(early.patch.phase, undefined);
    const later = heuristicTurn({
      thread: { phase: "intake" },
      userMessage: "yes that is the one",
      userTurns: 4,
      firstUserMessage: "ran out of petrol on an island",
    });
    assert.equal(later.patch.phase, "grounding");
    assert.equal(later.patch.intakeComplete, true);
    assert.equal(later.interpretation.startSet, false);
  });

  it("keeps sets running in desensitization, moves on at SUDs 0-1, honors pause", () => {
    const go = heuristicTurn({ thread: { phase: "desensitization" }, userMessage: "the laughter feels further away, maybe a 4", userTurns: 12 });
    assert.equal(go.interpretation.startSet, true);
    assert.equal(go.patch.suds, 4);
    const done = heuristicTurn({ thread: { phase: "desensitization" }, userMessage: "it's a 1 now", userTurns: 14 });
    assert.equal(done.patch.phase, "installation");
    const pause = heuristicTurn({ thread: { phase: "desensitization" }, userMessage: "pause please", userTurns: 15 });
    assert.equal(pause.interpretation.startSet, false);
  });

  it("routes risk language to grounding with no set", () => {
    const r = heuristicTurn({ thread: { phase: "desensitization" }, userMessage: "I want to hurt myself", userTurns: 10 });
    assert.equal(r.patch.phase, "grounding");
    assert.equal(r.interpretation.riskFlag, true);
    assert.equal(r.interpretation.startSet, false);
  });

  it("records SUDs / VoC baselines only once", () => {
    assert.deepEqual(baselinePatch({}, { suds: 6 }), { baselineSuds: 6 });
    assert.deepEqual(baselinePatch({ baselineSuds: 6 }, { suds: 3 }), {});
    assert.deepEqual(baselinePatch({ baselineSuds: 6 }, { voc: 2 }), { baselineVoc: 2 });
  });
});

describe("guide prompt includes set availability", () => {
  const base = { target: "classroom", suds: 6, voc: undefined, setCount: 0, lastSetOutcome: undefined };

  it("forbids promising the ball when no set starts", () => {
    const block = guideAppStateBlock({ thread: { ...base, phase: "grounding" }, setStartsNow: false });
    assert.match(block, /current app phase: grounding/);
    assert.match(block, /a set can start in this phase: no/);
    assert.match(block, /a set starts right after this reply: NO/);
    assert.match(block, /Never say "follow the ball"/);
    assert.match(block, /what is needed next: a safe place and a stop signal/);
  });

  it("names the missing SUDs in assessment", () => {
    const block = guideAppStateBlock({
      thread: { ...base, suds: undefined, phase: "assessment" },
      setStartsNow: false,
    });
    assert.match(block, /a SUDs rating from 0 to 10/);
  });

  it("tells the guide the set starts automatically when it does", () => {
    const block = guideAppStateBlock({
      thread: { ...base, phase: "desensitization", setCount: 2, lastSetOutcome: "completed" },
      setStartsNow: true,
    });
    assert.match(block, /a set starts right after this reply: YES/);
    assert.match(block, /sets completed: 2; last set: completed/);
    assert.doesNotMatch(block, /Never say/);
  });
});

describe("manual start safety net (no hint banner)", () => {
  const gate = { sessionKind: "guided" as const, sessionMode: "idle" as const };
  it("offers Start set once target and SUDs are known in a chat phase", () => {
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "assessment", target: "x", suds: 6 }), true);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "grounding", target: "x", suds: 0 }), true);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "assessment", target: "x" }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "closure", target: "x", suds: 2 }), false);
    // BLS phases already show the real controls.
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "desensitization", target: "x", suds: 6 }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, sessionMode: "running", phase: "assessment", target: "x", suds: 6 }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, sessionKind: "free", phase: "assessment", target: "x", suds: 6 }), false);
  });

  it("still needs a target and a SUDs rating before the first set, with no explanatory banner", () => {
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "intake" }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "assessment" }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "assessment", suds: 5 }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "assessment", target: "  ", suds: 5 }), false);
    assert.equal(canManualStartGuidedSet({ ...gate, phase: "assessment", target: "x", suds: 5 }), true);
    // The "moving ball comes after..." hint line was removed from the chat.
    assert.equal("guidedSetHint" in sessionMode, false);
  });
});

describe("closure card data", () => {
  it("summarizes a finished target", () => {
    const d = closureCardData({ target: "classroom", baselineSuds: 6, suds: 1, baselineVoc: 2, voc: 7, setCount: 8, incomplete: false });
    assert.equal(d.complete, true);
    assert.equal(d.setsDone, 8);
    assert.equal(changeLabel(d.sudsStart, d.sudsEnd), "6 \u2192 1");
    assert.equal(changeLabel(d.vocStart, d.vocEnd), "2 \u2192 7");
    assert.match(d.nextStep, /about a week/);
    assert.equal(d.ctaLabel, "Start next session");
  });

  it("marks an unfinished target and suggests coming back soon", () => {
    const d = closureCardData({ target: "classroom", baselineSuds: 8, suds: 5, setCount: 3, incomplete: true });
    assert.equal(d.complete, false);
    assert.match(d.nextStep, /within a few days/);
    assert.equal(d.ctaLabel, "Continue in a new session");
  });

  it("handles a session closed before any set", () => {
    const d = closureCardData({ target: undefined, setCount: 0, incomplete: true });
    assert.equal(d.setsDone, 0);
    assert.equal(d.target, null);
    assert.equal(changeLabel(d.sudsStart, d.sudsEnd), null);
    assert.match(d.nextStep, /first set/);
  });
});

describe("closed session stops the goodbye loop", () => {
  it("answers a farewell once, then stays silent", () => {
    const first = closedSessionReply({ phase: "closure", userMessage: "Thanks a lot. Talk soon.", lastAgentMessage: "Rest well." });
    assert.deepEqual(first, { reply: CLOSED_SESSION_LINE, silent: false });
    const second = closedSessionReply({ phase: "closure", userMessage: "Bye!", lastAgentMessage: CLOSED_SESSION_LINE });
    assert.deepEqual(second, { reply: null, silent: true });
  });

  it("lets real content and non-closure phases through", () => {
    assert.equal(closedSessionReply({ phase: "closure", userMessage: "Actually something new came up about my dad", lastAgentMessage: null }), null);
    assert.equal(closedSessionReply({ phase: "desensitization", userMessage: "ok", lastAgentMessage: null }), null);
    assert.equal(isFarewell("\u{1F44B}"), true);
    assert.equal(isFarewell("See you."), true);
  });
});

describe("admin agent health metrics", () => {
  it("flags 30+ message guided threads with no set", () => {
    assert.equal(isStuckThread({ mode: "guided", messageCount: 37, setCount: 0 }), true);
    assert.equal(isStuckThread({ mode: "guided", messageCount: 29, setCount: 0 }), false);
    assert.equal(isStuckThread({ mode: "guided", messageCount: 80, setCount: 2 }), false);
    assert.equal(isStuckThread({ mode: "free", messageCount: 40, setCount: 0 }), false);
  });

  it("computes interpreter failure rate incl. pre-fix 512-cap rows", () => {
    // Production before the fix: 81 interpreter rows, 69 at the 512 cap.
    const h = summarizeInterpreterHealth([
      { purpose: "interpreter", atLegacyCap: false, count: 12 },
      { purpose: "interpreter", atLegacyCap: true, count: 69 },
    ]);
    assert.equal(h.calls, 81);
    assert.equal(h.legacyCapHits, 69);
    assert.equal(Math.round(h.failureRate! * 100), 85);

    const after = summarizeInterpreterHealth([
      { purpose: "interpreter", count: 40 },
      { purpose: "interpreter_cutoff", count: 1 },
      { purpose: "interpreter_unparsed", count: 1 },
      { purpose: "guided_chat", count: 99 },
    ]);
    assert.equal(after.calls, 42);
    assert.equal(after.cutoff, 1);
    assert.equal(after.unparsed, 1);
    assert.equal(summarizeInterpreterHealth([]).failureRate, null);
  });

  it("summarizes sets per guided thread", () => {
    assert.deepEqual(setsPerThreadSummary([{ setCount: 0 }, { setCount: 0 }, { setCount: 8 }]), {
      threads: 3,
      withSets: 1,
      avgSets: 2.7,
    });
  });
});

describe("guardSetEntry", () => {
  it("holds a jump into desensitization without SUDs in assessment", () => {
    const r = guardSetEntry(
      { phase: "grounding", target: "school memory", suds: undefined },
      { phase: "desensitization" }
    );
    assert.equal(r.blocked, true);
    assert.equal(r.patch.phase, "assessment");
  });
  it("holds a jump without a target", () => {
    const r = guardSetEntry({ phase: "assessment", target: undefined, suds: 6 }, { phase: "desensitization" });
    assert.equal(r.blocked, true);
  });
  it("lets target + SUDs (from the same turn) into the first set", () => {
    const r = guardSetEntry(
      { phase: "assessment", target: "school memory", suds: undefined },
      { phase: "desensitization", suds: 6 }
    );
    assert.equal(r.blocked, false);
    assert.equal(r.patch.phase, "desensitization");
  });
  it("never touches moves between set phases", () => {
    const r = guardSetEntry({ phase: "desensitization", target: undefined, suds: undefined }, { phase: "installation" });
    assert.equal(r.blocked, false);
  });
});
