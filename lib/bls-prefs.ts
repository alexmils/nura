/**
 * Persist Free/Guided BLS Adjustments (speed, look, sound, …) in localStorage.
 * Per-user key when signed in; anon fallback before /api/auth/me.
 * Not platform freeSessionChromeId (admin chrome theme).
 */

import { normalizeSpeedPresets } from "@/lib/bls-speed";
import {
  parseRepeatMode,
  parseRepeatPresetValue,
  BLS_REPEATS_DEFAULT,
} from "@/lib/bls-repeats";
import { isBlsSoundId, migrateLegacySound } from "@/lib/bls-sounds";
import {
  DEFAULT_BLS,
  type AnimationMode,
  type AnimationPath,
  type BlsSettings,
  type BrightenFlashes,
  type RepeatMode,
  type RepeatPresetIndex,
  type SpeedPresetIndex,
  type VibrationMode,
} from "@/lib/types";

export const BLS_PREFS_STORAGE_PREFIX = "emdr_bls_prefs_v1";

const ANIMATIONS = new Set<AnimationMode>(["dot", "flash"]);
const PATHS = new Set<AnimationPath>([
  "auto",
  "horizontal",
  "diagonal-up",
  "diagonal-down",
  "vertical",
  "random",
]);
const VIBRATIONS = new Set<VibrationMode>(["off", "subtle", "soft", "normal"]);

export type BlsPrefsSection =
  | "speed"
  | "repeats"
  | "sound"
  | "animation"
  | "look"
  | "vibration";

function cloneBls(bls: BlsSettings): BlsSettings {
  return {
    ...bls,
    speedPresets: [...bls.speedPresets],
    repeatPresets: [bls.repeatPresets[0], bls.repeatPresets[1]],
  };
}

/** Legacy none → off, hard → normal. Unknown values fall back to the default. */
export function migrateVibrationMode(raw: unknown): VibrationMode {
  if (typeof raw === "string" && VIBRATIONS.has(raw as VibrationMode)) {
    return raw as VibrationMode;
  }
  if (raw === "none") return "off";
  if (raw === "hard") return "normal";
  return DEFAULT_BLS.vibration;
}

export function blsPrefsStorageKey(userId: string | null): string {
  return userId
    ? `${BLS_PREFS_STORAGE_PREFIX}:${userId}`
    : `${BLS_PREFS_STORAGE_PREFIX}:anon`;
}

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

function clampBallSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BLS.ballSize;
  return Math.min(80, Math.max(24, Math.round(n)));
}

function clampSetLengthSec(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BLS.setLengthSec;
  return Math.min(600, Math.max(10, Math.round(n)));
}

