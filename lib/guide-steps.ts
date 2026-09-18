/**
 * Guided product tour ("Guide").
 *
 * Pure data + storage helpers so the step list can be unit tested without a DOM.
 * The spotlight engine lives in `app/components/guide/ProductGuide.tsx`.
 */

import { APP_BASE, appPath } from "./app-base";

export type GuidePlacement = "top" | "bottom" | "left" | "right" | "center";

/** Host actions the engine can ask the mounted app shell to perform. */
export const GUIDE_ACTIONS = [
  "openSidebar",
  "openAccountMenu",
  "closeAccountMenu",
  "ensurePendingThread",
  "chooseSelfGuided",
  "chooseGuided",
  "openGear",
  "openGearSection",
  "closeGear",
  "stopSet",
  "showHome",
  "wait",
] as const;

export type GuideAction = (typeof GUIDE_ACTIONS)[number];

/** Collapsible sections of the adjustments sheet. */
export type GuideGearSection =
  | "speed"
  | "repeats"
  | "sound"
  | "animation"
  | "look"
  | "vibration";

export const GUIDE_GEAR_SECTIONS: readonly GuideGearSection[] = [
  "speed",
  "repeats",
  "sound",
  "animation",
  "look",
  "vibration",
];

/** A simulation the engine renders over a real target (see the step card). */
export type GuideDemo = "voice";

/**
 * Steps that need a real session. They are skipped together when the person
 * cannot start one yet (no consent, trial caps, payment pending).
 */
export type GuideStepGroup = "session";

export type GuideStep = {
  id: string;
  /** Route the step belongs to. The engine routes there before it measures. */
  surface: string;
  /** CSS selector for the spotlight target. Absent = centered card. */
  target?: string;
  placement: GuidePlacement;
  /** Small mono label above the title. */
  kicker?: string;
  title: string;
  body: string;
  /** Primary button label. Defaults to "Next" (last step: "Done"). */
  cta?: string;
  demo?: GuideDemo;
  /** Extra px between the spotlight edge and the card (room for a demo). */
  cardOffset?: number;
  group?: GuideStepGroup;
  /** Runs before the step is shown. A falsy result skips the group. */
  prepare?: GuideAction[];
  /** Section to expand when the step uses the `openGearSection` action. */
  gearSection?: GuideGearSection;
  /** Runs when leaving the step (e.g. close a menu the tour opened). */
  cleanup?: GuideAction[];
  /** Primary button becomes "finish": run these, then end the tour. */
  finishActions?: GuideAction[];
};

