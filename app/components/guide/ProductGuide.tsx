"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { APP_BASE } from "@/lib/app-base";
import { GuideVoiceDemo } from "./GuideVoiceDemo";
import {
  GUIDE_STEPS,
  clearGuideStepIndex,
  consumeGuideNewChat,
  hasGuideAutoStarted,
  hasSeenGuide,
  markGuideAutoStarted,
  markGuideSeen,
  nextIndexOutsideGroup,
  readGuideStepIndex,
  requestGuideNewChat,
  writeGuideStepIndex,
  type GuideAction,
  type GuideGearSection,
  type GuideStep,
  type GuideStorageLike,
} from "@/lib/guide-steps";
import "./product-guide.css";

/** Space kept between the spotlight edge and the card. */
const CARD_GAP = 22;
const DOT_SIZE = 12;
const VIEWPORT_MARGIN = 12;
/** Spotlight padding around the target. */
const RING_PAD = 6;
const TARGET_TIMEOUT_MS = 3000;
const TARGET_POLL_MS = 90;

type GuideRect = { top: number; left: number; width: number; height: number };

export type GuideHostActions = {
  openSidebar?: () => void;
  openAccountMenu?: () => void;
  closeAccountMenu?: () => void;
  ensurePendingThread?: () => Promise<boolean> | boolean;
  chooseSelfGuided?: () => Promise<boolean> | boolean;
  chooseGuided?: () => Promise<boolean> | boolean;
  openGear?: () => void;
  openGearSection?: (section: GuideGearSection) => void;
  closeGear?: () => void;
  showHome?: () => void;
  startNewChat?: () => void;
  canRunSession?: () => boolean;
};

type GuideContextValue = {
  active: boolean;
  stepIndex: number;
  step: GuideStep | null;
  total: number;
  start: (from?: number) => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  registerHost: (actions: GuideHostActions) => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

function localStore(): GuideStorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionStore(): GuideStorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  );
}

/**
 * True when the element is fully inside the window and inside every scrollable
 * ancestor (the adjustments sheet scrolls its sections).
 */
function isFullyVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  if (
    r.top < 0 ||
    r.left < 0 ||
    r.bottom > window.innerHeight ||
    r.right > window.innerWidth
  ) {
    return false;
  }
  let parent = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const scrollable =
      /(auto|scroll|overlay)/.test(style.overflowY) ||
      /(auto|scroll|overlay)/.test(style.overflowX);
    if (scrollable) {
      const pr = parent.getBoundingClientRect();
      if (r.top < pr.top - 2 || r.bottom > pr.bottom + 2) return false;
    }
    parent = parent.parentElement;
  }
  return true;
}

