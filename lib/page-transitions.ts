/**
 * The Nura page-transition library — data only.
 *
 * One transition is active site-wide (Admin → Customisation → Page transitions
 * later) and runs on every route change in the marketing shell: cover, the
 * route swaps underneath, reveal. Every transition is built from the pistachio
 * palette only (mint #A4EDA5, pistachio #C6D67E, sage #84B067, olive-ink
 * #3D4129, ink #2A3020, ground #EDF9ED, white).
 *
 * Renderer: `app/components/motion/PageTransitionOverlay.tsx` +
 * `app/components/motion/page-transitions.css` (`.mo-pt[data-pt=…]`).
 */

export const PAGE_TRANSITIONS = [
  "none",
  "fade",
  "blurDissolve",
  "waveSweep",
  "mintCurtain",
  "sageColumns",
  "stackUp",
  "doors",
  "iris",
  "dots",
  "logoFlash",
] as const;

export type PageTransition = (typeof PAGE_TRANSITIONS)[number];

export const PAGE_TRANSITION_OPTIONS: Array<{
  value: PageTransition;
  label: string;
  description: string;
}> = [
  { value: "fade", label: "Fade through mint", description: "The mint ground fades in and out. The quietest option." },
  { value: "blurDissolve", label: "Blur dissolve", description: "The old page frosts into a blur, the new one sharpens out of it." },
  { value: "waveSweep", label: "Wave sweep", description: "A sage panel with the Nura wave edge sweeps across the page." },
  { value: "mintCurtain", label: "Mint curtain", description: "A mint curtain rises over the page and carries on up." },
  { value: "sageColumns", label: "Sage columns", description: "Five sage columns drop in with a stagger and fall away." },
  { value: "stackUp", label: "Stacked panels", description: "Mint, pistachio and sage panels slide up one after another." },
  { value: "doors", label: "Split doors", description: "Two olive-ink doors close from the sides and open again." },
  { value: "iris", label: "Shutter iris", description: "A soft aperture closes to ink and opens on the new page." },
  { value: "dots", label: "Pistachio dots", description: "A field of pistachio dots grows from the centre and dissolves." },
  { value: "logoFlash", label: "Logo flash", description: "The mint ground fades in with the wave lockup centred for a beat." },
  { value: "none", label: "None", description: "Instant page swap, no overlay." },
];

/** Cover / reveal durations in ms. */
export const TRANSITION_TIMING: Record<
  Exclude<PageTransition, "none">,
  { cover: number; reveal: number }
> = {
  fade: { cover: 320, reveal: 460 },
  blurDissolve: { cover: 380, reveal: 520 },
  waveSweep: { cover: 520, reveal: 560 },
  mintCurtain: { cover: 480, reveal: 520 },
  sageColumns: { cover: 560, reveal: 540 },
  stackUp: { cover: 560, reveal: 560 },
  doors: { cover: 480, reveal: 520 },
  iris: { cover: 560, reveal: 560 },
  dots: { cover: 480, reveal: 520 },
  logoFlash: { cover: 420, reveal: 520 },
};

/** The shop / app flows run the transition one notch quicker. */
export const FAST_FACTOR = 0.55;

export const DEFAULT_PAGE_TRANSITION: PageTransition = "waveSweep";

export function isPageTransition(value: unknown): value is PageTransition {
  return typeof value === "string" && (PAGE_TRANSITIONS as readonly string[]).includes(value);
}

export function parsePageTransition(value: unknown): PageTransition {
  return isPageTransition(value) ? value : DEFAULT_PAGE_TRANSITION;
}

export type TransitionPhase = "cover" | "reveal";

/** Layers a given transition renders. Static markup; CSS animates it. */
export type TransitionLayer = {
  key: string;
  className?: string;
  /** Inline CSS custom properties for staggering (e.g. { "--i": "3" }). */
  style?: Record<string, string | number>;
};

export function transitionLayers(kind: Exclude<PageTransition, "none">): TransitionLayer[] {
  switch (kind) {
    case "fade":
      return [{ key: "ground", className: "mo-pt-fade" }];
    case "blurDissolve":
      return [{ key: "veil", className: "mo-pt-veil" }];
    case "waveSweep":
      return [{ key: "panel", className: "mo-pt-wave" }];
    case "mintCurtain":
      return [{ key: "curtain", className: "mo-pt-curtain" }];
    case "sageColumns":
      return Array.from({ length: 5 }, (_, i) => ({
        key: `col-${i}`,
        className: "mo-pt-col",
        style: { "--i": i },
      }));
    case "stackUp":
      return [0, 1, 2].map((i) => ({
        key: `s${i}`,
        className: `mo-pt-stack mo-pt-stack-${i}`,
        style: { "--i": i },
      }));
    case "doors":
      return [
        { key: "l", className: "mo-pt-door mo-pt-door-l" },
        { key: "r", className: "mo-pt-door mo-pt-door-r" },
      ];
    case "iris":
      return [{ key: "iris", className: "mo-pt-iris" }];
    case "dots":
      return Array.from({ length: 25 }, (_, i) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const dist = Math.hypot(row - 2, col - 2);
        return {
          key: `dot-${i}`,
          className: "mo-pt-dot",
          style: { "--x": col, "--y": row, "--d": dist.toFixed(2) },
        };
      });
    case "logoFlash":
      return [
        { key: "bg", className: "mo-pt-fade" },
        { key: "logo", className: "mo-pt-logo" },
      ];
  }
}
