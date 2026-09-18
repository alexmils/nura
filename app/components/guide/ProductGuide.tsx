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
import { ArrowLeft, ArrowRight, Gamepad2, X } from "lucide-react";
import { APP_BASE } from "@/lib/app-base";
import { useGamepadConnected } from "@/lib/useGamepadConnected";
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
const TARGET_TIMEOUT_MS = 5000;

type GuideRect = { top: number; left: number; width: number; height: number };

export type GuideHostActions = {
  openSidebar?: () => void;
  openAccountMenu?: () => void;
  closeAccountMenu?: () => void;
  ensurePendingThread?: () => Promise<boolean> | boolean;
  chooseSelfGuided?: () => Promise<boolean> | boolean;
  chooseGuided?: () => Promise<boolean> | boolean;
  openGear?: () => void;
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

/** Live controller status, shown only inside the tour. */
function GamepadDemo() {
  const connected = useGamepadConnected();

  return (
    <div className="pg-demo" data-guide="joystick-demo">
      <span className={`pg-chip${connected ? " is-on" : " is-off"}`}>
        <Gamepad2 size={17} strokeWidth={2.1} aria-hidden />
        {connected ? "Connected" : "Disconnected"}
      </span>
      <p className="pg-demo-hint">
        {connected
          ? "Connected. The rumble control appears in the controls bar, so you can pick soft or hard."
          : "Nothing is connected right now. Plug in a controller and this chip turns to Connected."}
      </p>
    </div>
  );
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
    async (actions?: GuideAction[]): Promise<boolean> => {
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

      const ok = await runActions(current.prepare);
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

    const attach = (el: Element) => {
      const update = () => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          setRect(null);
          return;
        }
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      };
      update();

      window.addEventListener("scroll", update, true);
      window.addEventListener("resize", update);
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(update);
        observer.observe(el);
      }
      detach = () => {
        window.removeEventListener("scroll", update, true);
        window.removeEventListener("resize", update);
        observer?.disconnect();
      };

      const r = el.getBoundingClientRect();
      const offscreen =
        r.top < 0 ||
        r.bottom > window.innerHeight ||
        r.left < 0 ||
        r.right > window.innerWidth;
      if (offscreen) {
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
        setRect(null);
        return;
      }
      timer = window.setTimeout(poll, 110);
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

    if (!rect || current.placement === "center") {
      left = (vw - cw) / 2;
      top = (vh - ch) / 2;
    } else {
      switch (current.placement) {
        case "top":
          left = rect.left + rect.width / 2 - cw / 2;
          top = rect.top - ch - CARD_GAP;
          break;
        case "bottom":
          left = rect.left + rect.width / 2 - cw / 2;
          top = rect.top + rect.height + CARD_GAP;
          break;
        case "left":
          left = rect.left - cw - CARD_GAP;
          top = rect.top + rect.height / 2 - ch / 2;
          break;
        default:
          left = rect.left + rect.width + CARD_GAP;
          top = rect.top + rect.height / 2 - ch / 2;
          break;
      }

      // Flip to the other side when the preferred side has no room.
      if (top < m && current.placement === "top") {
        top = rect.top + rect.height + CARD_GAP;
      } else if (top + ch > vh - m && current.placement === "bottom") {
        top = rect.top - ch - CARD_GAP;
      }
      if (left < m && current.placement === "right") {
        left = rect.left - cw - CARD_GAP;
      } else if (left + cw > vw - m && current.placement === "left") {
        left = rect.left + rect.width + CARD_GAP;
      }
    }

    const maxLeft = Math.max(m, vw - cw - m);
    const maxTop = Math.max(m, vh - ch - m);
    setPos({
      left: Math.min(Math.max(m, left), maxLeft),
      top: Math.min(Math.max(m, top), maxTop),
    });
  }, [active, rect, sizeTick, stepIndex]);

  /* Card height can change with the step (demo chip, wrapping copy). */
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
                style={dotStyle(rect, current.placement)}
                aria-hidden
              />
            </>
          ) : (
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

            {current.demo === "gamepad" ? <GamepadDemo /> : null}

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
                {current.finishSecondaryCta ? (
                  <button
                    type="button"
                    className="pg-btn pg-btn--ghost"
                    onClick={stop}
                  >
                    {current.finishSecondaryCta}
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
  placement: GuideStep["placement"]
): { left: number; top: number } {
  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;
  const half = DOT_SIZE / 2;
  const edge = RING_PAD;
  const clamp = (value: number) => Math.max(2, value);

  // Sit on the ring edge, not in the gap: the card is placed in the gap, so a
  // dot pushed further out would be painted over by it.
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
