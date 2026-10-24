import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GLOBAL_GUIDE_RULES } from "../lib/protocol-knowledge.ts";
import { systemPromptForPhase } from "../lib/protocol.ts";
import { interpreterSystemPrompt } from "../lib/session-interpreter.ts";

describe("guide comprehension rules", () => {
  it("connects short fragments to the user's own previous message", () => {
    assert.match(GLOBAL_GUIDE_RULES, /continue the user's OWN previous message/);
    assert.match(GLOBAL_GUIDE_RULES, /"but I can't"/);
  });

  it("tolerates typos", () => {
    assert.match(GLOBAL_GUIDE_RULES, /typos/);
    assert.match(GLOBAL_GUIDE_RULES, /btu i cant/);
  });

  it("checks briefly when a reply is ambiguous instead of assuming", () => {
    assert.match(GLOBAL_GUIDE_RULES, /check briefly/);
    assert.match(GLOBAL_GUIDE_RULES, /instead of assuming/);
  });

  it("explores what blocks a goal before the next intake question", () => {
    assert.match(GLOBAL_GUIDE_RULES, /do not praise it and jump to the next intake item/);
    assert.match(GLOBAL_GUIDE_RULES, /what gets in the way/);
  });

  it("every phase prompt carries the rules, and the interpreter reads fragments the same way", () => {
    for (const phase of ["intake", "grounding", "assessment", "desensitization"] as const) {
      assert.match(systemPromptForPhase(phase, ""), /UNDERSTANDING THE USER/);
    }
    assert.match(interpreterSystemPrompt("intake"), /continue the user's own previous message/);
  });
});
