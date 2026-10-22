/**
 * Nura motion system — one source of truth for timings, easing, stagger and
 * presets across the marketing frontend.
 *
 * The point (learned from the alexandermils studio site) is that an animation
 * should name its tokens, never invent numbers. Every reveal, hand-off and page
 * transition reads from here, so the brand stays legible and consistent as new
 * sections are added.
 *
 * Pure data, no React. Mirrored as CSS custom properties in
 * `app/components/motion/motion.css` (`--mo-*`).
 */

export type MotionPreset = "soft" | "bold" | "minimal" | "off";

export type EntranceEffect =
  | "fadeUp"
  | "fadeDown"
  | "fadeLeft"
  | "fadeRight"
  | "zoomIn"
  | "blur";

/** Seconds. */
export const MOTION_DURATION = {
  instant: 0.18,
  fast: 0.28,
  base: 0.55,
  slow: 0.9,
  slower: 1.35,
} as const;

export type Ease = readonly [number, number, number, number];

export const MOTION_EASE = {
  /** Expo-out — arrivals, reveals, cards settling in. */
  out: [0.22, 1, 0.36, 1],
  /** Symmetric in-out — page transitions, curtains, wipes. */
  inOut: [0.87, 0, 0.13, 1],
  /** Gentle material — hovers, chrome, control feedback. */
  soft: [0.4, 0, 0.2, 1],
  /** The wave lift — preloader, brand-wave motion, rising panels. */
  wave: [0.76, 0, 0.24, 1],
  /** Slight overshoot — playful accents, counters landing. */
  pop: [0.34, 1.56, 0.64, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, Ease>;

export type MotionEaseName = keyof typeof MOTION_EASE;

/** Seconds between siblings. */
export const MOTION_STAGGER = {
  tight: 0.03,
  base: 0.045,
  loose: 0.09,
} as const;

export const ENTRANCE_EFFECTS: EntranceEffect[] = [
  "fadeUp",
  "fadeDown",
  "fadeLeft",
  "fadeRight",
  "zoomIn",
  "blur",
];

export const ENTRANCE_EFFECT_OPTIONS: Array<{
  value: EntranceEffect;
  label: string;
  description: string;
}> = [
  { value: "fadeUp", label: "Fade up", description: "Rise into place (default)." },
  { value: "fadeDown", label: "Fade down", description: "Drop into place from above." },
  { value: "fadeLeft", label: "Fade left", description: "Slide in from the right." },
  { value: "fadeRight", label: "Fade right", description: "Slide in from the left." },
  { value: "zoomIn", label: "Zoom in", description: "Scale up from smaller." },
  { value: "blur", label: "Blur in", description: "Fade in while unblurring." },
];

export const MOTION_PRESETS: MotionPreset[] = ["soft", "bold", "minimal", "off"];

export const MOTION_PRESET_OPTIONS: Array<{
  value: MotionPreset;
  label: string;
  description: string;
}> = [
  { value: "soft", label: "Soft", description: "Gentle intensity — the Nura default." },
  { value: "bold", label: "Bold", description: "Stronger travel and a slight scale-in." },
  { value: "minimal", label: "Minimal", description: "Shorter, subtler motion." },
  { value: "off", label: "Off", description: "No entrance animations." },
];

type PresetIntensity = {
  enabled: boolean;
  yMul: number;
  durationMul: number;
  scale: number | null;
  staggerStep: number;
};

const PRESET_INTENSITY: Record<MotionPreset, PresetIntensity> = {
  soft: { enabled: true, yMul: 1, durationMul: 1, scale: null, staggerStep: MOTION_STAGGER.base },
  bold: { enabled: true, yMul: 1.35, durationMul: 1.05, scale: 0.96, staggerStep: MOTION_STAGGER.loose },
  minimal: { enabled: true, yMul: 0.45, durationMul: 0.65, scale: null, staggerStep: MOTION_STAGGER.tight },
  off: { enabled: false, yMul: 0, durationMul: 0, scale: null, staggerStep: 0 },
};

/** Baseline travel for a reveal, in px, before preset intensity. */
const REVEAL_TRAVEL_PX = 34;

export type RevealConfig = {
  enabled: boolean;
  x: number;
  y: number;
  duration: number;
  scale: number | null;
  blurPx: number | null;
  ease: Ease;
  staggerStep: number;
};

/**
 * Resolve a preset + entrance effect into concrete reveal numbers. Everything
 * the `Reveal` / `StaggerText` components need lives here.
 */
export function getRevealConfig(
  preset: MotionPreset = "soft",
  entry: EntranceEffect = "fadeUp"
): RevealConfig {
  const intensity = PRESET_INTENSITY[preset];
  if (!intensity.enabled) {
    return {
      enabled: false,
      x: 0,
      y: 0,
      duration: 0,
      scale: null,
      blurPx: null,
      ease: MOTION_EASE.out,
      staggerStep: 0,
    };
  }

  const travel = Math.round(REVEAL_TRAVEL_PX * intensity.yMul);
  const duration = MOTION_DURATION.base * intensity.durationMul;

  let x = 0;
  let y = travel;
  let scale = intensity.scale;
  let blurPx: number | null = null;

  switch (entry) {
    case "fadeUp":
      y = travel;
      break;
    case "fadeDown":
      y = -travel;
      break;
    case "fadeLeft":
      x = travel;
      y = 0;
      break;
    case "fadeRight":
      x = -travel;
      y = 0;
      break;
    case "zoomIn":
      y = Math.round(travel * 0.35);
      scale = intensity.scale ?? 0.9;
      break;
    case "blur":
      y = Math.round(travel * 0.55);
      blurPx = preset === "minimal" ? 6 : 12;
      break;
  }

  return {
    enabled: true,
    x,
    y,
    duration,
    scale,
    blurPx,
    ease: MOTION_EASE.out,
    staggerStep: intensity.staggerStep,
  };
}

export function isMotionPreset(value: unknown): value is MotionPreset {
  return typeof value === "string" && (MOTION_PRESETS as readonly string[]).includes(value);
}

export function parseMotionPreset(value: unknown): MotionPreset {
  return isMotionPreset(value) ? value : "soft";
}
