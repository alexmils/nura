import type { BlsSoundId, LegacySoundMode } from "@/lib/types";

export interface BlsSoundOption {
  id: BlsSoundId;
  label: string;
  /** Short chip / collapsed summary. */
  short: string;
  group: "Tones" | "Percussion";
  /** Synthesis recipe. No sampled audio. */
  kind: "beep" | "piano" | "snap" | "pink" | "sticks" | "hat";
  hz?: number;
}

export const BLS_SOUND_OPTIONS: readonly BlsSoundOption[] = [
  { id: "beep-g3", label: "Beep (G3)", short: "G3", group: "Tones", kind: "beep", hz: 196 },
  { id: "beep-c4", label: "Beep (C4)", short: "C4", group: "Tones", kind: "beep", hz: 261.63 },
  { id: "beep-a4", label: "Beep (A4)", short: "A4", group: "Tones", kind: "beep", hz: 440 },
  { id: "beep-c5", label: "Beep (C5)", short: "C5", group: "Tones", kind: "beep", hz: 523.25 },
  { id: "beep-c6", label: "Beep (C6)", short: "C6", group: "Tones", kind: "beep", hz: 1046.5 },
  { id: "piano-g6", label: "Piano (G6)", short: "Piano", group: "Tones", kind: "piano", hz: 1567.98 },
  { id: "finger-snap", label: "Finger snap", short: "Snap", group: "Percussion", kind: "snap" },
  { id: "pink-noise", label: "Pink noise", short: "Noise", group: "Percussion", kind: "pink" },
  { id: "sticks", label: "Sticks", short: "Sticks", group: "Percussion", kind: "sticks" },
  { id: "hi-hat", label: "Hi-hat", short: "Hat", group: "Percussion", kind: "hat" },
];

const SOUND_IDS = new Set<string>(BLS_SOUND_OPTIONS.map((option) => option.id));

export function isBlsSoundId(value: unknown): value is BlsSoundId {
  return typeof value === "string" && SOUND_IDS.has(value);
}

export function blsSoundOption(id: BlsSoundId): BlsSoundOption {
  const found = BLS_SOUND_OPTIONS.find((option) => option.id === id);
  return found ?? BLS_SOUND_OPTIONS[2];
}

export function blsSoundLabel(id: BlsSoundId): string {
  return blsSoundOption(id).label;
}

/**
 * Old single-sound modes.
 * click → finger snap (short noise, like the old square click)
 * pulse → Beep G3 (old pulse was a low sine near 220 Hz)
 * tone → Beep A4 (old tone was 440 Hz)
 * mute → silenced, caller keeps the default pair
 */
export function migrateLegacySound(
  raw: unknown
): { muted: boolean; sound: BlsSoundId } | null {
  if (raw === "mute") return { muted: true, sound: "beep-a4" };
  if (raw === "click") return { muted: false, sound: "finger-snap" };
  if (raw === "pulse") return { muted: false, sound: "beep-g3" };
  if (raw === "tone") return { muted: false, sound: "beep-a4" };
  return null;
}

export function isLegacySoundMode(raw: unknown): raw is LegacySoundMode {
  return raw === "mute" || raw === "click" || raw === "pulse" || raw === "tone";
}

/** Which timbre plays at an end, and which speaker that end uses. */
export function edgeSound(
  side: "left" | "right",
  left: BlsSoundId,
  right: BlsSoundId,
  reverse: boolean
): { id: BlsSoundId; pan: -1 | 1 } {
  const swapped = reverse ? (side === "left" ? right : left) : side === "left" ? left : right;
  return { id: swapped, pan: side === "left" ? -1 : 1 };
}
