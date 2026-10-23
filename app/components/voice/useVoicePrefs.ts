"use client";

/**
 * Voice-mode look chosen in Admin -> Platform -> Voice orb: which orb, and
 * whether the start / end chimes play. Fetched once per page load from
 * GET /api/voice-prefs and shared by every caller; the admin picker pushes
 * fresh values in after a save.
 */
import { useEffect, useState } from "react";
import {
  DEFAULT_VOICE_ORB_ID,
  DEFAULT_VOICE_SOUNDS,
  normalizeVoiceOrbId,
  normalizeVoiceSounds,
  type VoiceOrbId,
} from "@/lib/voice-orb-catalog";

export type VoicePrefs = { orbId: VoiceOrbId; sounds: boolean };

let current: VoicePrefs | null = null;
let inflight: Promise<VoicePrefs> | null = null;
const listeners = new Set<(p: VoicePrefs) => void>();

const FALLBACK: VoicePrefs = { orbId: DEFAULT_VOICE_ORB_ID, sounds: DEFAULT_VOICE_SOUNDS };

function fetchPrefs(): Promise<VoicePrefs> {
  if (current) return Promise.resolve(current);
  if (!inflight) {
    inflight = fetch("/api/voice-prefs", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { orbId?: unknown; sounds?: unknown } | null) => {
        const next: VoicePrefs = d
          ? { orbId: normalizeVoiceOrbId(d.orbId), sounds: normalizeVoiceSounds(d.sounds) }
          : FALLBACK;
        setVoicePrefs(next);
        return next;
      })
      .catch(() => {
        setVoicePrefs(FALLBACK);
        return FALLBACK;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Push a new value to every mounted consumer (admin picker after save). */
export function setVoicePrefs(next: VoicePrefs): void {
  current = next;
  for (const l of listeners) l(next);
}

/** Synchronous read for event handlers (null until loaded). */
export function peekVoicePrefs(): VoicePrefs | null {
  return current;
}

/** null while loading; then the saved prefs (defaults if the fetch fails). */
export function useVoicePrefs(enabled = true): VoicePrefs | null {
  const [prefs, setPrefs] = useState<VoicePrefs | null>(current);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setPrefs);
    if (current) setPrefs(current);
    else void fetchPrefs();
    return () => {
      listeners.delete(setPrefs);
    };
  }, [enabled]);
  return prefs;
}
