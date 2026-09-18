import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMemoryContext,
  MEMORY_CONTEXT_MAX_CHARS,
} from "../lib/memory-context";
import {
  parseImportText,
  pickConversationsJsonFromZip,
} from "../lib/memory-import";

describe("formatMemoryContext", () => {
  it("joins lines under the cap", () => {
    const out = formatMemoryContext(["[A]", "- t: b"], 100);
    assert.equal(out, "[A]\n- t: b");
  });

  it("caps without exceeding maxChars", () => {
    const long = "x".repeat(500);
    const out = formatMemoryContext([`[Set]`, `- title: ${long}`], 80);
    assert.ok(out.length <= 80);
    assert.ok(out.endsWith("…") || out.length < 80);
  });

  it("uses default max", () => {
    assert.equal(MEMORY_CONTEXT_MAX_CHARS, 3000);
  });
});

describe("parseImportText", () => {
  it("parses Claude conversations.json", () => {
    const raw = JSON.stringify([
      {
        uuid: "c1",
        name: "Safe place practice",
        chat_messages: [
          { sender: "human", text: "I want to practice my safe place." },
          { sender: "assistant", text: "Sure." },
          { sender: "human", text: "The beach feels calm." },
        ],
      },
    ]);
    const result = parseImportText("conversations.json", raw);
    assert.equal(result.source, "claude");
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].title, "Safe place practice");
    assert.match(result.candidates[0].body, /safe place/);
    assert.match(result.candidates[0].body, /beach/);
    assert.doesNotMatch(result.candidates[0].body, /Sure/);
  });

  it("parses ChatGPT mapping export", () => {
    const root = "root";
    const u1 = "u1";
    const a1 = "a1";
    const u2 = "u2";
    const raw = JSON.stringify([
      {
        title: "Target memory",
        conversation_id: "cg1",
        current_node: u2,
        mapping: {
          [root]: {
            id: root,
            parent: null,
            children: [u1],
            message: { author: { role: "system" }, content: { parts: [] } },
          },
          [u1]: {
            id: u1,
            parent: root,
            children: [a1],
            message: {
              author: { role: "user" },
              content: { parts: ["The worst part is the hallway."] },
            },
          },
          [a1]: {
            id: a1,
            parent: u1,
            children: [u2],
            message: {
              author: { role: "assistant" },
              content: { parts: ["Tell me more."] },
            },
          },
          [u2]: {
            id: u2,
            parent: a1,
            children: [],
            message: {
              author: { role: "user" },
              content: { parts: ["My chest tightens."] },
            },
          },
        },
      },
    ]);
    const result = parseImportText("conversations.json", raw);
    assert.equal(result.source, "chatgpt");
    assert.equal(result.candidates[0].title, "Target memory");
    assert.match(result.candidates[0].body, /hallway/);
    assert.match(result.candidates[0].body, /chest/);
    assert.doesNotMatch(result.candidates[0].body, /Tell me more/);
  });

  it("parses Nura notes JSON", () => {
    const raw = JSON.stringify({
      notes: [{ title: "NC", body: "I am not safe." }],
    });
    const result = parseImportText("notes.json", raw);
    assert.equal(result.source, "nura");
    assert.equal(result.candidates[0].title, "NC");
  });

  it("parses plain text", () => {
    const result = parseImportText(
      "note.txt",
      "Beach image\nWaves and warm sand."
    );
    assert.equal(result.source, "plain");
    assert.equal(result.candidates[0].title, "Beach image");
    assert.match(result.candidates[0].body, /Waves/);
  });

  it("rejects garbage JSON", () => {
    assert.throws(() => parseImportText("x.json", '{"foo":1}'), /recognize/i);
  });
});

describe("pickConversationsJsonFromZip", () => {
  it("picks conversations.json from virtual zip map", () => {
    const claude = new TextEncoder().encode(
      JSON.stringify([
        {
          uuid: "1",
          name: "A",
          chat_messages: [{ sender: "human", text: "hi" }],
        },
      ])
    );
    const picked = pickConversationsJsonFromZip({
      "export/conversations.json": claude,
      "users.json": new TextEncoder().encode("{}"),
    });
    assert.ok(picked);
    assert.match(picked!.fileName, /conversations\.json$/i);
  });
});
