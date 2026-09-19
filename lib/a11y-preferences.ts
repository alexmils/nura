/**
 * Accessibility preferences for the floating Nura widget.
 *
 * Preferences are applied as data attributes on `<html>` so the CSS can react
 * without React re-rendering every component. They live in localStorage (not
 * the account) so guests on the marketing site get them too, and a tiny
 * bootstrap script applies them before first paint (see
 * `a11yBootstrapScript`).
 */

export const A11Y_STORAGE_KEY = "nura.a11y.v1";
/** Saved dock state of the floating widget (edge, vertical center, folded). */
export const A11Y_DOCK_STORAGE_KEY = "nura.a11y.dock.v1";

/** Text size steps, smallest first. Index is what we store. */
export const A11Y_TEXT_STEPS = [0, 1, 2, 3] as const;
export type A11yTextStep = (typeof A11Y_TEXT_STEPS)[number];

export interface A11yPreferences {
  /** 0 = the size the app ships with. 3 = largest. */
  textSize: A11yTextStep;
  /** Darker text, stronger borders, higher contrast actions. */
  highContrast: boolean;
  /** Taller buttons and form fields. */
  largeTargets: boolean;
  /** Roomier line height and letter spacing for long text. */
  readableSpacing: boolean;
  /** Underline every link in body copy. */
  underlineLinks: boolean;
  /** Stop looping animation and smooth scrolling. */
  reduceMotion: boolean;
}

export const DEFAULT_A11Y_PREFERENCES: A11yPreferences = {
  textSize: 0,
  highContrast: false,
  largeTargets: false,
  readableSpacing: false,
  underlineLinks: false,
  reduceMotion: false,
};

/** Attribute names on `<html>`. Single source of truth for CSS + bootstrap. */
export const A11Y_ATTRIBUTES = {
  textSize: "data-a11y-text",
  highContrast: "data-a11y-contrast",
  largeTargets: "data-a11y-targets",
  readableSpacing: "data-a11y-spacing",
  underlineLinks: "data-a11y-links",
  reduceMotion: "data-a11y-motion",
} as const;

export type A11yAttributeName =
  (typeof A11Y_ATTRIBUTES)[keyof typeof A11Y_ATTRIBUTES];

/** Value for each attribute; `null` means "leave the default styling alone". */
export function a11yAttributeValues(
  prefs: A11yPreferences
): Record<A11yAttributeName, string | null> {
  return {
    [A11Y_ATTRIBUTES.textSize]: prefs.textSize > 0 ? String(prefs.textSize) : null,
    [A11Y_ATTRIBUTES.highContrast]: prefs.highContrast ? "high" : null,
    [A11Y_ATTRIBUTES.largeTargets]: prefs.largeTargets ? "large" : null,
    [A11Y_ATTRIBUTES.readableSpacing]: prefs.readableSpacing ? "on" : null,
    [A11Y_ATTRIBUTES.underlineLinks]: prefs.underlineLinks ? "on" : null,
    [A11Y_ATTRIBUTES.reduceMotion]: prefs.reduceMotion ? "reduced" : null,
  };
}

function clampTextStep(value: unknown): A11yTextStep {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return 0;
  const max = A11Y_TEXT_STEPS.length - 1;
  return Math.min(Math.max(n, 0), max) as A11yTextStep;
}

/**
 * Validate anything that came back from storage. Unknown or malformed input
 * falls back to defaults instead of throwing, so a stale value can never
 * break the app.
 */
export function parseA11yPreferences(raw: unknown): A11yPreferences {
  if (!raw) return { ...DEFAULT_A11Y_PREFERENCES };
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_A11Y_PREFERENCES };
    }
  }
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_A11Y_PREFERENCES };
  }
  const o = value as Record<string, unknown>;
  return {
    textSize: clampTextStep(o.textSize),
    highContrast: o.highContrast === true,
    largeTargets: o.largeTargets === true,
    readableSpacing: o.readableSpacing === true,
    underlineLinks: o.underlineLinks === true,
    reduceMotion: o.reduceMotion === true,
  };
}

/** True when nothing is customised (used to hide the "Reset" affordance). */
export function isDefaultA11yPreferences(prefs: A11yPreferences): boolean {
  return (
    prefs.textSize === DEFAULT_A11Y_PREFERENCES.textSize &&
    !prefs.highContrast &&
    !prefs.largeTargets &&
    !prefs.readableSpacing &&
    !prefs.underlineLinks &&
    !prefs.reduceMotion
  );
}

/** Count of active settings, for the button badge. */
export function activeA11yCount(prefs: A11yPreferences): number {
  let count = prefs.textSize > 0 ? 1 : 0;
  if (prefs.highContrast) count += 1;
  if (prefs.largeTargets) count += 1;
  if (prefs.readableSpacing) count += 1;
  if (prefs.underlineLinks) count += 1;
  if (prefs.reduceMotion) count += 1;
  return count;
}