/** Validate / normalize unknown JSON into BlsSettings, or null if unusable. */
export function parseBlsSettings(raw: unknown): BlsSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  let speedPresets: [number, number, number] = [...DEFAULT_BLS.speedPresets];
  if (Array.isArray(o.speedPresets) && o.speedPresets.length >= 3) {
    speedPresets = normalizeSpeedPresets([
      Number(o.speedPresets[0]),
      Number(o.speedPresets[1]),
      Number(o.speedPresets[2]),
    ]);
  }

  let activeSpeedPreset: SpeedPresetIndex = DEFAULT_BLS.activeSpeedPreset;
  if (o.activeSpeedPreset === 0 || o.activeSpeedPreset === 1 || o.activeSpeedPreset === 2) {
    activeSpeedPreset = o.activeSpeedPreset;
  }

  const repeats = parseRepeatFields(o);

  const stereo = parseStereo(o);

  const animation =
    typeof o.animation === "string" && ANIMATIONS.has(o.animation as AnimationMode)
      ? (o.animation as AnimationMode)
      : DEFAULT_BLS.animation;

  const animationPath =
    typeof o.animationPath === "string" && PATHS.has(o.animationPath as AnimationPath)
      ? (o.animationPath as AnimationPath)
      : DEFAULT_BLS.animationPath;

  const brightenFlashes: BrightenFlashes =
    o.brightenFlashes === "standard" ? "standard" : "off";

  const vibration = migrateVibrationMode(o.vibration);

  return {
    speedPresets,
    activeSpeedPreset,
    repeats: repeats.repeats,
    repeatPresets: repeats.repeatPresets,
    activeRepeatPreset: repeats.activeRepeatPreset,
    setLengthSec: clampSetLengthSec(Number(o.setLengthSec)),
    soundMuted: stereo.soundMuted,
    leftSound: stereo.leftSound,
    rightSound: stereo.rightSound,
    reverseStereo: stereo.reverseStereo,
    animation,
    animationPath,
    brightenFlashes,
    ballColor: isHexColor(o.ballColor) ? o.ballColor.toLowerCase() : DEFAULT_BLS.ballColor,
    flashColor: isHexColor(o.flashColor) ? o.flashColor.toLowerCase() : DEFAULT_BLS.flashColor,
    ballSize: clampBallSize(Number(o.ballSize)),
    background: isHexColor(o.background) ? o.background.toLowerCase() : DEFAULT_BLS.background,
    vibration,
  };
}

function parseRepeatFields(o: Record<string, unknown>): {
  repeatPresets: [RepeatMode, RepeatMode];
  activeRepeatPreset: RepeatPresetIndex;
  repeats: RepeatMode;
} {
  if (Array.isArray(o.repeatPresets) && o.repeatPresets.length >= 2) {
    const first = parseRepeatPresetValue(o.repeatPresets[0]);
    const second = parseRepeatPresetValue(o.repeatPresets[1]);
    if (first !== null && second !== null) {
      const repeatPresets: [RepeatMode, RepeatMode] = [first, second];
      const activeRepeatPreset: RepeatPresetIndex = o.activeRepeatPreset === 1 ? 1 : 0;
      return {
        repeatPresets,
        activeRepeatPreset,
        repeats: repeatPresets[activeRepeatPreset],
      };
    }
  }

  const legacy = o.repeats === undefined ? DEFAULT_BLS.repeats : parseRepeatMode(o.repeats);
  const count = legacy === "infinity" ? BLS_REPEATS_DEFAULT : legacy;
  const repeatPresets: [RepeatMode, RepeatMode] = [count, "infinity"];
  const activeRepeatPreset: RepeatPresetIndex = legacy === "infinity" ? 1 : 0;
  return {
    repeatPresets,
    activeRepeatPreset,
    repeats: repeatPresets[activeRepeatPreset],
  };
}

function parseStereo(o: Record<string, unknown>): {
  soundMuted: boolean;
  leftSound: BlsSettings["leftSound"];
  rightSound: BlsSettings["rightSound"];
  reverseStereo: boolean;
} {
  const legacy = migrateLegacySound(o.sound);
  const explicitLeft = isBlsSoundId(o.leftSound) ? o.leftSound : null;
  const explicitRight = isBlsSoundId(o.rightSound) ? o.rightSound : null;
  const reverseStereo = o.reverseStereo === true;

  if (legacy?.muted && !explicitLeft && !explicitRight) {
    return {
      soundMuted: true,
      leftSound: DEFAULT_BLS.leftSound,
      rightSound: DEFAULT_BLS.rightSound,
      reverseStereo,
    };
  }

  const fallback = legacy?.sound;
  const leftSound = explicitLeft ?? fallback ?? DEFAULT_BLS.leftSound;
  const rightSound = explicitRight ?? fallback ?? DEFAULT_BLS.rightSound;
  const soundMuted =
    typeof o.soundMuted === "boolean" ? o.soundMuted : legacy ? legacy.muted : DEFAULT_BLS.soundMuted;

  return { soundMuted, leftSound, rightSound, reverseStereo };
}

