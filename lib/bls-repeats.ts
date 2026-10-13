import type { RepeatMode, RepeatPresetIndex } from "@/lib/types";

export const BLS_REPEATS_MIN = 1;
export const BLS_REPEATS_MAX = 999;
export const BLS_REPEATS_DEFAULT = 24;

export function clampBlsRepeatsCount(n: number): number {
  if (!Number.isFinite(n)) return BLS_REPEATS_DEFAULT;
  return Math.min(
    BLS_REPEATS_MAX,
    Math.max(BLS_REPEATS_MIN, Math.round(n))
  );
}

/** Normalize stored / UI values into RepeatMode (`number` | `"infinity"`). */
export function parseRepeatMode(raw: unknown): RepeatMode {
  if (raw === "infinity") return "infinity";
  if (typeof raw === "number") return clampBlsRepeatsCount(raw);
  if (typeof raw === "string") {
    if (raw === "infinity") return "infinity";
    if (/^\d+$/.test(raw)) return clampBlsRepeatsCount(Number(raw));
  }
  return BLS_REPEATS_DEFAULT;
}

/** ArrowUp (+1) / ArrowDown (−1) for the dock & number inputs. */
export function adjustRepeatMode(
  current: RepeatMode,
  direction: 1 | -1
): RepeatMode {
  if (current === "infinity") {
    return direction === -1 ? BLS_REPEATS_DEFAULT : "infinity";
  }
  return clampBlsRepeatsCount(current + direction);
}

/** Pass limit for the ball canvas (Infinity when unlimited). */
export function repeatsLimit(repeats: RepeatMode): number {
  return repeats === "infinity" ? Infinity : repeats;
}

export function formatRepeatsLabel(repeats: RepeatMode): string {
  return repeats === "infinity" ? "∞" : String(repeats);
}

/**
 * A blank preset is unlimited. Used for the two repeat boxes, not for a
 * missing legacy `repeats` field (that still falls back to the default count).
 */
export function parseRepeatPresetValue(raw: unknown): RepeatMode | null {
  if (raw === "infinity" || raw === null) return "infinity";
  if (typeof raw === "number" && Number.isFinite(raw)) return clampBlsRepeatsCount(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "infinity") return "infinity";
    if (/^\d+$/.test(trimmed)) return clampBlsRepeatsCount(Number(trimmed));
  }
  return null;
}

export function selectRepeatPreset(
  presets: [RepeatMode, RepeatMode],
  index: RepeatPresetIndex
): {
  repeatPresets: [RepeatMode, RepeatMode];
  activeRepeatPreset: RepeatPresetIndex;
  repeats: RepeatMode;
} {
  return {
    repeatPresets: [presets[0], presets[1]],
    activeRepeatPreset: index,
    repeats: presets[index],
  };
}

export function writeRepeatPreset(
  presets: [RepeatMode, RepeatMode],
  index: RepeatPresetIndex,
  value: RepeatMode
): {
  repeatPresets: [RepeatMode, RepeatMode];
  activeRepeatPreset: RepeatPresetIndex;
  repeats: RepeatMode;
} {
  const next: [RepeatMode, RepeatMode] = [presets[0], presets[1]];
  next[index] = value;
  return {
    repeatPresets: next,
    activeRepeatPreset: index,
    repeats: next[index],
  };
}
