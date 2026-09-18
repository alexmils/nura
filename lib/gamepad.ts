import type { VibrationMode } from "./types";

export type GamepadNavDirection = "up" | "down" | "left" | "right";

/** Handlers the controller drives while a set screen is open. */
export interface GamepadLoopHandlers {
  /** Main button (A / cross): start or pause the set. */
  onToggle?: () => void;
  /** D-pad or left stick: move between the session controls. */
  onNavigate?: (direction: GamepadNavDirection) => void;
}

export const VIBRATION_INTENSITY: Record<VibrationMode, number> = {
  none: 0,
  soft: 0.35,
  hard: 1,
};

/** @deprecated Use rumble(mode) profiles instead */
export function vibrationIntensity(mode: VibrationMode): number {
  return VIBRATION_INTENSITY[mode];
}

export interface RumbleProfile {
  duration: number;
  weakMagnitude: number;
  strongMagnitude: number;
}

/** Per-mode rumble — soft is a short light tap, hard is a longer strong pulse. */
export const RUMBLE_PROFILE: Record<
  VibrationMode,
  RumbleProfile | null
> = {
  none: null,
  soft: {
    duration: 45,
    weakMagnitude: 0.28,
    strongMagnitude: 0.1,
  },
  hard: {
    duration: 140,
    weakMagnitude: 0.55,
    strongMagnitude: 1,
  },
};

export function isGamepadConnected(): boolean {
  if (typeof navigator === "undefined") return false;
  const pads = navigator.getGamepads?.() ?? [];
  return Array.from(pads).some((p) => p && p.connected);
}

let rafId: number | null = null;
let onActionRef: GamepadLoopHandlers | null = null;
let activePadIndex: number | null = null;
let prevButtons: boolean[] = [];
let prevStick = { x: 0, y: 0 };
let buttonsSynced = false;
let lastToggleAt = 0;

const STICK_DEADZONE = 0.45;
const TOGGLE_COOLDOWN_MS = 450;

function stickAxis(value: number): -1 | 0 | 1 {
  if (value < -STICK_DEADZONE) return -1;
  if (value > STICK_DEADZONE) return 1;
  return 0;
}

function findPad(pads: (Gamepad | null)[]) {
  if (activePadIndex !== null) {
    const current = pads[activePadIndex];
    if (current?.connected) return current;
  }
  return Array.from(pads).find((p) => p && p.connected) ?? null;
}

function syncPadState(pad: Gamepad) {
  prevButtons = pad.buttons.map((b) => b.pressed);
  prevStick = {
    x: stickAxis(pad.axes[0] ?? 0),
    y: stickAxis(pad.axes[1] ?? 0),
  };
  activePadIndex = pad.index;
  buttonsSynced = true;
}

function edgeButton(buttons: boolean[], index: number) {
  return Boolean(buttons[index] && !prevButtons[index]);
}

export function startGamepadLoop(handlers: GamepadLoopHandlers) {
  onActionRef = handlers;
  if (rafId !== null) return;

  const tick = () => {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = findPad(pads);

    if (!pad) {
      activePadIndex = null;
      buttonsSynced = false;
      prevButtons = [];
      prevStick = { x: 0, y: 0 };
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (activePadIndex !== pad.index || !buttonsSynced) {
      syncPadState(pad);
      rafId = requestAnimationFrame(tick);
      return;
    }

    const buttons = pad.buttons.map((b) => b.pressed);
    const fire = onActionRef;

    if (edgeButton(buttons, 0)) {
      const now = performance.now();
      if (now - lastToggleAt >= TOGGLE_COOLDOWN_MS) {
        lastToggleAt = now;
        fire?.onToggle?.();
      }
    }
    if (edgeButton(buttons, 12)) fire?.onNavigate?.("up");
    if (edgeButton(buttons, 13)) fire?.onNavigate?.("down");
    if (edgeButton(buttons, 14)) fire?.onNavigate?.("left");
    if (edgeButton(buttons, 15)) fire?.onNavigate?.("right");

    prevButtons = buttons;

    const stickX = stickAxis(pad.axes[0] ?? 0);
    const stickY = stickAxis(pad.axes[1] ?? 0);
    if (stickY === -1 && prevStick.y !== -1) fire?.onNavigate?.("up");
    if (stickY === 1 && prevStick.y !== 1) fire?.onNavigate?.("down");
    if (stickX === -1 && prevStick.x !== -1) fire?.onNavigate?.("left");
    if (stickX === 1 && prevStick.x !== 1) fire?.onNavigate?.("right");
    prevStick = { x: stickX, y: stickY };

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}

export function stopGamepadLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  onActionRef = null;
  activePadIndex = null;
  prevButtons = [];
  prevStick = { x: 0, y: 0 };
  buttonsSynced = false;
  lastToggleAt = 0;
}

export function rumble(mode: VibrationMode) {
  const profile = RUMBLE_PROFILE[mode];
  if (!profile) return;

  const pads = navigator.getGamepads?.() ?? [];
  const pad =
    activePadIndex !== null
      ? pads[activePadIndex]
      : Array.from(pads).find((p) => p && p.connected);

  if (!pad?.vibrationActuator) return;

  pad.vibrationActuator
    .playEffect("dual-rumble", {
      startDelay: 0,
      duration: profile.duration,
      weakMagnitude: profile.weakMagnitude,
      strongMagnitude: profile.strongMagnitude,
    })
    .catch(() => {});
}
