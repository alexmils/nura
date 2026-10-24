"use client";

/**
 * Server speech-to-text engine for voice mode (used on iOS, and wherever the
 * Web Speech API is missing). One microphone stream feeds both the live level
 * meter and a MediaRecorder that is started/stopped by a small voice-activity
 * detector; each utterance is uploaded to /api/voice/transcribe.
 */

import type { BrowserSpeechErrorCode, BrowserSpeechStatus } from "./browser-speech";
import { getVoiceAudioContext, resumeVoiceAudio } from "./voice-audio";
import {
  extensionForMime,
  initialVadState,
  isIosUserAgent,
  meterLevel,
  pickRecorderMimeType,
  rmsLevel,
  vadStep,
  type VadState,
} from "./voice-capture";

export type ServerSpeechCallbacks = {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (code: BrowserSpeechErrorCode, message: string) => void;
  onStatus?: (status: BrowserSpeechStatus | "starting") => void;
};

export type ServerSpeechSession = {
  stop: () => void;
  abort: () => void;
  /** Ignore the mic (guide thinking/speaking, or muted). */
  pause: () => void;
  resume: () => void;
  /** 0..1 live input level for the orb / wave. */
  level: () => number;
};

/** Mic must be live within this long, or we stop pretending to listen. */
export const MIC_START_TIMEOUT_MS = 10_000;
const TICK_MS = 40;

export function startServerSpeech(
  callbacks: ServerSpeechCallbacks,
  options?: { lang?: string }
): ServerSpeechSession {
  let active = true;
  let paused = false;
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let discard = false;
  let vad: VadState = initialVadState();
  let level = 0;
  let tick: ReturnType<typeof setInterval> | null = null;
  let frame: Uint8Array<ArrayBuffer> | null = null;
  /** In-flight transcription uploads, aborted on teardown. */
  const uploads = new Set<AbortController>();
  /** Extra one-shot timers (resume check), cleared on teardown. */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ios = isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const mimeType = pickRecorderMimeType(
    typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported?.bind(MediaRecorder) : undefined,
    { ios }
  );

  const fail = (code: BrowserSpeechErrorCode, message: string) => {
    if (!active) return;
    teardown();
    callbacks.onStatus?.("stopped");
    callbacks.onError?.(code, message);
  };

  const teardown = () => {
    active = false;
    if (tick) clearInterval(tick);
    tick = null;
    clearTimeout(startTimer);
    for (const t of timers) clearTimeout(t);
    timers.clear();
    for (const c of uploads) c.abort();
    uploads.clear();
    discard = true;
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* ignore */
    }
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
    }
    recorder = null;
    chunks = [];
    try {
      source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      analyser?.disconnect();
    } catch {
      /* ignore */
    }
    source = null;
    analyser = null;
    frame = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const upload = async (blob: Blob) => {
    if (blob.size < 1500) return; // a click, not speech
    callbacks.onInterim?.("\u2026");
    const type = blob.type || mimeType || "audio/webm";
    const form = new FormData();
    form.append("audio", blob, `speech.${extensionForMime(type)}`);
    if (options?.lang) form.append("lang", options.lang);
    const ctl = new AbortController();
    uploads.add(ctl);
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal: ctl.signal });
      if (!active) return;
      if (res.status === 503) {
        fail("unsupported", "Voice transcription is not set up on this workspace.");
        return;
      }
      if (!res.ok) {
        callbacks.onInterim?.("");
        callbacks.onError?.("network", "Could not hear that. Try again.");
        return;
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      callbacks.onInterim?.("");
      if (text && !paused) callbacks.onFinal?.(text);
    } catch {
      if (!active) return;
      callbacks.onInterim?.("");
      callbacks.onError?.("network", "Network problem. Try again.");
    } finally {
      uploads.delete(ctl);
    }
  };

  const startRecording = () => {
    if (!stream || recorder) return;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        fail("unsupported", "This browser cannot record audio.");
        return;
      }
    }
    chunks = [];
    discard = false;
    const rec = recorder;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const parts = chunks;
      chunks = [];
      if (recorder === rec) recorder = null;
      if (discard || !active) return;
      void upload(new Blob(parts, { type: rec.mimeType || mimeType || "audio/webm" }));
    };
    rec.start(250);
  };

  const stopRecording = (keep: boolean) => {
    if (!recorder) return;
    discard = !keep;
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      recorder = null;
    }
  };

  const onTick = () => {
    if (!active || !analyser) return;
    if (!frame || frame.length !== analyser.fftSize) frame = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(frame);
    const rms = rmsLevel(frame);
    level = paused ? 0 : meterLevel(rms);
    if (paused) return;
    const { state, event } = vadStep(vad, rms, performance.now());
    vad = state;
    if (event === "start") startRecording();
    else if (event === "end") stopRecording(true);
  };

  const startTimer = setTimeout(() => {
    if (active && !tick) {
      fail("other", "The microphone did not start. Tap Resume to try again.");
    }
  }, MIC_START_TIMEOUT_MS);

  callbacks.onStatus?.("starting");
  const ctx = getVoiceAudioContext();
  resumeVoiceAudio();

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || !ctx) {
    queueMicrotask(() => fail("unsupported", "Voice needs a newer browser on this device."));
  } else {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        s.getAudioTracks()[0]?.addEventListener("ended", () =>
          fail("other", "The microphone was turned off. Tap Resume to continue.")
        );
        resumeVoiceAudio();
        source = ctx.createMediaStreamSource(s);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        tick = setInterval(onTick, TICK_MS);
        clearTimeout(startTimer);
        if (ctx.state !== "running") {
          // A suspended context reads silence forever: say so instead.
          void ctx.resume().then(
            () => active && callbacks.onStatus?.("listening"),
            () => fail("other", "Tap Resume to turn the microphone on.")
          );
          const t = setTimeout(() => {
            timers.delete(t);
            if (active && ctx.state !== "running") fail("other", "Tap Resume to turn the microphone on.");
          }, 2500);
          timers.add(t);
          return;
        }
        callbacks.onStatus?.("listening");
      })
      .catch((err: unknown) => {
        const name = (err as { name?: string })?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          fail("not-allowed", "Microphone access was blocked. Allow the mic in your browser settings to use Voice.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          fail("unsupported", "No microphone was found on this device.");
        } else {
          fail("other", "The microphone could not start. Tap Resume to try again.");
        }
      });
  }

  return {
    stop: () => {
      if (!active) return;
      stopRecording(false);
      teardown();
    },
    abort: () => {
      if (!active) return;
      teardown();
    },
    pause: () => {
      paused = true;
      stopRecording(false);
      vad = { ...initialVadState(), noiseFloor: vad.noiseFloor };
    },
    resume: () => {
      paused = false;
      resumeVoiceAudio();
    },
    level: () => level,
  };
}
