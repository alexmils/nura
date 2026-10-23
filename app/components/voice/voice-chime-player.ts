"use client";

import { getVoiceAudioContext, resumeVoiceAudio } from "@/lib/voice-audio";
import { CHIMES, chimeDuration, dbToGain, shouldPlayChime, type ChimeKind } from "@/lib/voice-chime";

/**
 * Plays a voice chime on the shared voice AudioContext (unlocked by
 * `unlockVoiceAudio()` inside the "Start voice" tap, which iOS requires).
 * Silent when chimes are off or the tab is in the background; muting the
 * tab in the browser silences it like any other page audio.
 */
export function playVoiceChime(kind: ChimeKind, enabled: boolean): void {
  if (typeof window === "undefined") return;
  const ctx = getVoiceAudioContext();
  if (
    !shouldPlayChime({
      enabled,
      visibility: typeof document !== "undefined" ? document.visibilityState : "visible",
      audioState: ctx ? ctx.state : null,
    }) ||
    !ctx
  ) {
    return;
  }
  resumeVoiceAudio();
  const spec = CHIMES[kind];
  try {
    const out = ctx.createGain();
    out.gain.value = dbToGain(spec.peakDb);
    // A gentle low-pass keeps the triangle shimmer from sounding brittle.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4200;
    out.connect(lp);
    lp.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.02;
    for (const n of spec.notes) {
      const osc = ctx.createOscillator();
      osc.type = n.type;
      osc.frequency.value = n.freq;
      const g = ctx.createGain();
      const start = t0 + n.at;
      const end = start + n.dur;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(n.level, start + spec.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g);
      g.connect(out);
      osc.start(start);
      osc.stop(end + 0.02);
    }
    window.setTimeout(() => {
      try {
        out.disconnect();
        lp.disconnect();
      } catch {
        /* ignore */
      }
    }, (chimeDuration(spec) + 0.3) * 1000);
  } catch {
    /* audio is a nicety; never break voice mode over it */
  }
}
