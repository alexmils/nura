import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectSessionLanguage,
  explicitLanguageRequest,
  isClarificationRequest,
  languageInstruction,
  resolveTurnLanguage,
  turnLanguageBlock,
} from "../lib/session-languages.ts";
import { systemPromptForPhase } from "../lib/protocol.ts";
import { GLOBAL_GUIDE_RULES } from "../lib/protocol-knowledge.ts";

/** Replays a conversation turn by turn, the way app/api/chat/route.ts does. */
function replay(messages: string[], start: string | null = null) {
  let pinned = start;
  const turns = messages.map((userMessage) => {
    const turn = resolveTurnLanguage({ current: pinned, userMessage });
    if (turn.pin) pinned = turn.code;
    return turn;
  });
  return { pinned, turns };
}

describe("per-turn reply language", () => {
  it("keeps an English conversation in English on \"Don't understand this question?\"", () => {
    const { turns, pinned } = replay([
      "I'd like to work on anxiety.",
      "when i was 15",
      "Struggle :(",
      "I just sleep",
      "Yes my friend Mike",
      "Don't understand this question?",
    ]);
    const last = turns[turns.length - 1]!;
    assert.equal(last.code, "en");
    assert.equal(last.clarification, true);
    assert.equal(pinned, "en");
    const block = turnLanguageBlock(last);
    assert.match(block, /Reply language for this turn: English/);
    assert.match(block, /simpler/);
    assert.match(block, /Do not switch language/);
  });

  it("treats confusion as an unclear question, in any language", () => {
    for (const text of [
      "Don't understand this question?",
      "I don't get it",
      "what do you mean?",
      "Sorry, I dont understand",
      "ne razumem pitanje",
      "Nije mi jasno",
    ]) {
      assert.equal(isClarificationRequest(text), true, text);
    }
    for (const text of ["No", "first time", "I understand now, thanks", "maybe when I'm in my bedroom"]) {
      assert.equal(isClarificationRequest(text), false, text);
    }
  });

  it("\"ne razumem pitanje\" in an English session rephrases in English", () => {
    const turn = resolveTurnLanguage({ current: "en", userMessage: "ne razumem pitanje" });
    assert.equal(turn.code, "en");
    assert.equal(turn.clarification, true);
    assert.equal(turn.changed, false);
  });

  it("answers a first \"Hi\" in English", () => {
    const turn = resolveTurnLanguage({ current: null, userMessage: "Hi" });
    assert.equal(turn.code, "en");
    assert.equal(turn.pin, true);
    const prompt = systemPromptForPhase("intake", "", "", turn.code);
    assert.match(prompt, /Reply only in English/);
  });

  it("an unrecognizable first message defaults to English, without pinning", () => {
    const turn = resolveTurnLanguage({ current: null, userMessage: "ok" });
    assert.equal(turn.code, "en");
    assert.equal(turn.pin, false);
    assert.equal(turn.reason, "default");
  });

  it("Serbian history or memory never overrides English messages", () => {
    // A user who wrote Serbian before (memory, profile, earlier sessions in
    // Serbian) starts a new session and writes English.
    const serbianMemory = "- Osecaj nedovoljnosti: svakodnevno, posle raskida.";
    const { turns, pinned } = replay(["Hi", "I'd like to work on stress.", "No", "first time"]);
    assert.ok(turns.every((t) => t.code === "en"));
    assert.equal(pinned, "en");
    const prompt = systemPromptForPhase("intake", serbianMemory, "- presenting problem: osecaj nedovoljnosti", "en");
    assert.match(prompt, /Reply only in English/);
    assert.match(prompt, /Saved memories, the client profile, earlier sessions/);
    // An English session pinned earlier stays English on short replies.
    assert.equal(resolveTurnLanguage({ current: "en", userMessage: "Hi" }).code, "en");
  });

  it("an English session stays English across a Grounding -> Assessment change", () => {
    const { turns } = replay([
      "I'd like to work on anxiety.",
      "yes all the time when im stressed",
      "maybe when I'm in my bedroom",
      "ready",
    ]);
    assert.ok(turns.every((t) => t.code === "en"));
    for (const phase of ["grounding", "assessment"] as const) {
      const prompt = systemPromptForPhase(phase, "", "", "en");
      assert.match(prompt, /Language for this session/);
      assert.match(prompt, /Reply only in English/);
    }
  });

  it("still detects diacritic-less Serbian", () => {
    assert.equal(detectSessionLanguage("osecaj nedovoljnosti")?.code, "sr");
    const turn = resolveTurnLanguage({ current: null, userMessage: "osecaj nedovoljnosti" });
    assert.equal(turn.code, "sr");
    assert.equal(turn.pin, true);
  });

  it("switches when the user clearly writes in another language", () => {
    const turn = resolveTurnLanguage({
      current: "en",
      userMessage: "Danas osecam mnogo stresa i zelim da radim na tome.",
    });
    assert.equal(turn.code, "sr");
    assert.equal(turn.changed, true);
  });

  it("switches on an explicit request", () => {
    for (const [text, code] of [
      ["može na srpskom", "sr"],
      ["moze na srpskom?", "sr"],
      ["can we talk in Serbian", "sr"],
      ["English please", "en"],
      ["mozemo na engleskom", "en"],
    ] as const) {
      assert.equal(explicitLanguageRequest(text), code, text);
    }
    const toSr = resolveTurnLanguage({ current: "en", userMessage: "može na srpskom" });
    assert.equal(toSr.code, "sr");
    assert.equal(toSr.changed, true);
    assert.equal(toSr.reason, "explicit-request");
    const toEn = resolveTurnLanguage({ current: "sr", userMessage: "English please" });
    assert.equal(toEn.code, "en");
    assert.equal(toEn.changed, true);
    // A language name in an ordinary sentence is not a request.
    assert.equal(explicitLanguageRequest("my mother is Serbian and my dad is not"), null);
  });

  it("short replies keep a Serbian session Serbian", () => {
    assert.equal(resolveTurnLanguage({ current: "sr", userMessage: "ok" }).code, "sr");
    assert.equal(resolveTurnLanguage({ current: "sr", userMessage: "ne razumem" }).code, "sr");
  });

  it("an explicit user preference is only a weak default before any text", () => {
    const turn = resolveTurnLanguage({ current: null, userMessage: "ok", preferred: "sr" });
    assert.equal(turn.code, "sr");
    assert.equal(turn.pin, false);
    // ...and never beats what the user writes.
    assert.equal(resolveTurnLanguage({ current: null, userMessage: "Hi", preferred: "sr" }).code, "en");
  });

  it("global rules no longer single out Serbian and explain confusion", () => {
    assert.doesNotMatch(GLOBAL_GUIDE_RULES, /If they write Serbian, reply in Serbian/);
    assert.match(GLOBAL_GUIDE_RULES, /QUESTION was unclear, not the language/);
    assert.match(GLOBAL_GUIDE_RULES, /Never repeat your previous message/);
    assert.match(languageInstruction("sr"), /still in Serbian/);
  });
});
