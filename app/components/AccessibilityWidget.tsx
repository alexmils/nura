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
  A11Y_DOCK_STORAGE_KEY,
  A11Y_FAB_SIZE,
  A11Y_STORAGE_KEY,
  A11Y_TEXT_STEPS,
  DEFAULT_A11Y_DOCK,
  DEFAULT_A11Y_PREFERENCES,
  activeA11yCount,
  a11yEdgeForX,
  applyA11yPreferences,
  clampA11yCenterY,
  isDefaultA11yPreferences,
  parseA11yDock,
  parseA11yPreferences,
  type A11yDock,
  type A11yDockEdge,
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

function readStoredDock(): A11yDock {
  try {
    return parseA11yDock(localStorage.getItem(A11Y_DOCK_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_A11Y_DOCK };
  }
}

/**
 * Edge-docked accessibility widget: a ribbon peeking out of the screen edge
 * that opens into the Nura mark and the settings panel.
 *
 * Folded, it can be dragged along the edge or across to the other one, and it
 * remembers where it was docked. Preferences are stored on the device, not the
 * account, so guests get them too.
 */
export function AccessibilityWidget({
  defaultEdge = "right",
}: {
  /** Edge used until the person drags the ribbon somewhere else. */
  defaultEdge?: A11yDockEdge;
} = {}) {
  const [prefs, setPrefs] = useState<A11yPreferences>(DEFAULT_A11Y_PREFERENCES);
  const [dock, setDock] = useState<A11yDock>(DEFAULT_A11Y_DOCK);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(
    null
  );
  const [hydrated, setHydrated] = useState(false);
  /** Height of the tallest visible full-width bottom bar, in px. */
  const [lift, setLift] = useState(0);

  const fabRef = useRef<HTMLButtonElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const movedRef = useRef(false);
  const panelId = useId();
  const titleId = useId();

  const collapsed = dock.collapsed;
  const edge: A11yDockEdge = dock.edge ?? defaultEdge;

  /* ---------------------------------------------------------------- */
  /* Persisted preferences                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const stored = readStoredPreferences();
    setPrefs(stored);
    applyA11yPreferences(stored, document.documentElement);
    setDock(readStoredDock());
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

  /** Fold/unfold and re-dock are deliberate choices, so they persist. */
  const saveDock = useCallback((next: A11yDock) => {
    setDock(next);
    try {
      localStorage.setItem(A11Y_DOCK_STORAGE_KEY, JSON.stringify(next));
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
   * Bottom bars (cookie consent, future docks) span the full width. Measure the
   * tallest visible one so a dragged widget cannot be left sitting under it.
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
        setLift(tallest);
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
      setDock((prev) => {
        if (prev.centerY === null) return prev;
        const centerY = clampA11yCenterY(
          prev.centerY,
          window.innerHeight,
          undefined,
          lift
        );
        if (centerY === prev.centerY) return prev;
        const next = { ...prev, centerY };
        try {
          localStorage.setItem(A11Y_DOCK_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [hydrated, lift]);

  /* ---------------------------------------------------------------- */
  /* Drag along/cross the edge + keyboard nudge                        */
  /* ---------------------------------------------------------------- */

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        offsetY: event.clientY - (rect.top + rect.height / 2),
        startX: event.clientX,
        startY: event.clientY,
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
      if (!drag.moved) {
        const travelled = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY
        );
        if (travelled < DRAG_THRESHOLD) return;
        drag.moved = true;
        movedRef.current = true;
      }
      // Dragging works folded or open: it slides along the edge and snaps to
      // whichever half of the screen the pointer is in, so the ribbon can be
      // re-docked on the other side.
      const centerY = clampA11yCenterY(
        event.clientY - drag.offsetY,
        window.innerHeight,
        undefined,
        lift
      );
      const nextEdge = a11yEdgeForX(event.clientX, window.innerWidth);
      setDock((prev) =>
        prev.centerY === centerY && prev.edge === nextEdge
          ? prev
          : { ...prev, centerY, edge: nextEdge }
      );
    },
    [lift]
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
      // Persist once, at the end of the gesture.
      setDock((prev) => {
        try {
          localStorage.setItem(A11Y_DOCK_STORAGE_KEY, JSON.stringify(prev));
        } catch {
          /* ignore */
        }
        return prev;
      });
    },
    []
  );

  const onFabClick = useCallback(() => {
    // A drag must not also toggle.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (collapsed) {
      // Folded ribbon: one click unfolds it and brings the settings straight up.
      saveDock({ ...dock, collapsed: false });
      setOpen(true);
      return;
    }
    setOpen((v) => !v);
  }, [collapsed, dock, saveDock]);

  const fold = useCallback(() => {
    setOpen(false);
    saveDock({ ...dock, collapsed: true });
  }, [dock, saveDock]);

  const resetDock = useCallback(() => {
    saveDock({ ...dock, edge: null, centerY: null });
  }, [dock, saveDock]);

  const moveBy = useCallback(
    (dy: number) => {
      const rect = fabRef.current?.getBoundingClientRect();
      const base =
        dock.centerY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
      saveDock({
        ...dock,
        centerY: clampA11yCenterY(base + dy, window.innerHeight, undefined, lift),
      });
    },
    [dock, lift, saveDock]
  );

  const onFabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveBy(-KEYBOARD_STEP);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveBy(KEYBOARD_STEP);
        return;
      }
      // Left/right re-dock the widget to that edge.
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        saveDock({ ...dock, edge: event.key === "ArrowLeft" ? "left" : "right" });
      }
    },
    [dock, moveBy, saveDock]
  );

  /* ---------------------------------------------------------------- */
  /* Panel placement + focus                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Place the panel from the *target* box of the opened mark button, not from
   * a measured rect: the ribbon morphs (width/height/top transition), so
   * measuring mid-transition reports the collapsed ribbon and the panel lands
   * on top of the button.
   */
  useLayoutEffect(() => {
    if (!open || sheet) {
      setPanelPos(null);
      return;
    }
    const place = () => {
      const fab = fabRef.current;
      const panel = panelRef.current?.getBoundingClientRect();
      if (!fab || !panel) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // `left`/`right` are not transitioned, so their used values are stable.
      const fabStyle = getComputedStyle(fab);
      const onRightEdge = edge === "right";
      const inset = parseFloat(onRightEdge ? fabStyle.right : fabStyle.left) || 0;
      const fabLeft = onRightEdge
        ? vw - inset - A11Y_FAB_SIZE
        : inset;
      const fabRight = fabLeft + A11Y_FAB_SIZE;

      // Same source the CSS positions from: the saved center, else centered.
      const centerRaw =
        widgetRef.current?.style
          .getPropertyValue("--a11y-center")
          .trim() ?? "";
      const centerY = centerRaw.endsWith("px")
        ? parseFloat(centerRaw)
        : centerRaw.endsWith("%")
          ? (parseFloat(centerRaw) / 100) * vh
          : vh / 2;

      // Open on the inner side of the docked edge.
      let left = onRightEdge
        ? fabLeft - PANEL_GAP - panel.width
        : fabRight + PANEL_GAP;
      left = Math.min(
        Math.max(left, PANEL_GAP),
        Math.max(PANEL_GAP, vw - panel.width - PANEL_GAP)
      );
      let top = centerY - panel.height / 2;
      top = Math.min(
        Math.max(top, PANEL_GAP),
        Math.max(PANEL_GAP, vh - panel.height - PANEL_GAP)
      );
      setPanelPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, sheet, dock, edge]);

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

  const customised = !isDefaultA11yPreferences(prefs);
  const activeCount = activeA11yCount(prefs);
  const docked = dock.edge !== null || dock.centerY !== null;

  // Vertical position: the saved center, else the CSS default (centered).
  const widgetStyle =
    dock.centerY !== null
      ? ({ "--a11y-center": `${dock.centerY}px` } as React.CSSProperties)
      : undefined;

  return (
    <div
      ref={widgetRef}
      className="a11y-widget"
      data-edge={edge}
      data-collapsed={collapsed ? "" : undefined}
      style={widgetStyle}
    >
      <button
        ref={fabRef}
        type="button"
        className={`a11y-fab${open ? " is-open" : ""}`}
        aria-label={
          collapsed ? "Open accessibility settings" : "Accessibility settings"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={
          collapsed
            ? "Accessibility settings. Drag along the edge to move it."
            : "Accessibility settings. Drag along the edge, or fold it away."
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onFabKeyDown}
        onClick={onFabClick}
      >
        {collapsed ? (
          // Folded: a quiet ribbon with a chevron pointing into the page.
          <svg
            className="a11y-ribbon-chevron"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- small brand mark, no optimisation pipeline needed */
          <img
            src={MARK_SRC}
            alt=""
            width={A11Y_FAB_SIZE}
            height={A11Y_FAB_SIZE}
            draggable={false}
          />
        )}
        {activeCount > 0 ? (
          <span className="a11y-fab-count" aria-hidden="true">
            {activeCount}
          </span>
        ) : null}
      </button>

      {!collapsed ? (
        <button
          type="button"
          className="a11y-fold"
          onClick={fold}
          aria-label="Hide accessibility settings in the screen edge"
          title="Hide in the screen edge"
        >
          <svg
            className="a11y-fold-chevron"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      ) : null}

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
              {docked ? (
                <button
                  type="button"
                  className="a11y-link-btn"
                  onClick={resetDock}
                >
                  Reset position
                </button>
              ) : (
                <span className="a11y-panel-note">
                  Drag the ribbon along the edge to move it, or across to the
                  other side. Arrow keys work too.
                </span>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
