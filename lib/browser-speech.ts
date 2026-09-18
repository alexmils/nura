/** Browser Web Speech API helpers (Chrome / Edge / Safari).
 * Audio is not uploaded to Nura servers; the browser may still send it to its
 * own speech service (e.g. Google on Chrome).
 *
 * Mobile reality (Chrome for Android, tracked in crbug 41297427):
 * - `continuous` is ignored, so the session ends after every utterance.
 * - `start()` throws `InvalidStateError` on an instance that already ended, so
 *   restarting the same object silently kills listening.
 * - Speech recognition and a second `getUserMedia` capture fight over the mic,
 *   so a visualiser stream steals the audio the recogniser needs.
 *
 * This module therefore creates a fresh instance for every listen cycle,
 * restarts from `onend` after a short delay, and reports when it truly stops so
 * the UI can stop claiming to listen.
 */

export type BrowserSpeechErrorCode =
  | "unsupported"
  | "not-allowed"
  | "no-speech"
  | "aborted"
  | "network"
  | "other";

/** Real state of the microphone engine, not the UI's optimistic guess. */
export type BrowserSpeechStatus = "listening" | "restarting" | "stopped";

export type BrowserSpeechCallbacks = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (code: BrowserSpeechErrorCode, message: string) => void;
  /** Only fires when the engine permanently stops (fatal error or stop()). */
  onEnd?: () => void;
  onStatus?: (status: BrowserSpeechStatus) => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser can run push-to-listen speech recognition. */
export function isBrowserSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/** Delay before restarting a recognition cycle. Android needs a beat after
 * `onend`; a shorter gap throws on slower phones. */
const RESTART_DELAY_MS = 300;

/** Consecutive failed starts before we give up and ask the person to tap. */
export const MAX_SPEECH_START_FAILURES = 5;

/** Backoff for repeated failures. Normal end-of-utterance restarts stay fast. */
export function speechRestartDelayMs(failures: number): number {
  if (failures <= 0) return RESTART_DELAY_MS;
  const delay = RESTART_DELAY_MS * 2 ** (failures - 1);
  return Math.min(delay, 4000);
}

/** Errors that restarting cannot fix. */
export function isFatalSpeechError(code: BrowserSpeechErrorCode): boolean {
  return code === "unsupported" || code === "not-allowed";
}

/**
 * Whether to ask the engine itself for a continuous session.
 *
 * `continuous` is implemented on desktop Chromium and on iOS WebKit, but not on
 * Chrome for Android (crbug 41297427), where the session still ends after every
 * utterance. iOS is the case that matters most: WebKit honours continuous, so
 * forcing it off makes recognition end after each utterance and lean on
 * restarts that iOS then refuses, and listening dies while the UI still says
 * "Listening".
 */
export function speechUsesContinuous(userAgent: string): boolean {
  return !/Android/i.test(userAgent);
}

/** Browser-input wrapper for {@link speechUsesContinuous}. */
export function browserSpeechUsesContinuous(): boolean {
  if (typeof window === "undefined") return false;
  return speechUsesContinuous(window.navigator?.userAgent ?? "");
}

/**
 * Whether holding a second `getUserMedia` capture (the mic visualiser) is safe
 * while speech recognition runs. Desktop Chrome tolerates it; Android and iOS
 * hand the microphone to whoever asked first, which silently blanks the
 * recogniser.
 */
export function speechNeedsExclusiveMic(input: {
  hasSpeech: boolean;
  coarsePointer: boolean;
  userAgent: string;
}): boolean {
  if (!input.hasSpeech) return false;
  if (input.coarsePointer) return true;
  return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(input.userAgent);
}

/** Browser-input wrapper for {@link speechNeedsExclusiveMic}. */
export function browserSpeechNeedsExclusiveMic(): boolean {
  if (typeof window === "undefined") return true;
  return speechNeedsExclusiveMic({
    hasSpeech: isBrowserSpeechSupported(),
    coarsePointer:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
    userAgent: window.navigator?.userAgent ?? "",
  });
}