/** Reset one adjustments section without touching the others. */
export function blsSectionDefaultPatch(section: BlsPrefsSection): Partial<BlsSettings> {
  const d = DEFAULT_BLS;
  switch (section) {
    case "speed":
      return {
        speedPresets: [...d.speedPresets],
        activeSpeedPreset: d.activeSpeedPreset,
      };
    case "repeats":
      return {
        repeatPresets: [d.repeatPresets[0], d.repeatPresets[1]],
        activeRepeatPreset: d.activeRepeatPreset,
        repeats: d.repeats,
        setLengthSec: d.setLengthSec,
      };
    case "sound":
      return {
        soundMuted: d.soundMuted,
        leftSound: d.leftSound,
        rightSound: d.rightSound,
        reverseStereo: d.reverseStereo,
      };
    case "animation":
      return {
        animation: d.animation,
        animationPath: d.animationPath,
        brightenFlashes: d.brightenFlashes,
      };
    case "look":
      return {
        ballColor: d.ballColor,
        flashColor: d.flashColor,
        ballSize: d.ballSize,
        background: d.background,
      };
    case "vibration":
      return { vibration: d.vibration };
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadBlsPrefs(
  userId: string | null,
  storage?: StorageLike | null
): BlsSettings {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return cloneBls(DEFAULT_BLS);

  try {
    const raw = store.getItem(blsPrefsStorageKey(userId));
    if (!raw) return cloneBls(DEFAULT_BLS);
    const parsed = parseBlsSettings(JSON.parse(raw) as unknown);
    return parsed ?? cloneBls(DEFAULT_BLS);
  } catch {
    return cloneBls(DEFAULT_BLS);
  }
}

export function saveBlsPrefs(
  userId: string | null,
  bls: BlsSettings,
  storage?: StorageLike | null
): void {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return;
  try {
    const normalized = parseBlsSettings(bls) ?? DEFAULT_BLS;
    store.setItem(blsPrefsStorageKey(userId), JSON.stringify(normalized));
  } catch {
    // ignore quota / private mode
  }
}

export function clearBlsPrefs(
  userId: string | null,
  storage?: StorageLike | null
): void {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return;
  try {
    store.removeItem(blsPrefsStorageKey(userId));
  } catch {
    // ignore
  }
}

/** Relative luminance threshold for idle-hint ink vs light text on Look background. */
export function blsBackgroundIsDark(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L < 0.55;
}

/** True when settings match product defaults (used after Reset). */
export function isDefaultBlsSettings(bls: BlsSettings): boolean {
  const d = DEFAULT_BLS;
  return (
    bls.activeSpeedPreset === d.activeSpeedPreset &&
    bls.repeats === d.repeats &&
    bls.activeRepeatPreset === d.activeRepeatPreset &&
    bls.repeatPresets[0] === d.repeatPresets[0] &&
    bls.repeatPresets[1] === d.repeatPresets[1] &&
    bls.setLengthSec === d.setLengthSec &&
    bls.soundMuted === d.soundMuted &&
    bls.leftSound === d.leftSound &&
    bls.rightSound === d.rightSound &&
    bls.reverseStereo === d.reverseStereo &&
    bls.animation === d.animation &&
    bls.animationPath === d.animationPath &&
    bls.brightenFlashes === d.brightenFlashes &&
    bls.ballColor.toLowerCase() === d.ballColor.toLowerCase() &&
    bls.flashColor.toLowerCase() === d.flashColor.toLowerCase() &&
    bls.ballSize === d.ballSize &&
    bls.background.toLowerCase() === d.background.toLowerCase() &&
    bls.vibration === d.vibration &&
    bls.speedPresets.length === 3 &&
    bls.speedPresets[0] === d.speedPresets[0] &&
    bls.speedPresets[1] === d.speedPresets[1] &&
    bls.speedPresets[2] === d.speedPresets[2]
  );
}
