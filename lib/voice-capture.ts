/**
 * Pure helpers for voice capture: which speech engine to use, which
 * MediaRecorder container to ask for, and a tiny voice-activity detector.
 * No DOM access here so it can be unit tested.
 */

export type VoiceEngine = "browser" | "server" | "none";

export type VoiceCapabilities = {
  /** window.SpeechRecognition / webkitSpeechRecognition exists. */
  hasSpeechRecognition: boolean;
  /** MediaRecorder + navigator.mediaDevices.getUserMedia exist. */
  hasMediaRecorder: boolean;
  /** The server can transcribe audio (STT key configured). */
  serverStt: boolean;
  userAgent: string;
  /** navigator.maxTouchPoints, to spot iPadOS that reports "Macintosh". */
  maxTouchPoints?: number;
};

/** iPhone, iPod, iPad, and iPadOS desktop-mode Safari. */
export function isIosUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Pick the speech engine.
 *
 * iOS (Safari and every other iOS browser, which are all WebKit) is the case
 * that broke: Web Speech there either does not exist (Chrome/Firefox on iOS),
 * needs Siri dictation enabled, starts seconds late, or silently stops after
 * the guide's audio plays. So iOS records with MediaRecorder and transcribes
 * on the server whenever the server can. Everywhere else the browser engine
 * stays the default; the server path is the fallback when it is missing.
 */
export function selectVoiceEngine(c: VoiceCapabilities): VoiceEngine {
  const ios = isIosUserAgent(c.userAgent, c.maxTouchPoints ?? 0);
  const server = c.hasMediaRecorder && c.serverStt;
  if (ios && server) return "server";
  if (c.hasSpeechRecognition) return "browser";
  if (server) return "server";
  return "none";
}

/** Containers in preference order. iOS Safari only records audio/mp4 (AAC). */
export const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
] as const;

/**
 * First MediaRecorder type the browser supports, or "" to let the browser
 * pick its default (still valid: MediaRecorder then reports blob.type).
 * On iOS mp4 is tried first: some WebKit builds claim webm support but write
 * files the STT service cannot decode.
 */
export function pickRecorderMimeType(
  isTypeSupported: ((type: string) => boolean) | undefined,
  opts: { ios?: boolean } = {}
): string {
  if (!isTypeSupported) return "";
  const order = opts.ios
    ? [...RECORDER_MIME_CANDIDATES.filter((t) => t.startsWith("audio/mp4") || t === "audio/aac"), ...RECORDER_MIME_CANDIDATES]
    : [...RECORDER_MIME_CANDIDATES];
  for (const type of order) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      /* some browsers throw for unknown types */
    }
  }
  return "";
}

/** File extension the STT service uses to sniff the container. */
export function extensionForMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/m4a") return "m4a";
  if (base === "audio/aac") return "aac";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  return "webm";
}

/** RMS of an analyser time-domain frame (bytes centred on 128), 0..1. */
export function rmsLevel(frame: ArrayLike<number>): number {
  if (!frame.length) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = (frame[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / frame.length);
}

/** Map a raw RMS to a pleasant 0..1 meter value (speech sits around 0.02-0.2). */
export function meterLevel(rms: number): number {
  if (!(rms > 0)) return 0;
  return Math.min(1, Math.max(0, (Math.log10(rms) + 2.4) / 1.9));
}

export type VadConfig = {
  /** Speech must be this far above the noise floor (ratio). */
  ratio: number;
  /** Absolute minimum RMS that can count as speech. */
  minRms: number;
  /** Speech this long starts an utterance. */
  attackMs: number;
  /** Silence this long ends an utterance. */
  releaseMs: number;
  /** Hard cap on one utterance. */
  maxUtteranceMs: number;
};

export const DEFAULT_VAD: VadConfig = {
  ratio: 2.6,
  minRms: 0.018,
  attackMs: 120,
  releaseMs: 1300,
  maxUtteranceMs: 30_000,
};

export type VadState = {
  speaking: boolean;
  noiseFloor: number;
  aboveSince: number | null;
  belowSince: number | null;
  startedAt: number | null;
};

export const initialVadState = (): VadState => ({
  speaking: false,
  noiseFloor: 0.008,
  aboveSince: null,
  belowSince: null,
  startedAt: null,
});

export type VadEvent = "start" | "end" | null;

/** Advance the detector by one frame. Pure: returns the next state + event. */
export function vadStep(
  s: VadState,
  rms: number,
  now: number,
  cfg: VadConfig = DEFAULT_VAD
): { state: VadState; event: VadEvent } {
  const threshold = Math.max(cfg.minRms, s.noiseFloor * cfg.ratio);
  const loud = rms >= threshold;
  const next: VadState = { ...s };
  // Track the room's noise floor only while nobody is talking.
  if (!s.speaking && !loud) {
    next.noiseFloor = s.noiseFloor * 0.95 + Math.max(rms, 0.002) * 0.05;
  }
  if (!s.speaking) {
    if (loud) {
      next.aboveSince = s.aboveSince ?? now;
      if (now - next.aboveSince >= cfg.attackMs) {
        next.speaking = true;
        next.startedAt = next.aboveSince;
        next.belowSince = null;
        return { state: next, event: "start" };
      }
    } else {
      next.aboveSince = null;
    }
    return { state: next, event: null };
  }
  // Speaking.
  if (loud) next.belowSince = null;
  else next.belowSince = s.belowSince ?? now;
  const tooLong = next.startedAt != null && now - next.startedAt >= cfg.maxUtteranceMs;
  if (tooLong || (next.belowSince != null && now - next.belowSince >= cfg.releaseMs)) {
    return {
      state: { ...next, speaking: false, aboveSince: null, belowSince: null, startedAt: null },
      event: "end",
    };
  }
  return { state: next, event: null };
}
