import type { AnimationPath, BrightenFlashes } from "@/lib/types";
import { blsBackgroundIsDark } from "@/lib/bls-prefs";

/** Axis for bilateral ball motion from viewport aspect. */

export type BlsMotionAxis = "horizontal" | "vertical";

/** A path the ball can actually travel. `auto` and `random` resolve to one of these. */
export type ConcreteAnimationPath =
  | "horizontal"
  | "diagonal-up"
  | "diagonal-down"
  | "vertical";

export const CONCRETE_ANIMATION_PATHS: readonly ConcreteAnimationPath[] = [
  "horizontal",
  "diagonal-up",
  "diagonal-down",
  "vertical",
];

export function pickRandomAnimationPath(
  rng: () => number = Math.random
): ConcreteAnimationPath {
  const index = Math.floor(rng() * CONCRETE_ANIMATION_PATHS.length);
  return (
    CONCRETE_ANIMATION_PATHS[
      Math.min(CONCRETE_ANIMATION_PATHS.length - 1, Math.max(0, index))
    ] ?? "horizontal"
  );
}

/** Resolve auto (screen aspect) and random (caller-supplied pick) to a straight path. */
export function resolveAnimationPath(
  path: AnimationPath,
  width: number,
  height: number,
  randomPick: ConcreteAnimationPath | null = null
): ConcreteAnimationPath {
  if (path === "random") return randomPick ?? "horizontal";
  if (path === "auto") {
    return motionAxisFromSize(width, height) === "vertical" ? "vertical" : "horizontal";
  }
  return path;
}

/**
 * Top-left of the circle inside the travel box (container size minus the circle).
 * Horizontal and vertical stay centered on the other axis.
 * Diagonal up runs bottom-left to top-right. Diagonal down runs top-left to bottom-right.
 */
export function ballTravelOffset(
  path: ConcreteAnimationPath,
  pos: number,
  travelX: number,
  travelY: number
): { x: number; y: number } {
  const p = Math.min(1, Math.max(0, pos));
  switch (path) {
    case "horizontal":
      return { x: p * travelX, y: travelY / 2 };
    case "vertical":
      return { x: travelX / 2, y: p * travelY };
    case "diagonal-up":
      return { x: p * travelX, y: (1 - p) * travelY };
    case "diagonal-down":
      return { x: p * travelX, y: p * travelY };
  }
}

/** Clip for the start end and the far end of a pass. */
export function flashClipPaths(path: ConcreteAnimationPath): {
  start: string;
  end: string;
} {
  switch (path) {
    case "horizontal":
      return { start: "inset(0 50% 0 0)", end: "inset(0 0 0 50%)" };
    case "vertical":
      return { start: "inset(0 0 50% 0)", end: "inset(50% 0 0 0)" };
    case "diagonal-up":
      return {
        start: "polygon(0% 0%, 0% 100%, 100% 100%)",
        end: "polygon(0% 0%, 100% 0%, 100% 100%)",
      };
    case "diagonal-down":
      return {
        start: "polygon(0% 0%, 100% 0%, 0% 100%)",
        end: "polygon(100% 0%, 100% 100%, 0% 100%)",
      };
  }
}

/**
 * Lift a #rrggbb flash toward white while keeping most of its hue.
 * Already-white (and any mix that rounds to white) stays #ffffff.
 * Anything that is not #rrggbb is returned unchanged.
 */
export function brightenFlashColor(hex: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  const keep = 0.62;
  const mix = (channel: number) => Math.round(channel * keep + 255 * (1 - keep));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  const byte = (channel: number) =>
    Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * Paint one half of a flash.
 *
 * Off always uses flashColor (stronger on the lit half).
 * Standard still brightens: the lit half is flashColor lifted toward white,
 * and that result is pure white only when the chosen color is already white.
 * The resting half stays flashColor, softer on a light background and hidden
 * on a dark one, so the set is never forced to black and white.
 */
export function flashPaint(
  brighten: BrightenFlashes,
  flashColor: string,
  active: boolean,
  background = "#ffffff"
): { color: string; opacity: string } {
  if (brighten === "standard") {
    if (active) return { color: brightenFlashColor(flashColor), opacity: "1" };
    return blsBackgroundIsDark(background)
      ? { color: flashColor, opacity: "0" }
      : { color: flashColor, opacity: "0.28" };
  }
  return { color: flashColor, opacity: active ? "0.55" : "0.08" };
}

/**
 * Sweep along the longer edge so the ball travels edge-to-edge:
 * landscape (wide) → left/right; portrait (tall) → top/bottom.
 */
export function motionAxisFromSize(
  width: number,
  height: number
): BlsMotionAxis {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "horizontal";
  if (width <= 0 || height <= 0) return "horizontal";
  return width >= height ? "horizontal" : "vertical";
}
