/**
 * Voice-mode start / end chimes: synthesized with the Web Audio API (no
 * audio files, nothing to license). Pure data + logic here so it runs in node
 * tests; the browser player is app/components/voice/voice-chime-player.ts.
 *
 *   start  two rising sine notes (E5 -> B5) with a faint triangle shimmer,
 *          ~0.6 s, peak -18 dBFS.
 *   end    the matching but lower, softer fall (B4 -> E4), ~0.7 s, -21 dBFS.
 *
 * Every note has a 20-25 ms attack and an exponential release, so there are
 * no clicks or harsh transients.
 */

export type ChimeKind = "start" | "end";

export type ChimeNote = {
  /** Hz */
  freq: number;
  /** Seconds from the chime's start. */
  at: number;
  /** Seconds the note sounds, release included. */
  dur: number;
  type: OscillatorType;
  /** Peak level relative to the chime's peak (0..1). */
  level: number;
};

export type ChimeSpec = {
  /** Peak loudness in dBFS. */
  peakDb: number;
  attack: number;
  notes: readonly ChimeNote[];
};

export const CHIMES: Record<ChimeKind, ChimeSpec> = {
  start: {
    peakDb: -18,
    attack: 0.02,
    notes: [
      { freq: 659.25, at: 0, dur: 0.42, type: "sine", level: 0.85 },
      { freq: 987.77, at: 0.14, dur: 0.46, type: "sine", level: 1 },
      { freq: 1975.53, at: 0.14, dur: 0.3, type: "triangle", level: 0.08 },
    ],
  },
  end: {
    peakDb: -21,
    attack: 0.025,
    notes: [
      { freq: 493.88, at: 0, dur: 0.42, type: "sine", level: 1 },
      { freq: 329.63, at: 0.18, dur: 0.52, type: "sine", level: 0.9 },
    ],
  },
};

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Total length of a chime in seconds. */
export function chimeDuration(spec: ChimeSpec): number {
  return spec.notes.reduce((m, n) => Math.max(m, n.at + n.dur), 0);
}

/** Ignore mic transcripts for this long after the start chime (ms). */
export const START_CHIME_MIC_GUARD_MS = Math.ceil(chimeDuration(CHIMES.start) * 1000) + 80;

/**
 * Once-per-entry gate. `enter()` is true only on the transition into voice
 * mode, `exit()` only on the transition out, so state changes inside a
 * session (listening / thinking / speaking, mute, resume) never replay a
 * chime, and a double "End voice" plays the end chime once.
 */
export function createChimeGate() {
  let open = false;
  return {
    enter(): boolean {
      if (open) return false;
      open = true;
      return true;
    },
    exit(): boolean {
      if (!open) return false;
      open = false;
      return true;
    },
    get open() {
      return open;
    },
  };
}

/** Whether a chime should sound right now. */
export function shouldPlayChime(env: {
  enabled: boolean;
  /** document.visibilityState */
  visibility: string;
  /** AudioContext state, null when Web Audio is missing. */
  audioState: string | null;
}): boolean {
  if (!env.enabled) return false;
  if (env.visibility !== "visible") return false;
  if (env.audioState === null || env.audioState === "closed") return false;
  return true;
}
