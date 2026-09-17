import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPOSER_PLACEHOLDERS,
  COMPOSER_PLACEHOLDERS_EN,
  composerPlaceholder,
  composerPlaceholderKind,
} from "../lib/session-placeholders.ts";
import { SESSION_LANGUAGES } from "../lib/session-languages.ts";

describe("composer placeholders", () => {
  it("covers every language in the pack", () => {
    const missing = SESSION_LANGUAGES.filter(
      (lang) => !COMPOSER_PLACEHOLDERS[lang.code]
    ).map((lang) => lang.code);
    assert.deepEqual(missing, [], `missing placeholders for ${missing}`);
  });

  it("has a complete, non-empty entry per language", () => {
    for (const [code, entry] of Object.entries(COMPOSER_PLACEHOLDERS)) {
      for (const [key, value] of Object.entries(entry)) {
        assert.equal(typeof value, "string", `${code}.${key}`);
        assert.ok(value.trim().length > 2, `${code}.${key} too short`);
        // Em dash reads as AI-written (nura-brand).
        assert.equal(value.includes("\u2014"), false, `${code}.${key}`);
      }
    }
  });

  it("keeps the English entry identical to the shipped copy", () => {
    assert.deepEqual(COMPOSER_PLACEHOLDERS.en, COMPOSER_PLACEHOLDERS_EN);
    assert.equal(COMPOSER_PLACEHOLDERS_EN.message, "Message the guide…");
    assert.equal(COMPOSER_PLACEHOLDERS_EN.typeHere, "Type here…");
  });

  it("maps composer states to placeholder kinds", () => {
    assert.equal(
      composerPlaceholderKind({ phase: "intake", checkIn: false }),
      "typeHere"
    );
    assert.equal(
      composerPlaceholderKind({ phase: "desensitization", checkIn: false }),
      "message"
    );
    assert.equal(
      composerPlaceholderKind({ phase: "desensitization", checkIn: true }),
      "rating"
    );
    assert.equal(
      composerPlaceholderKind({ phase: "installation", checkIn: true }),
      "howTrue"
    );
    assert.equal(
      composerPlaceholderKind({ phase: "body_scan", checkIn: true }),
      "bodyScan"
    );
    assert.equal(
      composerPlaceholderKind({ phase: "grounding", checkIn: true }),
      "notice"
    );
    assert.equal(
      composerPlaceholderKind({
        phase: "desensitization",
        checkIn: true,
        setStopped: true,
      }),
      "setStopped"
    );
  });

  it("writes the hint in the session language", () => {
    const sr = composerPlaceholder({
      phase: "desensitization",
      checkIn: false,
      language: "sr",
    });
    assert.equal(sr, COMPOSER_PLACEHOLDERS.sr.message);
    assert.notEqual(sr, COMPOSER_PLACEHOLDERS_EN.message);

    const ja = composerPlaceholder({
      phase: "body_scan",
      checkIn: true,
      language: "ja",
    });
    assert.equal(ja, COMPOSER_PLACEHOLDERS.ja.bodyScan);
  });

  it("falls back to English until the language is known", () => {
    for (const language of [null, undefined, "", "xx", "nope"]) {
      assert.equal(
        composerPlaceholder({
          phase: "desensitization",
          checkIn: false,
          language,
        }),
        COMPOSER_PLACEHOLDERS_EN.message
      );
      assert.equal(
        composerPlaceholder({ phase: "intake", checkIn: false, language }),
        COMPOSER_PLACEHOLDERS_EN.typeHere
      );
    }
  });

  it("keeps the scale names the app and the guide share", () => {
    const rating = composerPlaceholder({
      phase: "desensitization",
      checkIn: true,
      language: "sr",
    });
    assert.match(rating, /SUDs 0–10/);
    assert.match(rating, /^Šta sada/);

    const howTrue = composerPlaceholder({
      phase: "installation",
      checkIn: true,
      language: "de",
    });
    assert.match(howTrue, /VoC 0–7/);
    assert.match(howTrue, /^Wie wahr/);
  });

  it("uses the stopped-set hint when a set was stopped", () => {
    const sr = composerPlaceholder({
      phase: "desensitization",
      checkIn: true,
      language: "sr",
      setStopped: true,
    });
    assert.equal(sr, COMPOSER_PLACEHOLDERS.sr.setStopped);
    assert.doesNotMatch(sr, /SUDs/);
  });
});
