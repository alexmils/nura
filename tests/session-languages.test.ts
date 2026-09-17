import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENGLISH_WELCOME,
  SESSION_LANGUAGES,
  detectSessionLanguage,
  isWelcomeOpening,
  languageInstruction,
  welcomeLineFor,
} from "../lib/session-languages.ts";
import { openingLine, systemPromptForPhase } from "../lib/protocol.ts";

describe("session languages", () => {
  it("has a large, well-formed pack", () => {
    assert.ok(SESSION_LANGUAGES.length >= 40);
    const codes = new Set<string>();
    for (const lang of SESSION_LANGUAGES) {
      assert.ok(lang.code.length >= 2, `${lang.code} code`);
      assert.ok(lang.name.length > 2, `${lang.code} name`);
      assert.ok(lang.native.length > 1, `${lang.code} native`);
      assert.ok(lang.welcome.trim().length > 10, `${lang.code} welcome`);
      assert.equal(codes.has(lang.code), false, `duplicate ${lang.code}`);
      codes.add(lang.code);
    }
  });

  it("keeps every welcome line brand-safe", () => {
    for (const lang of SESSION_LANGUAGES) {
      // No em dash (reads as AI-written), no internal BLS jargon.
      assert.equal(lang.welcome.includes("\u2014"), false, lang.code);
      assert.equal(/\bBLS\b/i.test(lang.welcome), false, lang.code);
      assert.equal(lang.welcome.includes("NuraHelp"), false, lang.code);
    }
  });

  it("includes the requested majors", () => {
    const codes = SESSION_LANGUAGES.map((l) => l.code);
    for (const code of ["en", "sr", "zh", "ja", "ru", "es", "ar", "hi", "ko"]) {
      assert.ok(codes.includes(code), `missing ${code}`);
    }
  });

  it("detects the language of the first message", () => {
    const cases: [string, string][] = [
      ["I feel anxious about work and I want to talk about it.", "en"],
      ["Hola, hoy quiero trabajar en mi ansiedad.", "es"],
      ["Olá, hoje quero trabalhar na minha ansiedade.", "pt"],
      ["Bonjour, aujourd'hui je voudrais travailler sur mon anxiété.", "fr"],
      ["Hallo, ich möchte heute an meiner Angst arbeiten.", "de"],
      ["Danas osećam mnogo stresa i želim da radim na tome.", "sr"],
      ["Danas osjećam mnogo stresa i želim raditi na tome.", "hr"],
      [
        "Danas me muči stres, želim da radim na tome šta me brine uopšte.",
        "sr",
      ],
      // Diacritics dropped (phones) — the case that used to fall back to English.
      ["osecaj nedovoljnosti", "sr"],
      ["u svakodnevnom zivotu :(", "sr"],
      ["Danas osecam mnogo stresa na poslu i zelim da radim na tome.", "sr"],
      ["не могу више, стално се осећам лоше", "sr"],
      ["Не могу да спавам и желим да причам о томе како се осећам.", "sr"],
      ["Привет, я хочу поработать над тревогой сегодня.", "ru"],
      ["Вітаю, я хочу попрацювати над тривогою сьогодні.", "uk"],
      ["Dzisiaj nie chcę pracować, czuję lęk i jestem zmęczony.", "pl"],
      ["Bugün kaygı üzerinde çalışmak istiyorum, bana yardım et.", "tr"],
      ["Καλώς ήρθατε, θα ήθελα να δουλέψω σε αυτό σήμερα.", "el"],
      ["שלום, אני רוצה לעבוד על החרדה שלי היום.", "he"],
      ["مرحبًا، أريد أن أعمل على قلقي اليوم.", "ar"],
      ["خوش آمدید، امروز می‌خواهم روی اضطرابم کار کنم.", "fa"],
      ["خوش آمدید، آج میں اپنی بے چینی پر کام کرنا چاہتا ہوں۔", "ur"],
      ["नमस्ते, आज मैं अपनी चिंता पर काम करना चाहता हूँ।", "hi"],
      ["আজ আমি আমার দুশ্চিন্তা নিয়ে কাজ করতে চাই।", "bn"],
      ["இன்று என் கவலை பற்றி வேலை செய்ய விரும்புகிறேன்.", "ta"],
      ["วันนี้อยากทำงานเรื่องความกังวลของฉัน", "th"],
      ["你好，今天我想处理一些焦虑。", "zh"],
      ["你好，今天我想處理一些焦慮。", "zh-Hant"],
      ["こんにちは、今日は不安について取り組みたいです。", "ja"],
      ["안녕하세요, 오늘 불안에 대해 다루고 싶어요.", "ko"],
      ["Chào mừng, hôm nay tôi muốn làm việc với lo âu của mình.", "vi"],
      ["Selamat datang, saya ingin bekerja pada kecemasan saya.", "id"],
    ];
    for (const [text, expected] of cases) {
      assert.equal(
        detectSessionLanguage(text)?.code,
        expected,
        `expected ${expected} for: ${text}`
      );
    }
  });

  it("stays undecided when the text is too short or ambiguous", () => {
    assert.equal(detectSessionLanguage(""), null);
    assert.equal(detectSessionLanguage("a"), null);
    assert.equal(detectSessionLanguage("ok"), null);
    assert.equal(detectSessionLanguage("1234 5678"), null);
    // One ordinary short word is not enough...
    assert.equal(detectSessionLanguage("hoy"), null);
    // ...but a distinctive word pins the language.
    assert.equal(detectSessionLanguage("anxiety")?.code, "en");
    assert.equal(detectSessionLanguage("osecaj")?.code, "sr");
  });

  it("resolves welcome lines and instructions", () => {
    assert.equal(welcomeLineFor("sr").startsWith("Dobro došli"), true);
    assert.equal(welcomeLineFor("nope"), ENGLISH_WELCOME);
    assert.equal(welcomeLineFor(undefined), ENGLISH_WELCOME);
    assert.match(languageInstruction("sr"), /Serbian/);
    assert.equal(languageInstruction("en"), "");
    assert.equal(languageInstruction(null), "");
  });

  it("recognizes the opening line in any language", () => {
    assert.equal(isWelcomeOpening(ENGLISH_WELCOME), true);
    assert.equal(isWelcomeOpening(`  ${ENGLISH_WELCOME}  `), true);
    assert.equal(isWelcomeOpening(welcomeLineFor("ja")), true);
    assert.equal(isWelcomeOpening("What do you notice now?"), false);
    assert.equal(isWelcomeOpening(""), false);
  });

  it("keeps the protocol opener in sync with the pack", () => {
    assert.equal(openingLine("intake"), ENGLISH_WELCOME);
    assert.equal(isWelcomeOpening(openingLine("intake")), true);
  });

  it("pins the reply language in the system prompt", () => {
    const pinned = systemPromptForPhase("intake", "", "", "sr");
    assert.match(pinned, /Language for this session/);
    assert.match(pinned, /Serbian/);
    const english = systemPromptForPhase("intake", "");
    assert.doesNotMatch(english, /Language for this session/);
  });
});
