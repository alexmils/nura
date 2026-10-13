import { adjustSpeedPreset } from "./bls-speed";
import { adjustRepeatMode } from "./bls-repeats";
import type {
  AnimationMode,
  BlsSettings,
  SpeedPresetIndex,
  VibrationMode,
} from "./types";

export type BlsToolbarField =
  | "speed0"
  | "speed1"
  | "speed2"
  | "repeats"
  | "sound"
  | "animation"
  | "vibration";

const VIBRATION_ORDER: VibrationMode[] = ["off", "subtle", "soft", "normal", "hard"];

export function speedFieldIndex(field: BlsToolbarField): SpeedPresetIndex | null {
  if (field === "speed0") return 0;
  if (field === "speed1") return 1;
  if (field === "speed2") return 2;
  return null;
}

export function blsToolbarFields(gamepadConnected: boolean): BlsToolbarField[] {
  const fields: BlsToolbarField[] = [
    "speed0",
    "speed1",
    "speed2",
    "repeats",
    "sound",
    "animation",
  ];
  if (gamepadConnected) fields.push("vibration");
  return fields;
}

export function moveBlsToolbarField(
  current: BlsToolbarField,
  direction: -1 | 1,
  gamepadConnected: boolean
): BlsToolbarField {
  const fields = blsToolbarFields(gamepadConnected);
  const index = fields.indexOf(current);
  const next = Math.min(fields.length - 1, Math.max(0, index + direction));
  return fields[next] ?? fields[0];
}

function cycle<T>(list: T[], current: T, direction: 1 | -1): T {
  const index = list.indexOf(current);
  const base = index < 0 ? 0 : index;
  return list[(base + direction + list.length) % list.length];
}

export function adjustBlsToolbarField(
  bls: BlsSettings,
  field: BlsToolbarField,
  direction: 1 | -1
): Partial<BlsSettings> {
  const speedIndex = speedFieldIndex(field);
  if (speedIndex !== null) {
    return {
      speedPresets: adjustSpeedPreset(bls.speedPresets, speedIndex, direction),
      activeSpeedPreset: speedIndex,
    };
  }

  switch (field) {
    case "repeats": {
      const next = adjustRepeatMode(bls.repeats, direction);
      const repeatPresets: BlsSettings["repeatPresets"] = [
        bls.repeatPresets[0],
        bls.repeatPresets[1],
      ];
      repeatPresets[bls.activeRepeatPreset] = next;
      return { repeats: next, repeatPresets };
    }
    case "sound":
      return { soundMuted: !bls.soundMuted };
    case "animation":
      return {
        animation: cycle<AnimationMode>(["dot", "flash"], bls.animation, direction),
      };
    case "vibration":
      return { vibration: cycle(VIBRATION_ORDER, bls.vibration, direction) };
    default:
      return {};
  }
}

export function normalizeBlsToolbarField(
  field: BlsToolbarField,
  gamepadConnected: boolean
): BlsToolbarField {
  const fields = blsToolbarFields(gamepadConnected);
  return fields.includes(field) ? field : "speed1";
}