const RESOURCES_PATH = appPath("/resources");

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "welcome",
    surface: APP_BASE,
    placement: "center",
    kicker: "Guide",
    title: "A short tour of Nura",
    body: "I will point at each part of the app: sessions, your visual set, sound, session controls, the controller, and the resource library. You can leave at any time.",
    cta: "Start",
  },
  {
    id: "new-chat",
    surface: APP_BASE,
    target: '[data-guide="new-chat"]',
    placement: "right",
    kicker: "Sessions",
    title: "Start here",
    body: "New chat opens a fresh session. Every session keeps its own thread, so you can step away and pick it up later.",
    prepare: ["openSidebar"],
  },
  {
    id: "threads",
    surface: APP_BASE,
    target: '[data-guide="threads"]',
    placement: "right",
    kicker: "Sessions",
    title: "Your session list",
    body: "Past sessions stay listed here. Open one to continue it, or press and hold to rename or delete it.",
    prepare: ["openSidebar"],
  },
  {
    id: "nav",
    surface: APP_BASE,
    target: '[data-guide="nav-resources"]',
    placement: "right",
    kicker: "Navigation",
    title: "Home and Resources",
    body: "Home brings you back to this screen at any time. Resources opens the library of short guides.",
    prepare: ["openSidebar"],
  },
  {
    id: "account",
    surface: APP_BASE,
    target: '[data-guide="guide-item"]',
    placement: "right",
    kicker: "Your account",
    title: "Settings, Billing, Help, and this Guide",
    body: "Your account menu holds Settings, Billing, and Help. Guide sits right here, and it always starts this tour again from the first step.",
    prepare: ["openSidebar", "openAccountMenu"],
    cleanup: ["closeAccountMenu"],
  },
  {
    id: "mode",
    surface: APP_BASE,
    target: '[data-guide="mode-cards"]',
    placement: "top",
    kicker: "Session types",
    title: "Two ways to run a session",
    body: "An AI agent-guided session walks the phases with you and checks in after each set. A Self-guided session is a set you run yourself, with no agent and no chat.",
    group: "session",
    prepare: ["stopSet", "ensurePendingThread"],
  },
  {
    id: "canvas",
    surface: APP_BASE,
    target: '[data-guide="canvas"]',
    placement: "top",
    kicker: "Self-guided",
    title: "Your visual set",
    body: "This is where the set plays: dot or flash, with sound and optional rumble. Press Space to start and pause. You set the speed and how long it runs.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "dock-speed",
    surface: APP_BASE,
    target: '[data-guide-field="speed"]',
    placement: "top",
    kicker: "Session controls",
    title: "Speed",
    body: "Three speeds, slow to quick. Try them and keep what feels comfortable, not what looks fastest.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "dock-repeats",
    surface: APP_BASE,
    target: '[data-guide-field="repeats"]',
    placement: "top",
    kicker: "Session controls",
    title: "Repeats",
    body: "Set how many rounds run before a pause, or leave it endless with the infinity button.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "dock-sound",
    surface: APP_BASE,
    target: '[data-guide-field="sound"]',
    placement: "top",
    kicker: "Session controls",
    title: "Sound",
    body: "Mute, click, pulse, or a soft tone. You hear it while the set runs, so pick what feels least distracting.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "dock-animation",
    surface: APP_BASE,
    target: '[data-guide-field="animation"]',
    placement: "top",
    kicker: "Session controls",
    title: "Animation",
    body: "Dot moves a visual guide across the screen. Flash highlights each side instead. Keep whichever is easier to follow.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "joystick",
    surface: APP_BASE,
    target: '[data-guide-field="vibration"]',
    placement: "top",
    kicker: "Controller",
    title: "Joystick and tappers",
    body: "Connect a joystick, tappers, or a gamepad and this control turns on: Off, Soft, or Hard rumble when the visual guide reaches each edge. Until then it reads Disconnected. The main button starts and pauses, and the stick or D-pad moves between controls.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "dock-adjustments",
    surface: APP_BASE,
    target: '[data-guide-field="adjustments"]',
    placement: "top",
    kicker: "Session controls",
    title: "Adjustments",
    body: "This button opens everything behind the bar: ball colour, ball size, background, and the rest of the session settings.",
    group: "session",
    prepare: ["chooseSelfGuided"],
  },
  {
    id: "gear-panel",
    surface: APP_BASE,
    target: '[data-gear-section="look"]',
    placement: "top",
    kicker: "Session controls",
    title: "Look",
    body: "Ball colour, ball size, and background, with speed, repeats, sound, and set length in the sections above. What you pick here is remembered on this device.",
    group: "session",
    gearSection: "look",
    prepare: ["openGearSection"],
    cleanup: ["closeGear"],
  },
  {
    id: "composer",
    surface: APP_BASE,
    target: '[data-guide="composer"]',
    placement: "top",
    kicker: "AI agent-guided",
    title: "Talk to your guide",
    body: "In an AI agent-guided session you write here, or use the microphone to dictate. The guide answers in the language you write in, and checks in after each set. Watch:",
    demo: "voice",
    cardOffset: 168,
    group: "session",
    prepare: ["chooseGuided"],
  },
  {
    id: "resources-watch",
    surface: RESOURCES_PATH,
    target: '[data-guide="resources-watch"]',
    placement: "bottom",
    kicker: "Resources",
    title: "Watch and learn",
    body: "A short walkthrough that shows the session screen and where each control sits.",
  },
  {
    id: "resources-read",
    surface: RESOURCES_PATH,
    target: '[data-guide="resources-read"]',
    placement: "bottom",
    kicker: "Resources",
    title: "Read",
    body: "Short reads: what EMDR is, grounding before a set, when to pause, and how the two session types differ.",
  },
  {
    id: "resources-safety",
    surface: RESOURCES_PATH,
    target: '[data-guide="resources-safety"]',
    placement: "bottom",
    kicker: "Resources",
    title: "Safety",
    body: "When to stop and get real help, with crisis lines for your country.",
  },
  {
    id: "finish",
    surface: RESOURCES_PATH,
    placement: "center",
    kicker: "Guide",
    title: "That is the tour",
    body: "Everything lives in one screen, and the library sits in the sidebar. Run this tour again whenever you like from Guide in your account menu.",
    cta: "Start a session",
    finishActions: ["showHome"],
  },
];

