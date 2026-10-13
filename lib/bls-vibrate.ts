import type { VibrationMode } from "@/lib/types";
import { rumble } from "@/lib/gamepad";

/** Patterns for navigator.vibrate. iOS Safari ignores the call. */
export const DEVICE_VIBRATE_MS: Record<VibrationMode, number | number[]> = {
  off: 0,
  subtle: 12,
  soft: 28,
  normal: [40, 30, 55],
};

export function deviceVibrationSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return !iOS;
}

/** Gamepad rumble plus a phone vibration, when the browser allows it. */
export function pulseVibration(mode: VibrationMode) {
  if (mode === "off") return;
  rumble(mode);
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(DEVICE_VIBRATE_MS[mode]);
  } catch {
    // iOS Safari throws or no-ops. The adjustments copy says so.
  }
}
