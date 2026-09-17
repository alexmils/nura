"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  A11Y_FAB_SIZE,
  A11Y_FAB_STORAGE_KEY,
  A11Y_STORAGE_KEY,
  A11Y_TEXT_STEPS,
  DEFAULT_A11Y_PREFERENCES,
  activeA11yCount,
  applyA11yPreferences,
  clampA11yFabPosition,
  isDefaultA11yPreferences,
  parseA11yFabPosition,
  parseA11yPreferences,
  type A11yFabPosition,
  type A11yPreferences,
} from "@/lib/a11y-preferences";
import "./accessibility-widget.css";

const MARK_SRC = "/brand/logo-variants/nura-circle-white-on-ink.png";
/** Panel opens as a bottom sheet at or below this width. */
const SHEET_MAX_WIDTH = 640;
const PANEL_GAP = 12;
/** Bottom bars that should push the button up instead of being covered. */
const BOTTOM_BANNER_SELECTOR = ".fe-cookie-banner, [data-a11y-lift]";
/** Pointer travel above this (px) counts as a drag, not a tap. */
const DRAG_THRESHOLD = 5;
const KEYBOARD_STEP = 24;

const TEXT_STEP_LABELS = ["Default", "Large", "Larger", "Largest"] as const;

interface ToggleRow {
  key: keyof Omit<A11yPreferences, "textSize">;
  label: string;
  hint: string;
}

const TOGGLE_ROWS: ToggleRow[] = [
  {
    key: "highContrast",
    label: "High contrast",
    hint: "Darker text and stronger borders.",
  },
  {
    key: "largeTargets",
    label: "Larger buttons and fields",
    hint: "Bigger tap targets across Nura.",
  },
  {
    key: "readableSpacing",
    label: "More readable spacing",
    hint: "Extra line height and letter spacing.",
  },
  {
    key: "underlineLinks",
    label: "Underline links",
    hint: "Always show link underlines.",
  },
  {
    key: "reduceMotion",
    label: "Reduce motion",
    hint: "Stop looping animation and smooth scrolling.",
  },
];