/** Steps after `index` that are not part of `group`. */
export function nextIndexOutsideGroup(
  index: number,
  group: GuideStepGroup | undefined
): number {
  if (!group) return Math.min(index + 1, GUIDE_STEPS.length - 1);
  for (let i = index + 1; i < GUIDE_STEPS.length; i += 1) {
    if (GUIDE_STEPS[i].group !== group) return i;
  }
  return GUIDE_STEPS.length - 1;
}

export function isGuideAction(value: string): value is GuideAction {
  return (GUIDE_ACTIONS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

export const GUIDE_SEEN_KEY = "nura.guide.v1";
export const GUIDE_STEP_KEY = "nura.guide.step";
export const GUIDE_AUTOSTART_KEY = "nura.guide.autostarted";
export const GUIDE_NEW_CHAT_KEY = "nura.guide.newchat";

export interface GuideStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeGet(storage: GuideStorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: GuideStorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    /* storage can be unavailable (private mode, quota); the tour still runs */
  }
}

function safeRemove(storage: GuideStorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True once the tour was finished or skipped on this device. */
export function hasSeenGuide(storage: GuideStorageLike): boolean {
  return safeGet(storage, GUIDE_SEEN_KEY) === "1";
}

export function markGuideSeen(storage: GuideStorageLike): void {
  safeSet(storage, GUIDE_SEEN_KEY, "1");
}

export function clearGuideSeen(storage: GuideStorageLike): void {
  safeRemove(storage, GUIDE_SEEN_KEY);
}

/** Clamped 0-based index, or 0 when nothing valid is stored. */
export function readGuideStepIndex(
  storage: GuideStorageLike,
  stepCount: number = GUIDE_STEPS.length
): number {
  const raw = safeGet(storage, GUIDE_STEP_KEY);
  const parsed = raw == null ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Math.trunc(parsed), Math.max(0, stepCount - 1));
}

export function writeGuideStepIndex(
  storage: GuideStorageLike,
  index: number
): void {
  safeSet(storage, GUIDE_STEP_KEY, String(Math.max(0, Math.trunc(index))));
}

export function clearGuideStepIndex(storage: GuideStorageLike): void {
  safeRemove(storage, GUIDE_STEP_KEY);
}

/** Reset both flags so the tour auto-starts again from the beginning. */
export function resetGuideState(
  storage: GuideStorageLike,
  session?: GuideStorageLike | null
): void {
  clearGuideSeen(storage);
  clearGuideStepIndex(storage);
  safeRemove(storage, GUIDE_AUTOSTART_KEY);
  if (session) {
    clearGuideStepIndex(session);
    safeRemove(session, GUIDE_AUTOSTART_KEY);
  }
}

/** True when the browser already auto-started the tour this session. */
export function hasGuideAutoStarted(storage: GuideStorageLike): boolean {
  return safeGet(storage, GUIDE_AUTOSTART_KEY) === "1";
}

export function markGuideAutoStarted(storage: GuideStorageLike): void {
  safeSet(storage, GUIDE_AUTOSTART_KEY, "1");
}

/** Ask the app shell to open a session once the tour closes. */
export function requestGuideNewChat(storage: GuideStorageLike): void {
  safeSet(storage, GUIDE_NEW_CHAT_KEY, "1");
}

/** Reads and clears the pending request. `true` only on the first call. */
export function consumeGuideNewChat(storage: GuideStorageLike): boolean {
  if (safeGet(storage, GUIDE_NEW_CHAT_KEY) !== "1") return false;
  safeRemove(storage, GUIDE_NEW_CHAT_KEY);
  return true;
}
