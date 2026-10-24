import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPOSER_STRINGS,
  dictationErrorMessage,
  dictationPlaceholder,
  dictationSpeechLang,
} from "../lib/dictation.ts";
import { startBrowserSpeech } from "../lib/browser-speech.ts";

describe("composer dictation strings (English UI)", () => {
  it("says Start talking until speech is heard, then Listening", () => {
    assert.equal(dictationPlaceholder("off", false), null);
    assert.equal(dictationPlaceholder("starting", false), "Start talking\u2026");
    assert.equal(dictationPlaceholder("listening", false), "Start talking\u2026");
    assert.equal(dictationPlaceholder("listening", true), "Listening\u2026");
  });

  it("keeps the closed and button labels in English", () => {
    assert.equal(COMPOSER_STRINGS.sessionClosed, "This session is closed");
    assert.equal(COMPOSER_STRINGS.stopDictation, "Stop dictation");
    assert.equal(COMPOSER_STRINGS.dictate, "Dictate");
  });

  it("gives a short message for each failure, never voice-mode wording", () => {
    for (const code of ["unsupported", "not-allowed", "network", "other"]) {
      const msg = dictationErrorMessage(code);
      assert.ok(msg.length > 10, code);
      assert.equal(/Resume/.test(msg), false, code);
    }
    assert.match(dictationErrorMessage("not-allowed"), /Microphone access is blocked/);
  });
});

describe("dictation recogniser language", () => {
  it("follows the session language with a region tag", () => {
    assert.equal(dictationSpeechLang("sr", "en-US"), "sr-RS");
    assert.equal(dictationSpeechLang("hr", "en-US"), "hr-HR");
    assert.equal(dictationSpeechLang("de", null), "de-DE");
    assert.equal(dictationSpeechLang("zh-Hant", null), "zh-TW");
    assert.equal(dictationSpeechLang("pt-BR", null), "pt-BR");
  });

  it("uses the browser language before the session language is known", () => {
    assert.equal(dictationSpeechLang(null, "sr-Latn-RS"), "sr-Latn-RS");
    assert.equal(dictationSpeechLang(undefined, ""), "en-US");
  });
});

/** Minimal desktop-like engine. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = true;
  interimResults = false;
  lang = "";
  onresult: ((ev: unknown) => void) | null = null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    queueMicrotask(() => this.onstart?.());
  }
  stop() {}
  abort() {}
}

function installWindow() {
  FakeRecognition.instances = [];
  (globalThis as unknown as { window: unknown }).window = {
    SpeechRecognition: FakeRecognition,
    navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149" },
    matchMedia: () => ({ matches: false }),
  };
}
function removeWindow() {
  delete (globalThis as unknown as { window?: unknown }).window;
}
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("browser speech for dictation", () => {
  it("passes the language to the engine and reports speech start", async () => {
    installWindow();
    try {
      let spoke = 0;
      const statuses: string[] = [];
      const s = startBrowserSpeech(
        { onSpeechStart: () => spoke++, onStatus: (st) => statuses.push(st) },
        { lang: "sr-RS", startTimeoutMs: 1000 }
      );
      assert.ok(s);
      await tick();
      const rec = FakeRecognition.instances[0];
      assert.equal(rec.lang, "sr-RS");
      assert.equal(rec.interimResults, true);
      assert.ok(statuses.includes("listening"));
      rec.onspeechstart?.();
      assert.equal(spoke, 1);
      s!.abort();
    } finally {
      removeWindow();
    }
  });

  it("stops at once on a network error when asked (no silent retries)", async () => {
    installWindow();
    try {
      const errors: string[] = [];
      let ended = 0;
      const s = startBrowserSpeech(
        { onError: (code) => errors.push(code), onEnd: () => ended++ },
        { startTimeoutMs: 1000, networkIsFatal: true }
      );
      await tick();
      FakeRecognition.instances[0].onerror?.({ error: "network" });
      assert.deepEqual(errors, ["network"]);
      assert.equal(ended, 1);
      await new Promise((r) => setTimeout(r, 400));
      assert.equal(FakeRecognition.instances.length, 1, "no restart");
      s!.abort();
    } finally {
      removeWindow();
    }
  });

  it("still retries network errors quietly by default (voice mode)", async () => {
    installWindow();
    try {
      const errors: string[] = [];
      const s = startBrowserSpeech({ onError: (code) => errors.push(code) }, { startTimeoutMs: 1000 });
      await tick();
      FakeRecognition.instances[0].onerror?.({ error: "network" });
      assert.deepEqual(errors, []);
      await new Promise((r) => setTimeout(r, 400));
      assert.ok(FakeRecognition.instances.length >= 2, "restarted");
      s!.abort();
    } finally {
      removeWindow();
    }
  });
});