/**
 * Tap-and-hold detector (no React, no DOM), so it runs in node tests.
 * Fires once after `delay` ms if the pointer stays down and within
 * `moveTolerance` px; moving further (a scroll), lifting or a cancel stops
 * it. `consumeClick()` swallows the click that follows a fired long press.
 */
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_TOLERANCE = 8;

export type LongPressPoint = { x: number; y: number };

export type LongPressOptions = {
  delay?: number;
  moveTolerance?: number;
  onLongPress: (p: LongPressPoint) => void;
  schedule?: (fn: () => void, ms: number) => unknown;
  unschedule?: (handle: unknown) => void;
};

export type LongPressController = {
  down: (x: number, y: number, pointerType?: string, button?: number) => void;
  move: (x: number, y: number) => void;
  up: () => void;
  cancel: () => void;
  /** True once after a long press fired: the caller skips that click. */
  consumeClick: () => boolean;
};

export function createLongPress(opts: LongPressOptions): LongPressController {
  const delay = opts.delay ?? LONG_PRESS_MS;
  const tol = opts.moveTolerance ?? LONG_PRESS_MOVE_TOLERANCE;
  const schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const unschedule = opts.unschedule ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let handle: unknown = null;
  let start: LongPressPoint | null = null;
  let fired = false;

  const clear = () => {
    if (handle != null) unschedule(handle);
    handle = null;
    start = null;
  };

  return {
    down(x, y, pointerType = "touch", button = 0) {
      if (pointerType === "mouse" && button !== 0) return;
      clear();
      fired = false;
      const at = { x, y };
      start = at;
      handle = schedule(() => {
        handle = null;
        start = null;
        fired = true;
        opts.onLongPress(at);
      }, delay);
    },
    move(x, y) {
      if (!start || handle == null) return;
      const dx = x - start.x;
      const dy = y - start.y;
      if (dx * dx + dy * dy > tol * tol) clear();
    },
    up: clear,
    cancel: clear,
    consumeClick() {
      if (!fired) return false;
      fired = false;
      return true;
    },
  };
}
