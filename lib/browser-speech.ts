/** Browser Web Speech API helpers (Chrome / Edge / Safari).
 * Audio is not uploaded to Nura servers; the browser may still send it to its
 * own speech service (e.g. Google on Chrome).
 */

export type BrowserSpeechErrorCode =
  | "unsupported"
  | "not-allowed"
  | "no-speech"
  | "aborted"
  | "network"
  | "other";

export type BrowserSpeechCallbacks = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (code: BrowserSpeechErrorCode, message: string) => void;
  onEnd?: () => void;
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
 * Start continuous recognition with interim results.
 * Callers should stop() after a final turn (or use silence heuristics).
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

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options?.lang ?? "en-US";

  let stopped = false;

  recognition.onresult = (event) => {
    let interim = "";
    let finalChunk = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const piece = result[0]?.transcript ?? "";
      if (result.isFinal) finalChunk += piece;
      else interim += piece;
    }
    if (finalChunk) callbacks.onFinal?.(finalChunk);
    if (interim) callbacks.onInterim?.(interim);
  };

  recognition.onerror = (event) => {
    const code = mapError(event.error);
    if (code === "aborted" || code === "no-speech") return;
    callbacks.onError?.(
      code,
      code === "not-allowed"
        ? "Microphone access was blocked. Allow the mic to use Voice."
        : event.message || "Could not hear you. Try again."
    );
  };

  recognition.onend = () => {
    if (!stopped) {
      // Chrome ends recognition periodically; restart while session is active.
      try {
        recognition.start();
      } catch {
        callbacks.onEnd?.();
      }
      return;
    }
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    callbacks.onError?.("other", "Could not start the microphone.");
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      stopped = true;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
