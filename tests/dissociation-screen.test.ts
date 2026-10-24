import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDissociation,
  dissociationFallbackLine,
  dissociationGuideBlock,
  dissociationPatch,
  screenDissociationTurn,
} from "../lib/dissociation-screen.ts";
import { heuristicTurn } from "../lib/agent-turn.ts";
import {
  EMPTY_INTERPRETATION,
  threadPatchFromInterpretation,
} from "../lib/session-interpreter.ts";
import { canManualStartGuidedSet } from "../lib/session-mode.ts";
import type { Thread } from "../lib/types.ts";

const SCREEN_Q =
  "Do you ever experience moments when things feel unreal or like you are disconnected from yourself?";
const FOLLOW_UP =
  "Thank you for telling me, that is common, especially under stress. When it happens, do you ever lose track of time, or find it hard to come back to the here and now?";

function thread(phase: Thread["phase"], extra: Partial<Thread> = {}): Thread {
  return {
    id: "t1",
    title: "Test",
    mode: "guided",
    phase,
    target: "anxiety",
    incomplete: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

/** One server turn: interpreter output -> screening -> phase patch. */
function turn(
  t: Thread,
  userMessage: string,
  lastAgentMessage: string,
  interp: Partial<typeof EMPTY_INTERPRETATION> = {}
) {
  const screened = screenDissociationTurn({
    thread: t,
    userMessage,
    lastAgentMessage,
    interpretation: { ...EMPTY_INTERPRETATION, ...interp },
  });
  const patch = dissociationPatch(
    t,
    screened.screen,
    threadPatchFromInterpretation(t, screened.interpretation)
  );
  return { ...screened, patch };
}

describe("dissociation screening", () => {
  it("'yes all the time when im stressed' gets a follow-up, not the safe place", () => {
    // What the interpreter did on 2026-10-23: read it as out of window and
    // finished intake, so the session jumped to grounding.
    const r = turn(thread("intake"), "yes all the time when im stressed", SCREEN_Q, {
      outOfWindow: true,
      needsGrounding: true,
      intakeComplete: true,
      suggestedPhase: "grounding",
    });
    assert.equal(r.screen.level, "screening");
    assert.equal(r.patch.dissociation, "screening");
    assert.equal(r.patch.phase, undefined, "stays in intake for the follow-up");
    assert.equal(r.patch.intakeComplete, undefined);
    assert.equal(r.interpretation.outOfWindow, false);
    assert.equal(r.interpretation.startSet, false);
    const block = dissociationGuideBlock(r.screen.level);
    assert.match(block, /acknowledge it warmly/);
    assert.match(block, /ONE gentle follow-up/);
    assert.match(block, /lose track of time|gaps in memory/);
    assert.match(block, /Do NOT move on to the safe place/);
    assert.match(dissociationFallbackLine("screening")!, /lose track of time/);
  });

  it("a severe follow-up answer stops sets and recommends a therapist", () => {
    const t = thread("intake", { dissociation: "screening" });
    const r = turn(t, "yes and I lose time", FOLLOW_UP);
    assert.equal(r.screen.level, "severe");
    assert.equal(r.patch.dissociation, "severe");
    assert.equal(r.patch.phase, "grounding");
    assert.equal(r.interpretation.startSet, false);
    const block = dissociationGuideBlock("severe");
    assert.match(block, /Do NOT start or continue processing sets/);
    assert.match(block, /not the right fit for now/);
    assert.match(block, /trained EMDR therapist/);
    assert.match(dissociationFallbackLine("severe")!, /EMDR therapist/);
  });

  it("severe stays severe: no assessment, no sets, no manual start", () => {
    const t = thread("grounding", { dissociation: "severe", suds: 7 });
    const r = turn(t, "ready", "Take a breath.", { suggestedPhase: "assessment" });
    assert.equal(r.screen.level, "severe");
    assert.notEqual(r.patch.phase, "assessment");
    const fromAssessment = turn(thread("assessment", { dissociation: "severe" }), "7", "How disturbing is it, 0-10?", { suds: 7, startSet: true });
    assert.equal(fromAssessment.patch.phase, "grounding");
    assert.equal(fromAssessment.interpretation.startSet, false);
    assert.equal(
      canManualStartGuidedSet({ sessionKind: "guided", phase: "assessment", sessionMode: "idle", target: "x", suds: 7, dissociation: "severe" }),
      false
    );
    assert.equal(
      canManualStartGuidedSet({ sessionKind: "guided", phase: "assessment", sessionMode: "idle", target: "x", suds: 7, dissociation: "cautious" }),
      true
    );
  });

  it("mild 'sometimes, a little' proceeds with the cautious flag", () => {
    const r = turn(thread("intake"), "sometimes, a little", SCREEN_Q, {
      intakeComplete: true,
      suggestedPhase: "grounding",
    });
    assert.equal(r.screen.level, "cautious");
    assert.equal(r.patch.dissociation, "cautious");
    assert.equal(r.patch.phase, "grounding", "intake goes ahead");
    const block = dissociationGuideBlock("cautious");
    assert.match(block, /safe place and the stop signal are solid/);
    assert.match(block, /Start low/);
    assert.match(block, /short and few/);
    assert.match(block, /here-and-now check/);
  });

  it("after the follow-up, 'no, I can come back' is cautious, not severe", () => {
    const r = turn(thread("intake", { dissociation: "screening" }), "no, I can come back quickly", FOLLOW_UP);
    assert.equal(r.screen.level, "cautious");
  });

  it("'No' to the screening question flags nothing", () => {
    const r = turn(thread("intake"), "No", SCREEN_Q);
    assert.equal(r.screen.level, null);
    assert.equal(r.patch.dissociation, undefined);
  });

  it("dissociation together with self-harm risk is severe and keeps the crisis flag", () => {
    const r = turn(thread("intake"), "yes all the time, and sometimes I want to hurt myself", SCREEN_Q, {
      riskFlag: true,
      riskNotes: "self-harm thoughts",
    });
    assert.equal(r.screen.level, "severe");
    assert.equal(r.interpretation.riskFlag, true);
    assert.equal(r.patch.phase, "grounding");
  });

  it("reads Serbian answers, with or without diacritics", () => {
    const q = "Da li ponekad imate osecaj da je sve nestvarno ili da ste odvojeni od sebe?";
    assert.equal(classifyDissociation({ userMessage: "da, stalno kad sam pod stresom", lastAgentMessage: q }).level, "screening");
    assert.equal(classifyDissociation({ userMessage: "često, kao da nisam u svom telu", lastAgentMessage: q }).level, "screening");
    assert.equal(classifyDissociation({ userMessage: "ponekad, malo", lastAgentMessage: q }).level, "cautious");
    assert.equal(classifyDissociation({ userMessage: "da, i gubim vreme", lastAgentMessage: q }).level, "severe");
    assert.equal(classifyDissociation({ userMessage: "imam rupe u pamćenju", lastAgentMessage: q }).level, "severe");
    assert.equal(classifyDissociation({ userMessage: "ne", lastAgentMessage: q }).level, null);
  });

  it("English phrasings from the screening brief", () => {
    for (const text of ["often", "when stressed I zone out", "I feel like I'm not in my body"]) {
      assert.equal(classifyDissociation({ userMessage: text, lastAgentMessage: SCREEN_Q }).level, "screening", text);
    }
    assert.equal(classifyDissociation({ userMessage: "I lose time", lastAgentMessage: SCREEN_Q }).level, "severe");
  });

  it("feeling unreal right now during processing still grounds first", () => {
    const r = turn(thread("desensitization", { suds: 6 }), "I feel unreal right now", "What do you notice now?");
    assert.equal(r.screen.presentNow, true);
    assert.equal(r.patch.phase, "grounding");
    assert.equal(r.interpretation.outOfWindow, true);
    assert.equal(r.interpretation.startSet, false);
  });

  it("the no-AI fallback treats a screening answer as screening, not a crisis", () => {
    const t = thread("intake");
    const fb = heuristicTurn({ thread: t, userMessage: "yes all the time when im stressed", userTurns: 9 });
    assert.equal(fb.interpretation.riskFlag, false, "dissociation is no longer in the crisis regex");
    const screened = screenDissociationTurn({ thread: t, userMessage: "yes all the time when im stressed", lastAgentMessage: SCREEN_Q, interpretation: fb.interpretation });
    const patch = dissociationPatch(t, screened.screen, fb.patch);
    assert.equal(patch.dissociation, "screening");
    assert.equal(patch.phase, undefined, "the fallback's intake advance waits for the follow-up");
  });

  it("the fallback risk regex reads Serbian crisis words", () => {
    for (const text of ["ne želim da živim", "ne zelim vise da zivim", "nisam bezbedna", "mislim o samoubistvu"]) {
      const r = heuristicTurn({ thread: { phase: "intake" }, userMessage: text, userTurns: 1 });
      assert.equal(r.interpretation.riskFlag, true, text);
    }
  });

  it("levels never go down within a thread", () => {
    const r = turn(thread("grounding", { dissociation: "severe" }), "sometimes, a little", SCREEN_Q);
    assert.equal(r.screen.level, "severe");
    const c = turn(thread("grounding", { dissociation: "cautious" }), "ok", "If you start to feel unreal, tell me.");
    assert.equal(c.screen.level, "cautious");
  });
});
