import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  knowledgeBlockForPhase,
  PROTOCOL_KNOWLEDGE_VERSION,
  PHASE_KNOWLEDGE,
} from "../lib/protocol-knowledge.ts";
import { systemPromptForPhase } from "../lib/protocol.ts";

describe("protocol knowledge", () => {
  it("has a version string", () => {
    assert.match(PROTOCOL_KNOWLEDGE_VERSION, /^\d{4}-\d{2}-\d{2}/);
  });

  it("covers every app phase", () => {
    const phases = Object.keys(PHASE_KNOWLEDGE);
    assert.deepEqual(phases.sort(), [
      "assessment",
      "body_scan",
      "closure",
      "desensitization",
      "grounding",
      "installation",
      "intake",
    ]);
  });

  it("intake block includes history taking and safety language", () => {
    const block = knowledgeBlockForPhase("intake");
    assert.match(block, /HISTORY TAKING|Client History|Phase 1/i);
    assert.match(block, /suicid|crisis|safe/i);
    assert.match(block, /licensed clinician/i);
    assert.doesNotMatch(block, /SUDs 0–10/);
  });

  it("builds a non-empty knowledge block with safety language", () => {
    const block = knowledgeBlockForPhase("desensitization");
    assert.ok(block.length > 400);
    assert.match(block, /licensed clinician/i);
    assert.match(block, /Go with that/);
    assert.match(block, /What do you notice now/);
  });

  it("includes user memory only when provided", () => {
    const without = systemPromptForPhase("grounding", "");
    assert.ok(!without.includes("Account memory"));
    const withMem = systemPromptForPhase("grounding", "- Safe place: beach");
    assert.match(withMem, /Account memory/);
    assert.match(withMem, /beach/);
  });
});