/**
 * Apply preferences to the document root. Attributes are removed (not set to
 * an empty value) when a preference is off, so the shipped CSS stays in charge.
 */
export function applyA11yPreferences(
  prefs: A11yPreferences,
  root: HTMLElement
): void {
  const values = a11yAttributeValues(prefs);
  for (const [name, value] of Object.entries(values)) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

/**
 * Inline script for `<head>`: applies saved preferences before first paint so
 * the page never flashes at the wrong text size. Kept in the same module as the
 * attribute map so the two cannot drift (see the test that renders it).
 */
export function a11yBootstrapScript(): string {
  return [
    "(function(){try{",
    `var raw=localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)});`,
    "if(!raw)return;",
    "var p=JSON.parse(raw);",
    "if(!p||typeof p!=='object')return;",
    `var map=${JSON.stringify(A11Y_ATTRIBUTES)};`,
    "var out={};",
    "var step=typeof p.textSize==='number'?Math.round(p.textSize):0;",
    "out[map.textSize]=step>0?String(Math.min(step,3)):null;",
    "out[map.highContrast]=p.highContrast===true?'high':null;",
    "out[map.largeTargets]=p.largeTargets===true?'large':null;",
    "out[map.readableSpacing]=p.readableSpacing===true?'on':null;",
    "out[map.underlineLinks]=p.underlineLinks===true?'on':null;",
    "out[map.reduceMotion]=p.reduceMotion===true?'reduced':null;",
    "var d=document.documentElement;",
    "for(var k in out){if(out[k]===null){d.removeAttribute(k);}else{d.setAttribute(k,out[k]);}}",
    "}catch(e){}})();",
  ].join("");
}

/** Floating button edge-dock state (replaces the old free-float x/y). */
export type A11yDockEdge = "left" | "right";

export interface A11yDock {
  /** Docked edge. null = follow the surface default passed by the shell. */
  edge: A11yDockEdge | null;
  /** Vertical center in viewport px. null = centered. */
  centerY: number | null;
  /** True = folded to a ribbon peeking out of the screen edge. */
  collapsed: boolean;
}

export const DEFAULT_A11Y_DOCK: A11yDock = {
  edge: null,
  centerY: null,
  // Folded by default: the widget is a quiet ribbon until it is asked for.
  collapsed: true,
};

/**
 * Size of the mark button, and of the folded ribbon it sits behind.
 * The ribbon is a tall half-pill peeking out of the edge.
 */
export const A11Y_FAB_SIZE = 52;
export const A11Y_RIBBON_W = 30;
export const A11Y_RIBBON_H = 88;
const A11Y_EDGE_MARGIN = 10;

/** Validate anything from storage; malformed input falls back to defaults. */
export function parseA11yDock(raw: unknown): A11yDock {
  if (!raw) return { ...DEFAULT_A11Y_DOCK };
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_A11Y_DOCK };
    }
  }
  if (!value || typeof value !== "object") return { ...DEFAULT_A11Y_DOCK };
  const o = value as Record<string, unknown>;
  const edge = o.edge === "left" || o.edge === "right" ? o.edge : null;
  const centerY =
    typeof o.centerY === "number" && Number.isFinite(o.centerY)
      ? o.centerY
      : null;
  return { edge, centerY, collapsed: o.collapsed !== false };
}

/**
 * Keep the widget's vertical center inside the viewport. Clamped against the
 * ribbon height (the taller of the two states) so the mark button can never
 * end up off screen when the widget expands. `bottomInset` reserves room for a
 * full-width bottom bar (cookie consent) when one is on screen.
 */
export function clampA11yCenterY(
  centerY: number,
  viewportHeight: number,
  size = A11Y_RIBBON_H,
  bottomInset = 0
): number {
  const half = size / 2;
  const min = half + A11Y_EDGE_MARGIN;
  const max = viewportHeight - half - A11Y_EDGE_MARGIN - Math.max(0, bottomInset);
  if (max <= min) return Math.round(viewportHeight / 2);
  return Math.min(Math.max(centerY, min), max);
}

/** Which edge a pointer x is closer to, so a folded ribbon can be re-docked. */
export function a11yEdgeForX(x: number, viewportWidth: number): A11yDockEdge {
  return x < viewportWidth / 2 ? "left" : "right";
}

/**
 * Whether the person asked for less motion in the Nura panel. Read from the
 * attribute the bootstrap script writes, so it is already correct on mount
 * (used by JS-driven motion such as the landing GSAP timeline).
 */
export function isA11yReduceMotionPreferred(
  root?: { getAttribute: (name: string) => string | null } | null
): boolean {
  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!target) return false;
  return target.getAttribute(A11Y_ATTRIBUTES.reduceMotion) === "reduced";
}
