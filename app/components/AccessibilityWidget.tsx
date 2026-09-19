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
  A11Y_RIBBON_H,
  A11Y_RIBBON_W,
  A11Y_STORAGE_KEY,
  A11Y_TEXT_STEPS,
  DEFAULT_A11Y_FAB,
  DEFAULT_A11Y_PREFERENCES,
  a11yAttachedBox,
  activeA11yCount,
  applyA11yPreferences,
  clampA11yCenterY,
  clampA11yFabPosition,
  isDefaultA11yPreferences,
  nearestA11yEdge,
  parseA11yFabState,
  parseA11yPreferences,
  type A11yDockEdge,
  type A11yFabState,
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

function readStoredFab(): A11yFabState {
  try {
    return parseA11yFabState(localStorage.getItem(A11Y_FAB_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_A11Y_FAB };
  }
}

/**
 * Accessibility widget. A circle you can drag anywhere on screen, which can be
 * pinned to a screen edge as a quiet ribbon.
 *
 * - Pinned: a half-pill with a chevron. Clicking it pulls the circle out; the
 *   settings stay closed until the circle itself is clicked.
 * - Free: drag it anywhere. Hovering shows an attach control that sends it to
 *   the nearest edge.
 *
 * Preferences are stored on the device, not the account, so guests get them too.
 */
export function AccessibilityWidget({
  defaultEdge = "right",
}: {
  /** Edge used when pinned, until the person moves it. */
  defaultEdge?: A11yDockEdge;
} = {}) {
  const [prefs, setPrefs] = useState<A11yPreferences>(DEFAULT_A11Y_PREFERENCES);
  const [fab, setFab] = useState<A11yFabState>(DEFAULT_A11Y_FAB);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(
    null
  );
  const [hydrated, setHydrated] = useState(false);
  /** Height of the tallest visible full-width bottom bar, in px. */
  const [lift, setLift] = useState(0);

  const widgetRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const dragEndedAtRef = useRef(0);
  const panelId = useId();
  const titleId = useId();

  const attached = fab.attached;
  const edge: A11yDockEdge = fab.edge ?? defaultEdge;

  /* ---------------------------------------------------------------- */
  /* Persisted preferences                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const stored = readStoredPreferences();
    setPrefs(stored);
    applyA11yPreferences(stored, document.documentElement);
    setFab(readStoredFab());
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

  /** Position/attachment changes are deliberate, so they persist. */
  const saveFab = useCallback((next: A11yFabState) => {
    setFab(next);
    try {
      localStorage.setItem(A11Y_FAB_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Viewport                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const sync = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setSheet(window.innerWidth <= SHEET_MAX_WIDTH);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
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

  // A saved position must stay reachable after the window shrinks or a phone
  // rotates.
  useEffect(() => {
    if (!hydrated || viewport.width === 0) return;
    setFab((prev) => {
      if (prev.attached) {
        if (prev.centerY === null) return prev;
        const centerY = clampA11yCenterY(
          prev.centerY,
          viewport.height,
          A11Y_RIBBON_H,
          lift
        );
        if (centerY === prev.centerY) return prev;
        const next = { ...prev, centerY };
        try {
          localStorage.setItem(A11Y_FAB_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      }
      if (prev.x === null || prev.y === null) return prev;
      const clamped = clampA11yFabPosition(
        { x: prev.x, y: prev.y },
        viewport
      );
      if (clamped.x === prev.x && clamped.y === prev.y) return prev;
      const next = { ...prev, x: clamped.x, y: clamped.y };
      try {
        localStorage.setItem(A11Y_FAB_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [hydrated, viewport, lift]);

  /* ---------------------------------------------------------------- */
  /* Drag anywhere on screen                                           */
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
      dragEndedAtRef.current = 0;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);      } catch {
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
        const distance = Math.hypot(
          target.x - rect.left,
          target.y - rect.top
        );
        if (distance < DRAG_THRESHOLD) return;
        drag.moved = true;
        setDragging(true);
      }
      // Dragging detaches: you are placing the circle, not the ribbon.
      setFab((prev) =>
        prev.x === target.x && prev.y === target.y && !prev.attached
          ? prev
          : { ...prev, x: target.x, y: target.y, attached: false }
      );
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
      setDragging(false);
      if (!drag.moved) return;
      dragEndedAtRef.current = Date.now();
      // Persist once, at the end of the gesture.
      setFab((prev) => {
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

  /**
   * Pinned: pull the circle out and stop there (the settings stay closed).
   * Free: toggle the settings.
   */
  const onFabClick = useCallback(() => {
    // A drag must not also toggle the settings (or pull the ribbon out).
    if (Date.now() - dragEndedAtRef.current < 350) return;
    if (fab.attached) {
      const box = a11yAttachedBox({
        edge,
        centerY: fab.centerY,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        bottomInset: lift,
      });
      const detached = clampA11yFabPosition(
        {
          x: edge === "left" ? 0 : viewport.width - A11Y_FAB_SIZE,
          y: box.top + box.height / 2 - A11Y_FAB_SIZE / 2,
        },
        viewport
      );
      saveFab({
        ...fab,
        attached: false,
        x: detached.x,
        y: detached.y,
        centerY: box.top + box.height / 2,
      });
      return;
    }
    setOpen((v) => !v);
  }, [edge, fab, lift, saveFab, viewport]);

  /** Hover control: travel to the nearest edge and pin there. */
  const attachToNearestEdge = useCallback(() => {
    setOpen(false);
    const box = widgetRef.current?.getBoundingClientRect();
    const centerX = box ? box.left + box.width / 2 : viewport.width / 2;
    const centerYAt = box ? box.top + box.height / 2 : viewport.height / 2;
    saveFab({
      x: fab.x,
      y: fab.y,
      attached: true,
      edge: nearestA11yEdge(
        centerX - A11Y_FAB_SIZE / 2,
        viewport.width || window.innerWidth
      ),
      centerY: clampA11yCenterY(
        centerYAt,
        viewport.height || window.innerHeight,
        A11Y_RIBBON_H,
        lift
      ),
    });
  }, [fab.x, fab.y, lift, saveFab, viewport]);

  const moveBy = useCallback(
    (dx: number, dy: number) => {
      if (fab.attached) {
        // Pinned: up/down slides along the edge, left/right picks the edge.
        if (dx !== 0) {
          saveFab({
            ...fab,
            edge: dx < 0 ? "left" : "right",
          });
          return;
        }
        const box = widgetRef.current?.getBoundingClientRect();
        const base =
          fab.centerY ??
          (box ? box.top + box.height / 2 : window.innerHeight / 2);
        saveFab({
          ...fab,
          centerY: clampA11yCenterY(
            base + dy,
            window.innerHeight,
            A11Y_RIBBON_H,
            lift
          ),
        });
        return;
      }
      const box = widgetRef.current?.getBoundingClientRect();
      const base = {
        x: fab.x ?? (box ? box.left : window.innerWidth - A11Y_FAB_SIZE - 10),
        y: fab.y ?? (box ? box.top : window.innerHeight - A11Y_FAB_SIZE - 10),
      };
      saveFab({
        ...fab,
        attached: false,
        ...clampA11yFabPosition(
          { x: base.x + dx, y: base.y + dy },
          { width: window.innerWidth, height: window.innerHeight }
        ),
      });
    },
    [fab, lift, saveFab]
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
      moveBy(move[0], move[1]);
    },
    [moveBy]
  );

  /* ---------------------------------------------------------------- */
  /* Panel placement + focus                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Place the panel from the widget's *current* box, which is set by inline
   * left/top/width/height. Measuring mid-morph used to report the collapsed
   * ribbon and land the panel on top of the button, so read the inline box.
   */
  useLayoutEffect(() => {
    if (!open || sheet) {
      setPanelPos(null);
      return;
    }
    const place = () => {
      const el = widgetRef.current;
      const panel = panelRef.current?.getBoundingClientRect();
      if (!el || !panel) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const boxLeft = parseFloat(el.style.left) || 0;
      const boxTop = parseFloat(el.style.top) || 0;
      const boxWidth = parseFloat(el.style.width) || A11Y_FAB_SIZE;
      const boxHeight = parseFloat(el.style.height) || A11Y_FAB_SIZE;

      // Open toward the middle of the screen.
      const opensRight = boxLeft + boxWidth / 2 < vw / 2;
      let left = opensRight
        ? boxLeft + boxWidth + PANEL_GAP
        : boxLeft - PANEL_GAP - panel.width;
      left = Math.min(
        Math.max(left, PANEL_GAP),
        Math.max(PANEL_GAP, vw - panel.width - PANEL_GAP)
      );
      let top = boxTop + boxHeight / 2 - panel.height / 2;
      top = Math.min(
        Math.max(top, PANEL_GAP),
        Math.max(PANEL_GAP, vh - panel.height - PANEL_GAP)
      );
      setPanelPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, sheet, fab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        widgetRef.current?.querySelector("button")?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        widgetRef.current?.contains(target)
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

  /* Geometry: pinned ribbon vs free circle, both as inline left/top.
   * Read only from `viewport` state: touching `window` during render breaks SSR. */
  const vw = viewport.width;
  const vh = viewport.height;
  const defaultCorner = clampA11yFabPosition(
    edge === "left"
      ? { x: 0, y: vh - A11Y_FAB_SIZE - 24 }
      : { x: vw - A11Y_FAB_SIZE, y: vh - A11Y_FAB_SIZE - 24 },
    { width: vw, height: vh }
  );
  const geometry = attached
    ? a11yAttachedBox({
        edge,
        centerY: fab.centerY,
        viewportWidth: vw,
        viewportHeight: vh,
        bottomInset: lift,
      })
    : {
        left: fab.x ?? defaultCorner.x,
        top: fab.y ?? defaultCorner.y,
        width: A11Y_FAB_SIZE,
        height: A11Y_FAB_SIZE,
      };

  // Room on the inner side of the button, for the hover attach control.
  const side =
    geometry.left + geometry.width / 2 < vw / 2 ? "right" : "left";

  // Geometry is measured, so there is nothing correct to draw on the server.
  // Render nothing for the first client frame instead of flashing the widget
  // at a guessed position.
  if (!hydrated || vw === 0 || vh === 0) return null;

  return (
    <div
      ref={widgetRef}
      className={`a11y-widget${dragging ? " is-dragging" : ""}`}
      data-attached={attached ? "" : undefined}
      data-edge={edge}
      data-side={side}
      style={{
        left: `${geometry.left}px`,
        top: `${geometry.top}px`,
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
      }}
    >
      <button
        type="button"
        className={`a11y-fab${open ? " is-open" : ""}`}
        aria-label={
          attached
            ? "Take accessibility settings out of the screen edge"
            : "Accessibility settings"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={
          attached
            ? "Accessibility settings. Click to pull it out of the edge."
            : "Accessibility settings. Drag anywhere, or use the attach control."
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onFabKeyDown}
        onClick={onFabClick}
      >
        {attached ? (
          // Pinned: a quiet ribbon with a chevron pointing into the page.
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

      {!attached ? (
        <button
          type="button"
          className="a11y-attach"
          onClick={attachToNearestEdge}
          aria-label="Attach to the nearest screen edge"
          title="Attach to the nearest screen edge"
        >
          <svg
            className="a11y-attach-icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 3v12" />
            <path d="m5 8 4-4 4 4" />
            <path d="M15 21V9" />
            <path d="m19 16-4 4-4-4" />
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
                  widgetRef.current?.querySelector("button")?.focus();
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
              <button
                type="button"
                className="a11y-link-btn"
                onClick={attachToNearestEdge}
              >
                Move to the nearest edge
              </button>
            </div>

            <p className="a11y-panel-note">
              Drag the circle anywhere on screen. On hover it offers to attach
              itself to the nearest edge.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