export function ProductGuideProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hostRef = useRef<GuideHostActions>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef<GuideStep | null>(null);
  const autoStartRef = useRef(false);
  const mountedRef = useRef(true);

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<GuideRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const registerHost = useCallback((actions: GuideHostActions) => {
    hostRef.current = { ...hostRef.current, ...actions };
  }, []);

  const goTo = useCallback((index: number) => {
    const clamped = Math.min(Math.max(0, index), GUIDE_STEPS.length - 1);
    setStepIndex(clamped);
    const storage = sessionStore();
    if (storage) writeGuideStepIndex(storage, clamped);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setRect(null);
    setPos(null);
    prevStepRef.current = null;
    const storage = sessionStore();
    if (storage) {
      clearGuideStepIndex(storage);
      markGuideSeen(storage);
    }
  }, []);

  const start = useCallback((from = 0) => {
    const next = Math.min(Math.max(0, from), GUIDE_STEPS.length - 1);
    prevStepRef.current = null;
    setStepIndex(next);
    setRect(null);
    setPos(null);
    setActive(true);
    const storage = sessionStore();
    if (storage) writeGuideStepIndex(storage, next);
  }, []);

  const runActions = useCallback(
    async (actions?: GuideAction[], step?: GuideStep | null): Promise<boolean> => {
      if (!actions || actions.length === 0) return true;
      for (const action of actions) {
        const host = hostRef.current;
        try {
          switch (action) {
            case "openSidebar":
              host.openSidebar?.();
              break;
            case "openAccountMenu":
              host.openAccountMenu?.();
              break;
            case "closeAccountMenu":
              host.closeAccountMenu?.();
              break;
            case "openGear":
              host.openGear?.();
              break;
            case "openGearSection":
              if (step?.gearSection) host.openGearSection?.(step.gearSection);
              break;
            case "closeGear":
              host.closeGear?.();
              break;
            case "showHome":
              host.showHome?.();
              break;
            case "wait":
              await new Promise((resolve) => window.setTimeout(resolve, 500));
              break;
            case "ensurePendingThread": {
              const ok = await host.ensurePendingThread?.();
              if (ok === false) return false;
              break;
            }
            case "chooseSelfGuided": {
              const ok = await host.chooseSelfGuided?.();
              if (ok === false) return false;
              break;
            }
            case "chooseGuided": {
              const ok = await host.chooseGuided?.();
              if (ok === false) return false;
              break;
            }
          }
        } catch {
          /* A failed host action must not trap the tour. */
        }
      }
      return true;
    },
    []
  );

  const next = useCallback(() => {
    if (stepIndex >= GUIDE_STEPS.length - 1) {
      stop();
      return;
    }
    goTo(stepIndex + 1);
  }, [goTo, stepIndex, stop]);

  const previous = useCallback(() => {
    goTo(stepIndex - 1);
  }, [goTo, stepIndex]);

  /* Prepare the step: cleanup, open what it needs, then skip if it cannot run. */
  useEffect(() => {
    if (!active) return;
    const current = GUIDE_STEPS[stepIndex];
    if (!current) return;

    let cancelled = false;

    const run = async () => {
      const previousStep = prevStepRef.current;
      if (previousStep && previousStep.id !== current.id) {
        await runActions(previousStep.cleanup);
      }
      prevStepRef.current = current;

      if (
        current.group === "session" &&
        hostRef.current.canRunSession?.() === false
      ) {
        if (!cancelled) goTo(nextIndexOutsideGroup(stepIndex, current.group));
        return;
      }

      const ok = await runActions(current.prepare, current);
      if (cancelled) return;
      if (!ok) {
        goTo(nextIndexOutsideGroup(stepIndex, current.group));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [active, stepIndex, goTo, runActions]);

  /* Route the step belongs to. */
  useEffect(() => {
    if (!active) return;
    const current = GUIDE_STEPS[stepIndex];
    if (!current) return;
    if (current.surface !== pathname) router.push(current.surface);
  }, [active, pathname, router, stepIndex]);

  /* Find and measure the spotlight target, and keep the measurement fresh. */
  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    const current = GUIDE_STEPS[stepIndex];
    const selector = current?.target;
    if (!selector) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let detach: (() => void) | null = null;
    let timer = 0;
    let attempts = 0;
    const startedAt = Date.now();
    /** Last measured box, so a 4Hz poll does not re-render the card for nothing. */
    let lastKey = "";

    const attach = (el: Element) => {
      const update = () => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          setRect(null);
          return;
        }
        const next = {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        };
        const key = `${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.width)}:${Math.round(next.height)}`;
        if (key === lastKey) return;
        lastKey = key;
        setRect(next);
      };
      update();

      window.addEventListener("scroll", update, true);
      window.addEventListener("resize", update);
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(update);
        observer.observe(el);
      }
      // Panels that open with a transform (the sidebar drawer, the sheet) move
      // without firing scroll/resize, so keep a slow poll for the whole step.
      timer = window.setInterval(update, 250);

      if (!isFullyVisible(el)) {
        try {
          el.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "smooth",
          });
        } catch {
          /* older engines: the card still lands in view */
        }
      }
      detach = () => {
        window.removeEventListener("scroll", update, true);
        window.removeEventListener("resize", update);
        observer?.disconnect();
        window.clearInterval(timer);
      };
    };

    const poll = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (el) {
        attach(el);
        return;
      }
      attempts += 1;
      if (attempts > 45 || Date.now() - startedAt > TARGET_TIMEOUT_MS) {
        // Keep the card without the dim so a missing target never leaves the
        // whole app shaded and unusable (see the shade fallback in the render).
        setRect(null);
        return;
      }
      timer = window.setTimeout(poll, TARGET_POLL_MS);
    };
    poll();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      detach?.();
    };
  }, [active, pathname, stepIndex]);

  /* Place the card next to the spotlight, clamped to the viewport. */
  useLayoutEffect(() => {
    if (!active) {
      setPos(null);
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const current = GUIDE_STEPS[stepIndex];
    if (!current) return;

    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    if (cw === 0 || ch === 0) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = VIEWPORT_MARGIN;

    let left: number;
    let top: number;
    const gap = CARD_GAP + (current.cardOffset ?? 0);

    if (!rect || current.placement === "center") {
      left = (vw - cw) / 2;
      top = (vh - ch) / 2;
    } else {
      const centerX = rect.left + rect.width / 2 - cw / 2;
      const centerY = rect.top + rect.height / 2 - ch / 2;
      const above = { left: centerX, top: rect.top - ch - gap };
      const below = { left: centerX, top: rect.top + rect.height + gap };
      const toLeft = { left: rect.left - cw - gap, top: centerY };
      const toRight = { left: rect.left + rect.width + gap, top: centerY };

      const tall = rect.height > vh * 0.45;
      // A target taller than the screen leaves no room on any side. The card is
      // pinned to the bottom edge (and the dot moves to the target's top edge,
      // see dotStyle), instead of hunting for the smallest overlap.
      const pinned = { left: (vw - cw) / 2, top: vh - ch - m - 8 };

      // Preference order per placement, then the other sides as fallbacks.
      const order =
        current.placement === "top"
          ? [above, below, toLeft, toRight]
          : current.placement === "bottom"
            ? [below, above, toLeft, toRight]
            : current.placement === "left"
              ? [toLeft, toRight, above, below]
              : [toRight, toLeft, above, below];

      const candidates = tall ? [pinned] : order;

      // The card must never sit on top of the spotlight, or it hides the very
      // thing the step is about (and the pointer dot with it).
      const blocked = {
        left: rect.left - DOT_SIZE - RING_PAD,
        top: rect.top - DOT_SIZE - RING_PAD,
        width: rect.width + (DOT_SIZE + RING_PAD) * 2,
        height: rect.height + (DOT_SIZE + RING_PAD) * 2,
      };

      const clampBox = (box: { left: number; top: number }) => ({
        left: Math.min(Math.max(m, box.left), Math.max(m, vw - cw - m)),
        top: Math.min(Math.max(m, box.top), Math.max(m, vh - ch - m)),
      });

      let chosen: { left: number; top: number } | null = null;
      let bestOverlap = Number.POSITIVE_INFINITY;
      let best = clampBox(candidates[0]);

      for (const candidate of candidates) {
        const box = clampBox(candidate);
        const overlapX = Math.min(box.left + cw, blocked.left + blocked.width) -
          Math.max(box.left, blocked.left);
        const overlapY = Math.min(box.top + ch, blocked.top + blocked.height) -
          Math.max(box.top, blocked.top);
        const area = overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
        if (area === 0) {
          chosen = box;
          break;
        }
        if (area < bestOverlap) {
          bestOverlap = area;
          best = box;
        }
      }

      const box = chosen ?? best;
      left = box.left;
      top = box.top;
    }

    const maxLeft = Math.max(m, vw - cw - m);
    const maxTop = Math.max(m, vh - ch - m);
    setPos({
      left: Math.min(Math.max(m, left), maxLeft),
      top: Math.min(Math.max(m, top), maxTop),
    });
  }, [active, rect, sizeTick, stepIndex]);

  /* Card height can change with the step (longer copy, different buttons). */
  useEffect(() => {
    if (!active) return;
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSizeTick((t) => t + 1));
    observer.observe(card);
    return () => observer.disconnect();
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => setSizeTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);

  /* Keyboard: arrows move, Escape leaves. */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        stop();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, next, previous, stop]);

  useEffect(() => {
    if (!active) return;
    const el = cardRef.current;
    if (!el) return;
    const id = window.setTimeout(() => el.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(id);
  }, [active, stepIndex]);

  /* First visit after onboarding: run once, resume where a reload left off. */
  useEffect(() => {
    if (active || autoStartRef.current) return;
    if (pathname !== APP_BASE) return;
    const local = localStore();
    if (!local || hasSeenGuide(local)) return;
    const session = sessionStore();
    if (session && hasGuideAutoStarted(session)) return;
    if (session) markGuideAutoStarted(session);
    autoStartRef.current = true;
    const resume = session ? readGuideStepIndex(session) : 0;
    const id = window.setTimeout(() => {
      if (mountedRef.current) start(resume);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [active, pathname, start]);

  /* "Start a session" on the last step: open a thread once we are home. */
  useEffect(() => {
    if (pathname !== APP_BASE) return;
    const session = sessionStore();
    if (!session || !consumeGuideNewChat(session)) return;
    const id = window.setTimeout(() => hostRef.current.startNewChat?.(), 400);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const value = useMemo<GuideContextValue>(
    () => ({
      active,
      stepIndex,
      step: active ? GUIDE_STEPS[stepIndex] ?? null : null,
      total: GUIDE_STEPS.length,
      start,
      stop,
      next,
      previous,
      registerHost,
    }),
    [active, next, previous, registerHost, start, stepIndex, stop]
  );

  const current = active ? GUIDE_STEPS[stepIndex] ?? null : null;
  const isLast = stepIndex >= GUIDE_STEPS.length - 1;
  const primaryLabel = current?.cta ?? (isLast ? "Done" : "Next");

  const onPrimary = () => {
    if (!current) return;
    if (current.finishActions && current.finishActions.length > 0) {
      const session = sessionStore();
      if (session) requestGuideNewChat(session);
      void runActions(current.finishActions);
      window.setTimeout(() => stop(), 320);
      return;
    }
    next();
  };

  return (
    <GuideContext.Provider value={value}>
      {children}
      {current ? (
        <div className="pg-root" data-guide-root="">
          {current.demo === "voice" && current.target ? (
            <GuideVoiceDemo composerSelector={current.target} />
          ) : null}
          {rect ? (
            <>
              <div
                className="pg-shade"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(0, rect.top - RING_PAD),
                }}
              />
              <div
                className="pg-shade"
                style={{
                  top: rect.top + rect.height + RING_PAD,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <div
                className="pg-shade"
                style={{
                  top: Math.max(0, rect.top - RING_PAD),
                  left: 0,
                  width: Math.max(0, rect.left - RING_PAD),
                  height: rect.height + RING_PAD * 2,
                }}
              />
              <div
                className="pg-shade"
                style={{
                  top: Math.max(0, rect.top - RING_PAD),
                  left: rect.left + rect.width + RING_PAD,
                  right: 0,
                  height: rect.height + RING_PAD * 2,
                }}
              />
              <div
                className="pg-ring"
                style={{
                  top: Math.max(0, rect.top - RING_PAD),
                  left: Math.max(0, rect.left - RING_PAD),
                  width: rect.width + RING_PAD * 2,
                  height: rect.height + RING_PAD * 2,
                }}
              />
              <div
                className="pg-dot"
                data-placement={current.placement}
                style={dotStyle(
                  rect,
                  current.placement,
                  rect.height > window.innerHeight * 0.45
                )}
                aria-hidden
              />
            </>
          ) : current.target ? null : (
            <div className="pg-shade pg-shade--full" />
          )}

          <div
            ref={cardRef}
            className="pg-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pg-title"
            aria-describedby="pg-body"
            tabIndex={-1}
            style={
              pos
                ? { left: pos.left, top: pos.top }
                : { left: 0, top: 0, visibility: "hidden" }
            }
          >
            <div className="pg-head">
              <span className="pg-kicker">{current.kicker ?? "Guide"}</span>
              <button
                type="button"
                className="pg-close"
                onClick={stop}
                aria-label="Close guide"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <h2 id="pg-title" className="pg-title">
              {current.title}
            </h2>
            <p id="pg-body" className="pg-body">
              {current.body}
            </p>

            <div className="pg-foot">
              <button type="button" className="pg-link" onClick={stop}>
                Skip
              </button>
              <span className="pg-progress">
                {stepIndex + 1} of {GUIDE_STEPS.length}
              </span>
              <div className="pg-actions">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="pg-btn pg-btn--ghost"
                    onClick={previous}
                  >
                    <ArrowLeft size={17} strokeWidth={2.25} aria-hidden />
                    <span>Back</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="pg-btn pg-btn--primary"
                  onClick={onPrimary}
                >
                  <span>{primaryLabel}</span>
                  {current.finishActions ? null : (
                    <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </GuideContext.Provider>
  );
}

function dotStyle(
  rect: GuideRect,
  placement: GuideStep["placement"],
  tall: boolean
): { left: number; top: number } {
  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;
  const half = DOT_SIZE / 2;
  const edge = RING_PAD;
  const clamp = (value: number) => Math.max(2, value);

  // Sit on the ring edge, not in the gap: the card is placed in the gap, so a
  // dot pushed further out would be painted over by it.
  //
  // A target taller than the screen gets its card pinned to the bottom, so the
  // dot moves to the top edge to stay clear of it.
  if (tall && placement !== "left" && placement !== "right") {
    return { left: clamp(midX - half), top: clamp(rect.top - edge - half) };
  }

  switch (placement) {
    case "top":
      return { left: clamp(midX - half), top: clamp(rect.top - edge - half) };
    case "bottom":
      return {
        left: clamp(midX - half),
        top: clamp(rect.top + rect.height + edge - half),
      };
    case "left":
      return { left: clamp(rect.left - edge - half), top: clamp(midY - half) };
    default:
      return {
        left: clamp(rect.left + rect.width + edge - half),
        top: clamp(midY - half),
      };
  }
}

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) {
    throw new Error("useGuide must be used within ProductGuideProvider");
  }
  return ctx;
}

/** Optional access when a subtree may render outside the provider (tests). */
export function useGuideOptional(): GuideContextValue | null {
  return useContext(GuideContext);
}

/**
 * Register app actions the tour can call. Re-registers on every render so the
 * engine always calls the freshest closures.
 */
export function useGuideHost(actions: GuideHostActions) {
  const register = useContext(GuideContext)?.registerHost;
  useEffect(() => {
    if (!register) return;
    register(actions);
  });
}
