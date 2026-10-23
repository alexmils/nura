"use client";

/**
 * Audio output for voice mode.
 *
 * iOS only lets a page play sound that was started from a tap. The guide's
 * replies arrive seconds after the tap (fetch + TTS), so a fresh `new Audio()`
 * per reply is rejected with NotAllowedError and the reply is silently lost.
 * `unlockVoiceAudio()` runs inside the "Start voice" tap and unlocks one shared
 * <audio> element, a shared AudioContext (also used for the mic meter) and
 * speechSynthesis; every later reply reuses them.
 */

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let ctx: AudioContext | null = null;
let element: HTMLAudioElement | null = null;
let analyser: AnalyserNode | null = null;
let routed = false;
let frame: Uint8Array<ArrayBuffer> | null = null;
let synthSpeaking = false;

type AudioCtor = typeof AudioContext;

export function getVoiceAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Resume the shared context (no-op when running). Safe to call anytime. */
export function resumeVoiceAudio(): void {
  const c = ctx;
  if (c && c.state !== "running" && c.state !== "closed") {
    void c.resume().catch(() => {});
  }
}

/** Call synchronously inside the user's tap that starts voice mode. */
export function unlockVoiceAudio(): void {
  if (typeof window === "undefined") return;
  const c = getVoiceAudioContext();
  if (c) {
    void c.resume().catch(() => {});
    try {
      // A one-sample silent buffer is the canonical WebKit unlock.
      const buf = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }
  if (!element) {
    element = new Audio();
    element.setAttribute("playsinline", "");
    element.preload = "auto";
  }
  try {
    element.muted = false;
    element.src = SILENT_WAV;
    void element.play().catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    const synth = window.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    }
  } catch {
    /* ignore */
  }
}

/** The unlocked element for replies, or a new one when voice mode never ran. */
export function voiceAudioElement(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.setAttribute("playsinline", "");
  }
  // Route through an analyser once the context runs, so the orb can follow
  // the guide's voice. Never route while suspended: that would mute output.
  const c = ctx;
  if (!routed && c && c.state === "running") {
    try {
      const source = c.createMediaElementSource(element);
      analyser = c.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(c.destination);
      routed = true;
    } catch {
      routed = true; // an element can only be routed once; do not retry
    }
  }
  resumeVoiceAudio();
  return element;
}

/** 0..1 loudness of what the guide is saying right now. */
export function voiceOutputLevel(): number {
  if (synthSpeaking) {
    // speechSynthesis has no audio graph: a soft synthetic pulse instead.
    const t = performance.now() / 1000;
    return 0.45 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 0.4);
  }
  if (!analyser || !element || element.paused) return 0;
  if (!frame || frame.length !== analyser.fftSize) frame = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(frame);
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = (frame[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / frame.length);
  return Math.min(1, rms * 4);
}

/** Speak with the device voice when server TTS is unavailable. */
export function speakWithDeviceVoice(text: string, lang?: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || !text.trim()) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synthSpeaking = false;
      resolve();
    };
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (lang) u.lang = lang;
      u.rate = 0.98;
      u.onend = finish;
      u.onerror = finish;
      synthSpeaking = true;
      synth.speak(u);
      // iOS sometimes never fires onend; cap by a generous reading time.
      window.setTimeout(finish, 4000 + text.length * 90);
    } catch {
      finish();
    }
  });
}

export function cancelDeviceVoice(): void {
  synthSpeaking = false;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
