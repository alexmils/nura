/**
 * Colours for the landscape-phone voice beam (voice-glow VoiceBeam around
 * the chat's voice pill), per voice state: an iridescent golden-yellow + lime
 * + green mix (the user asked for yellow and green here so it stands out on
 * the pale green page). Speaking is the most vivid. Pure, so the cross-fade
 * between states and the edge intensity are unit-tested.
 */
import type { VoiceOrbState } from "./voice-orb-env";

export type BeamBand = { core: string; above: string; mid: string; below: string };

export type BeamPalette = {
  /** Up to 7 lobe colours, centre first then the pairs outward. */
  colors: string[];
  bandColors: BeamBand;
  /** Effect opacity, 0..1. */
  strength: number;
  /** Resting breath while silent, 0..1. */
  idle: number;
};

export const BEAM_PALETTES: Record<VoiceOrbState, BeamPalette> = {
  // Faint, warm-sage rest (muted / mic paused / starting).
  idle: {
    colors: ["#efe4a8", "#cfe6a8", "#e8dc96", "#b6d79a", "#f3ebc0", "#a9cc8c", "#e2e8b4"],
    bandColors: { core: "#efe4a8", above: "#f3ebc0", mid: "#cfe6a8", below: "#a9cc8c" },
    strength: 0.35,
    idle: 0.12,
  },
  // Golden yellow + lime, medium.
  listening: {
    colors: ["#ffe970", "#9be84a", "#f5d742", "#3fae4f", "#c8f27a", "#2f8a22", "#ffd84a"],
    bandColors: { core: "#ffe970", above: "#f5d742", mid: "#9be84a", below: "#3fae4f" },
    strength: 0.85,
    idle: 0.3,
  },
  // Greener, the beam travels (motion).
  thinking: {
    colors: ["#9be84a", "#f5d742", "#3fae4f", "#ffe970", "#2f8a22", "#c8f27a", "#4fc46a"],
    bandColors: { core: "#c8f27a", above: "#ffe970", mid: "#4fc46a", below: "#2f7a45" },
    strength: 0.8,
    idle: 0.3,
  },
  // Most vivid: saturated gold into lime and deep green.
  speaking: {
    colors: ["#f5d742", "#ffe970", "#9be84a", "#3fae4f", "#5ed42a", "#2f8a22", "#ffd84a"],
    bandColors: { core: "#ffe970", above: "#f5d742", mid: "#5ed42a", below: "#2f8a22" },
    strength: 1,
    idle: 0.35,
  },
};

/**
 * Opacity of the animated gradient edge around the pill for a state and the
 * beam's smoothed level (0..1). Speaking brightest, listening medium,
 * thinking a steady travelling highlight, idle / muted faint and static.
 */
export function edgeIntensity(state: VoiceOrbState, level: number): number {
  const l = clamp01(level);
  switch (state) {
    case "speaking":
      return 0.6 + 0.4 * l;
    case "listening":
      return 0.38 + 0.42 * l;
    case "thinking":
      return 0.7;
    default:
      return 0.22;
  }
}

/** Reduced motion: a still, faint glow whatever the state. */
export const REDUCED_MOTION_STRENGTH = 0.3;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/** Linear mix of two #rgb / #rrggbb colours; t = 0 gives a, 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const k = clamp01(t);
  const pa = parseHex(a);
  const pb = parseHex(b);
  return (
    "#" +
    pa
      .map((v, i) => Math.round(v + (pb[i]! - v) * k).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Cross-fade between two palettes (colours, band, strength, idle). */
export function blendPalette(from: BeamPalette, to: BeamPalette, t: number): BeamPalette {
  const k = clamp01(t);
  const n = Math.max(from.colors.length, to.colors.length);
  const colors: string[] = [];
  for (let i = 0; i < n; i++) {
    colors.push(mixHex(from.colors[i] ?? to.colors[i]!, to.colors[i] ?? from.colors[i]!, k));
  }
  const band = (key: keyof BeamBand) => mixHex(from.bandColors[key], to.bandColors[key], k);
  return {
    colors,
    bandColors: { core: band("core"), above: band("above"), mid: band("mid"), below: band("below") },
    strength: from.strength + (to.strength - from.strength) * k,
    idle: from.idle + (to.idle - from.idle) * k,
  };
}

/** Smoothstep easing for the state cross-fade. */
export function easeBeam(t: number): number {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
}
