/**
 * Voice-mode playback rules (pure, unit-tested).
 *
 * 1. Spoken-line tracking: entering voice mode must not replay a guide line
 *    that was already on screen; each agent message id is spoken at most once.
 * 2. TTS start plan: never start under the start chime, and run a short
 *    near-silent pre-roll on the output first so iOS Safari / Bluetooth
 *    routes are awake before the first phoneme ("Thank you", not "kyou").
 */

export type SpokenTracker = {
  /** Voice mode opened: whatever is already displayed counts as shown. */
  baseline(lastShownId: string | null | undefined): void;
  /** Mark an id as spoken / handled (e.g. a reply played inside a turn). */
  mark(id: string | null | undefined): void;
  /** True once per new id; marks it. False for shown / spoken / empty ids. */
  claim(id: string | null | undefined): boolean;
  has(id: string | null | undefined): boolean;
};

export function createSpokenTracker(limit = 200): SpokenTracker {
  const ids = new Set<string>();
  const add = (id: string) => {
    ids.add(id);
    if (ids.size > limit) {
      const first = ids.values().next().value;
      if (first !== undefined) ids.delete(first);
    }
  };
  return {
    baseline(lastShownId) {
      if (lastShownId) add(lastShownId);
    },
    mark(id) {
      if (id) add(id);
    },
    claim(id) {
      if (!id || ids.has(id)) return false;
      add(id);
      return true;
    },
    has(id) {
      return Boolean(id && ids.has(id));
    },
  };
}

/** Near-silent pre-roll before every TTS reply in voice mode. */
export const TTS_PREROLL_MS = 200;
/** The pre-roll keeps sounding this long into the reply, so the path never idles. */
export const TTS_PREROLL_OVERLAP_MS = 150;
/** Never wait on a chime longer than this (clock skew / stale timestamp). */
export const MAX_CHIME_WAIT_MS = 1500;

export type TtsStartPlan = {
  /** Wait for the start chime to finish first. */
  chimeWaitMs: number;
  /** Then run the near-silent pre-roll this long before play(). */
  prerollMs: number;
  /** Length of the near-silent buffer (pre-roll + overlap into speech). */
  silenceMs: number;
};

export function planTtsStart(opts: {
  now: number;
  chimeEndsAt?: number;
  prerollMs?: number;
  overlapMs?: number;
}): TtsStartPlan {
  const preroll = Math.max(0, opts.prerollMs ?? TTS_PREROLL_MS);
  const overlap = Math.max(0, opts.overlapMs ?? TTS_PREROLL_OVERLAP_MS);
  const ends = opts.chimeEndsAt ?? 0;
  const wait = Number.isFinite(ends) ? Math.max(0, ends - opts.now) : 0;
  return {
    chimeWaitMs: Math.min(MAX_CHIME_WAIT_MS, Math.round(wait)),
    prerollMs: preroll,
    silenceMs: preroll + overlap,
  };
}