function readStoredPreferences(): A11yPreferences {
  try {
    return parseA11yPreferences(localStorage.getItem(A11Y_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_A11Y_PREFERENCES };
  }
}

function readStoredPosition(): A11yFabPosition | null {
  try {
    return parseA11yFabPosition(localStorage.getItem(A11Y_FAB_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Floating accessibility panel (Vercel-style): a Nura mark button you can drag
 * anywhere, opening text size, contrast and motion settings.
 *
 * Mounted on the marketing shell and under `/app`. Choices are stored on the
 * device, not the account, so guests get them too.
 */
export function AccessibilityWidget() {
  const [prefs, setPrefs] = useState<A11yPreferences>(DEFAULT_A11Y_PREFERENCES);
  const [position, setPosition] = useState<A11yFabPosition | null>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(
    null
  );
  const [hydrated, setHydrated] = useState(false);

  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const movedRef = useRef(false);
  const panelId = useId();
  const titleId = useId();

  /* ---------------------------------------------------------------- */
  /* Persisted preferences                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const stored = readStoredPreferences();
    setPrefs(stored);
    applyA11yPreferences(stored, document.documentElement);
    setPosition(readStoredPosition());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<A11yPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      applyA11yPreferences(next, document.documentElement);
      try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: keep the setting for this page */
      }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    applyA11yPreferences(DEFAULT_A11Y_PREFERENCES, document.documentElement);
    try {
      localStorage.removeItem(A11Y_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPrefs({ ...DEFAULT_A11Y_PREFERENCES });
  }, []);

  const savePosition = useCallback((next: A11yFabPosition | null) => {
    setPosition(next);
    try {
      if (next) {
        localStorage.setItem(A11Y_FAB_STORAGE_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(A11Y_FAB_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Viewport                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const syncSheet = () => setSheet(window.innerWidth <= SHEET_MAX_WIDTH);
    syncSheet();
    window.addEventListener("resize", syncSheet);
    return () => window.removeEventListener("resize", syncSheet);
  }, []);

  /**
   * Bottom bars (cookie consent, future docks) span the full width, so the
   * button would sit on top of their copy. Measure the tallest visible one and
   * lift the button above it.
   *
   * The observer is rAF-debounced and skips work when nothing changed, because
   * the app mutates the DOM constantly (chat messages, sessions).
   */
  useEffect(() => {
    const root = document.body;
    if (!root) return;
    let frame = 0;
    let applied = -1;
    let watched: Element | null = null;
    let sizes: ResizeObserver | null = null;

    function measure() {
      frame = 0;
      const banners = Array.from(
        document.querySelectorAll<HTMLElement>(BOTTOM_BANNER_SELECTOR)
      ).filter((el) => el.offsetHeight > 0);
      const tallest = banners.reduce(
        (max, el) => Math.max(max, el.offsetHeight),
        0
      );
      if (tallest !== applied) {
        applied = tallest;
        fabRef.current?.style.setProperty("--a11y-lift", `${tallest}px`);
      }
      const next = banners[0] ?? null;
      if (next !== watched) {
        sizes?.disconnect();
        watched = next;
        if (next && typeof ResizeObserver !== "undefined") {
          sizes = new ResizeObserver(schedule);
          sizes.observe(next);
        }
      }
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    }

    measure();
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      sizes?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  // A saved drag position must stay reachable after the window shrinks or the
  // phone rotates.
  useEffect(() => {
    if (!hydrated) return;
    const onResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        const clamped = clampA11yFabPosition(prev, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        try {
          localStorage.setItem(A11Y_FAB_STORAGE_KEY, JSON.stringify(clamped));
        } catch {
          /* ignore */
        }
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [hydrated]);

  /* ---------------------------------------------------------------- */
  /* Drag + keyboard nudge                                             */
  /* ---------------------------------------------------------------- */

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false,
      };
      movedRef.current = false;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture unsupported */
      }
    },
    []
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const target = clampA11yFabPosition(
        { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
        { width: window.innerWidth, height: window.innerHeight }
      );
      if (!drag.moved) {
        const rect = event.currentTarget.getBoundingClientRect();
        const distance = Math.hypot(target.x - rect.left, target.y - rect.top);
        if (distance < DRAG_THRESHOLD) return;
        drag.moved = true;
        movedRef.current = true;
      }
      setPosition(target);
    },
    []
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* capture already gone */
      }
      if (!drag.moved) return;
      setPosition((prev) => {
        if (!prev) return prev;
        try {
          localStorage.setItem(A11Y_FAB_STORAGE_KEY, JSON.stringify(prev));
        } catch {
          /* ignore */
        }
        return prev;
      });
    },
    []
  );

  const onFabClick = useCallback(() => {
    // A drag must not also toggle the panel.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen((v) => !v);
  }, []);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const rect = fabRef.current?.getBoundingClientRect();
      const base = position ?? {
        x: rect?.left ?? window.innerWidth - A11Y_FAB_SIZE - 16,
        y: rect?.top ?? window.innerHeight - A11Y_FAB_SIZE - 16,
      };
      savePosition(
        clampA11yFabPosition(
          { x: base.x + dx, y: base.y + dy },
          { width: window.innerWidth, height: window.innerHeight }
        )
      );
    },
    [position, savePosition]
  );

  const onFabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -KEYBOARD_STEP],
        ArrowDown: [0, KEYBOARD_STEP],
        ArrowLeft: [-KEYBOARD_STEP, 0],
        ArrowRight: [KEYBOARD_STEP, 0],
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      nudge(move[0], move[1]);
    },
    [nudge]
  );

  /* ---------------------------------------------------------------- */
  /* Panel placement + focus                                           */
  /* ---------------------------------------------------------------- */

  useLayoutEffect(() => {
    if (!open || sheet) {
      setPanelPos(null);
      return;
    }
    const place = () => {
      const fab = fabRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!fab || !panel) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = fab.right + PANEL_GAP;
      if (left + panel.width > vw - PANEL_GAP) {
        left = fab.left - panel.width - PANEL_GAP;
      }
      left = Math.min(
        Math.max(left, PANEL_GAP),
        Math.max(PANEL_GAP, vw - panel.width - PANEL_GAP)
      );
      let top = fab.bottom - panel.height;
      top = Math.min(
        Math.max(top, PANEL_GAP),
        Math.max(PANEL_GAP, vh - panel.height - PANEL_GAP)
      );
      setPanelPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, sheet, position]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        fabRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const moved = position !== null;
  const customised = !isDefaultA11yPreferences(prefs);
  const activeCount = activeA11yCount(prefs);

  const style = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return (
    <div className="a11y-widget">
      <button
        ref={fabRef}
        type="button"
        className={`a11y-fab${open ? " is-open" : ""}${moved ? " is-moved" : ""}`}
        style={style}
        aria-label="Accessibility settings"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Accessibility settings. Drag to move."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onFabKeyDown}
        onClick={onFabClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small brand mark, no optimisation pipeline needed */}
        <img
          src={MARK_SRC}
          alt=""
          width={A11Y_FAB_SIZE}
          height={A11Y_FAB_SIZE}
          draggable={false}
        />
        {activeCount > 0 ? (
          <span className="a11y-fab-count" aria-hidden="true">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {sheet ? (
            <button
              type="button"
              className="a11y-sheet-backdrop"
              aria-label="Close accessibility settings"
              onClick={() => setOpen(false)}
            />
          ) : null}
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal={sheet || undefined}
            aria-labelledby={titleId}
            className={`a11y-panel${sheet ? " a11y-panel--sheet" : ""}`}
            style={
              !sheet && panelPos
                ? { left: panelPos.left, top: panelPos.top }
                : undefined
            }
          >
            <div className="a11y-panel-head">
              <h2 className="a11y-panel-title" id={titleId}>
                Accessibility
              </h2>
              <button
                type="button"
                className="a11y-panel-close"
                onClick={() => {
                  setOpen(false);
                  fabRef.current?.focus();
                }}
              >
                Close
              </button>
            </div>

            <p className="a11y-panel-lead">
              Make Nura easier to read and calmer to look at. Saved on this
              device.
            </p>

            <fieldset className="a11y-group">
              <legend className="a11y-group-legend">Text size</legend>
              <div
                className="a11y-steps"
                role="radiogroup"
                aria-label="Text size"
              >
                {A11Y_TEXT_STEPS.map((step) => {
                  const active = prefs.textSize === step;
                  return (
                    <button
                      key={step}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`Text size: ${TEXT_STEP_LABELS[step]}`}
                      className={`a11y-step${active ? " is-active" : ""}`}
                      onClick={() => update({ textSize: step })}
                    >
                      <span
                        className="a11y-step-letter"
                        style={{ fontSize: `${0.85 + step * 0.21}rem` }}
                        aria-hidden="true"
                      >
                        A
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="a11y-group-value" aria-live="polite">
                {TEXT_STEP_LABELS[prefs.textSize]}
              </p>
            </fieldset>

            <div className="a11y-group">
              <p className="a11y-group-legend" id={`${panelId}-display`}>
                Display
              </p>
              <ul
                className="a11y-toggle-list"
                aria-labelledby={`${panelId}-display`}
              >
                {TOGGLE_ROWS.map((row) => (
                  <li key={row.key}>
                    <label className="a11y-toggle">
                      <span className="a11y-toggle-text">
                        <span className="a11y-toggle-label">{row.label}</span>
                        <span className="a11y-toggle-hint">{row.hint}</span>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        className="a11y-switch"
                        checked={prefs[row.key]}
                        onChange={(event) =>
                          update({ [row.key]: event.target.checked })
                        }
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="a11y-panel-foot">
              <button
                type="button"
                className="a11y-link-btn"
                onClick={resetAll}
                disabled={!customised}
              >
                Reset settings
              </button>
              {moved ? (
                <button
                  type="button"
                  className="a11y-link-btn"
                  onClick={() => savePosition(null)}
                >
                  Reset position
                </button>
              ) : (
                <span className="a11y-panel-note">
                  Drag the button, or use the arrow keys, to move it.
                </span>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