function mapError(code: string | undefined): BrowserSpeechErrorCode {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "aborted":
      return "aborted";
    case "network":
      return "network";
    default:
      return "other";
  }
}

export type BrowserSpeechSession = {
  stop: () => void;
  abort: () => void;
};

/**
 * Start recognition and keep it running until the caller stops it.
 * On mobile this is one instance per utterance under the hood; on desktop a
 * single continuous instance that is recreated if Chrome ever ends it.
 */
export function startBrowserSpeech(
  callbacks: BrowserSpeechCallbacks,
  options?: { lang?: string }
): BrowserSpeechSession | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    callbacks.onError?.(
      "unsupported",
      "Voice isn’t supported in this browser. Try Chrome or Edge."
    );
    return null;
  }

  const lang = options?.lang ?? "en-US";
  const Recognition: SpeechRecognitionCtor = Ctor;
  const wantContinuous = browserSpeechUsesContinuous();

  let active = true;
  let current: SpeechRecognitionLike | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let startFailures = 0;
  let pendingInterim = "";

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  /** Keep words the engine heard but never marked final before it died. */
  const flushInterim = () => {
    const text = pendingInterim.trim();
    pendingInterim = "";
    if (text) callbacks.onFinal?.(text);
  };

  const release = (rec: SpeechRecognitionLike | null) => {
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
  };

  const finishFatal = (
    code: BrowserSpeechErrorCode,
    message: string
  ) => {
    active = false;
    clearRestart();
    const rec = current;
    current = null;
    release(rec);
    callbacks.onStatus?.("stopped");
    callbacks.onError?.(code, message);
    callbacks.onEnd?.();
  };

  const scheduleRestart = (failures: number) => {
    if (!active || restartTimer) return;
    callbacks.onStatus?.("restarting");
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (active) spawn();
    }, speechRestartDelayMs(failures));
  };

  function spawn() {
    if (!active) return;
    const rec = new Recognition();
    current = rec;
    rec.continuous = wantContinuous;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event) => {
      startFailures = 0;
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (finalChunk) {
        pendingInterim = "";
        callbacks.onFinal?.(finalChunk);
      }
      if (interim) {
        pendingInterim = interim;
        callbacks.onInterim?.(interim);
      }
    };

    rec.onerror = (event) => {
      const code = mapError(event.error);
      // Our own stop, or a natural pause. `onend` handles the restart.
      if (code === "aborted" || code === "no-speech") return;

      if (isFatalSpeechError(code)) {
        finishFatal(
          code,
          code === "not-allowed"
            ? "Microphone access was blocked. Allow the mic to use Voice."
            : event.message || "Voice stopped."
        );
        return;
      }

      // Transient: network hiccups, engine errors.
      startFailures += 1;
      if (startFailures > MAX_SPEECH_START_FAILURES) {
        finishFatal(
          code,
          event.message || "The microphone kept stopping."
        );
        return;
      }
      flushInterim();
      if (current === rec) {
        current = null;
        release(rec);
      }
      scheduleRestart(startFailures);
    };

    rec.onend = () => {
      if (!active) return;
      if (current === rec) current = null;
      flushInterim();
      scheduleRestart(0);
    };

    try {
      rec.start();
      callbacks.onStatus?.("listening");
    } catch {
      // start() throws if called too soon after the previous instance ended.
      startFailures += 1;
      if (startFailures > MAX_SPEECH_START_FAILURES) {
        finishFatal("other", "The microphone kept stopping.");
        return;
      }
      if (current === rec) current = null;
      scheduleRestart(startFailures);
    }
  }

  const shutdown = (emitEnd: boolean, flush: boolean) => {
    if (!active) return;
    active = false;
    clearRestart();
    const rec = current;
    current = null;
    if (flush) flushInterim();
    release(rec);
    if (emitEnd) callbacks.onEnd?.();
  };

  spawn();

  return {
    stop: () => shutdown(true, true),
    abort: () => shutdown(false, false),
  };
}
