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
/** Saved position of the floating button, in viewport pixels. */
export const A11Y_FAB_STORAGE_KEY = "nura.a11y.fab.v1";

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

/** Floating button position in viewport pixels (top-left corner). */
export interface A11yFabPosition {
  x: number;
  y: number;
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

/** Button box used when clamping a dragged position. */
export const A11Y_FAB_SIZE = 52;
const A11Y_FAB_MARGIN = 10;

export function parseA11yFabPosition(raw: unknown): A11yFabPosition | null {
  if (!raw) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Keep the button fully on screen. The bottom edge is clamped harder so it
 * never lands on the phone home indicator.
 */
export function clampA11yFabPosition(
  position: A11yFabPosition,
  viewport: { width: number; height: number },
  size = A11Y_FAB_SIZE
): A11yFabPosition {
  const maxX = Math.max(A11Y_FAB_MARGIN, viewport.width - size - A11Y_FAB_MARGIN);
  const maxY = Math.max(A11Y_FAB_MARGIN, viewport.height - size - A11Y_FAB_MARGIN);
  return {
    x: Math.min(Math.max(position.x, A11Y_FAB_MARGIN), maxX),
    y: Math.min(Math.max(position.y, A11Y_FAB_MARGIN), maxY),
  };
}
