import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  isBrowserSpeechSupported,
  isFatalSpeechError,
  MAX_SPEECH_START_FAILURES,
  speechNeedsExclusiveMic,
  speechRestartDelayMs,
  startBrowserSpeech,
  type BrowserSpeechCallbacks,
} from "../lib/browser-speech.ts";

describe("browser-speech", () => {
  it("reports unsupported without a browser SpeechRecognition API", () => {
    assert.equal(isBrowserSpeechSupported(), false);
  });

  it("gives the engine a beat before a normal restart", () => {
    assert.equal(speechRestartDelayMs(0), 300);
    assert.equal(speechRestartDelayMs(1), 300);
    assert.ok(speechRestartDelayMs(2) > speechRestartDelayMs(1));
    assert.ok(speechRestartDelayMs(3) >= speechRestartDelayMs(2));
  });

  it("caps the backoff so a dead mic is not hammered", () => {
    assert.equal(speechRestartDelayMs(99), 4000);
    assert.ok(MAX_SPEECH_START_FAILURES >= 3);
  });

  it("treats permission and support errors as fatal", () => {
    assert.equal(isFatalSpeechError("not-allowed"), true);
    assert.equal(isFatalSpeechError("unsupported"), true);
    assert.equal(isFatalSpeechError("no-speech"), false);
    assert.equal(isFatalSpeechError("network"), false);
    assert.equal(isFatalSpeechError("aborted"), false);
    assert.equal(isFatalSpeechError("other"), false);
  });

  it("keeps the mic exclusive on phones but shareable on desktop", () => {
    assert.equal(
      speechNeedsExclusiveMic({
        hasSpeech: true,
        coarsePointer: false,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/149 Mobile Safari/537.36",
      }),
      true
    );
    assert.equal(
      speechNeedsExclusiveMic({
        hasSpeech: true,
        coarsePointer: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149",
      }),
      true
    );
    assert.equal(
      speechNeedsExclusiveMic({
        hasSpeech: true,
        coarsePointer: false,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/149",
      }),
      false
    );
    assert.equal(
      speechNeedsExclusiveMic({
        hasSpeech: false,
        coarsePointer: true,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
      }),
      false
    );
  });
});

/** Chrome for Android ends after every utterance and throws if you reuse the
 * instance, which is what used to kill listening while the UI still said
 * "Listening…". */
class AndroidLikeRecognition {
  static instances: AndroidLikeRecognition[] = [];
  static failStart = false;

  continuous = true;
  interimResults = false;
  lang = "";
  onresult: ((ev: unknown) => void) | null = null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  ended = false;

  constructor() {
    AndroidLikeRecognition.instances.push(this);
  }

  start() {
    if (AndroidLikeRecognition.failStart) {
      throw new Error("InvalidStateError: recognition already started");
    }
    if (this.ended) throw new Error("InvalidStateError: recognition has ended");
  }

  stop() {
    this.ended = true;
  }

  abort() {
    this.ended = true;
  }

  emitFinal(text: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: text } }],
    });
  }

  emitInterim(text: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: text } }],
    });
  }

  emitEnd() {
    this.ended = true;
    const end = this.onend;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    end?.();
  }

  emitError(error: string, message?: string) {
    this.onerror?.({ error, message });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function installAndroidWindow() {
  AndroidLikeRecognition.instances = [];
  AndroidLikeRecognition.failStart = false;
  (globalThis as unknown as { window: unknown }).window = {
    SpeechRecognition: AndroidLikeRecognition,
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" },
    matchMedia: () => ({ matches: true }),
  };
}

function removeWindow() {
  delete (globalThis as unknown as { window?: unknown }).window;
}

describe("browser-speech continuous listening", () => {
  it("keeps hearing after the engine ends each utterance", async () => {
    installAndroidWindow();
    const finals: string[] = [];
    const statuses: string[] = [];
    const callbacks: BrowserSpeechCallbacks = {
      onFinal: (t) => finals.push(t),
      onStatus: (s) => statuses.push(s),
    };
    const session = startBrowserSpeech(callbacks);
    assert.ok(session, "expected a session");

    try {
      assert.equal(AndroidLikeRecognition.instances.length, 1);
      const first = AndroidLikeRecognition.instances[0];
      assert.equal(
        first.continuous,
        false,
        "mobile must not rely on continuous"
      );

      first.emitFinal("I feel tense");
      first.emitEnd();

      await sleep(600);
      assert.equal(
        AndroidLikeRecognition.instances.length,
        2,
        "a fresh instance must take over after onend"
      );

      AndroidLikeRecognition.instances[1].emitFinal("in my shoulders");
      assert.deepEqual(finals, ["I feel tense", "in my shoulders"]);
      assert.ok(statuses.includes("listening"));
    } finally {
      session?.abort();
      removeWindow();
    }
  });

  it("flushes words heard only as interim before the engine died", () => {
    installAndroidWindow();
    const finals: string[] = [];
    const session = startBrowserSpeech({ onFinal: (t) => finals.push(t) });
    assert.ok(session);

    try {
      AndroidLikeRecognition.instances[0].emitInterim("half a thought");
      AndroidLikeRecognition.instances[0].emitEnd();

      assert.deepEqual(finals, ["half a thought"]);
    } finally {
      session?.abort();
      removeWindow();
    }
  });

  it("stops and reports instead of pretending to listen after a blocked mic", async () => {
    installAndroidWindow();
    const errors: string[] = [];
    const statuses: string[] = [];
    let ended = 0;
    const session = startBrowserSpeech({
      onError: (code) => errors.push(code),
      onStatus: (s) => statuses.push(s),
      onEnd: () => {
        ended += 1;
      },
    });
    assert.ok(session);

    try {
      AndroidLikeRecognition.instances[0].emitError("not-allowed");
      await sleep(600);
      assert.deepEqual(errors, ["not-allowed"]);
      assert.equal(statuses.at(-1), "stopped");
      assert.equal(ended, 1);
      assert.equal(
        AndroidLikeRecognition.instances.length,
        1,
        "a blocked mic must not be retried"
      );
    } finally {
      session?.abort();
      removeWindow();
    }
  });

  it("gives up after repeated start failures instead of spinning", () => {
    installAndroidWindow();
    AndroidLikeRecognition.failStart = true;
    mock.timers.enable({ apis: ["setTimeout"] });
    const errors: string[] = [];
    const session = startBrowserSpeech({ onError: (code) => errors.push(code) });
    assert.ok(session);

    try {
      // Node's tick() does not run timers scheduled during the same tick, so
      // advance the clock a few times to let the backoff chain play out.
      for (let i = 0; i < 10; i++) mock.timers.tick(5000);
      assert.deepEqual(errors, ["other"]);
    } finally {
      session?.abort();
      mock.timers.reset();
      removeWindow();
    }
  });
});
