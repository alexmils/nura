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
import { isAccessAllowedPath } from "@/lib/access-gate";
import {
  GUIDE_PREVIEW_PARAM as PREVIEW_PARAM,
  isGuidePreviewSearch,
} from "@/lib/guide-preview";
import { GuideVoiceDemo } from "./GuideVoiceDemo";
import {
  GUIDE_STEPS,
  clearGuideStepIndex,
  consumeGuideAutostart,
  consumeGuideNewChat,
  markGuideSeenForUser,
  requestGuideNewChat,
  resolveGuideAutostart,
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
  /** Stop a running set before the tour switches session. */
  stopSet?: () => void;
  /** Let go of the scratch session the tour opened, if it is still empty. */
  cleanupSession?: () => void;
  /**
   * Get the rail out of the way. On phones the sidebar is a fixed 280px drawer
   * over the workspace, so a step about the canvas, the controls, or the
   * library would otherwise be highlighted behind it. The host decides whether
   * that means anything (the desktop rail stays put).
   */
  closeSidebar?: () => void;
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
  /** Hide the tour while safety consent is on screen. The step is kept. */
  setHeld: (held: boolean) => void;
  /** `?tour=frost1` preview: shown regardless of consent, persists nothing. */
  preview: boolean;
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
function isFullyVisible(el: Element): boolean {  const r = el.getBoundingClientRect();
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

  const [userId, setUserId] = useState<string | null>(null);
  const [seenOnServer, setSeenOnServer] = useState(false);
  const [meChecked, setMeChecked] = useState(false);
  const [active, setActive] = useState(false);
  const [heldRaw, setHeld] = useState(false);
  const [preview, setPreview] = useState(false);
  const previewRef = useRef(false);
  const previewStartedRef = useRef(false);
  // Read once, before anything can touch the URL.
  const previewRequestedRef = useRef<boolean | null>(null);
  if (previewRequestedRef.current === null && typeof window !== "undefined") {
    previewRequestedRef.current = isGuidePreviewSearch(window.location.search);
  }
  // The preview ignores the consent hold (display only, consent not recorded).
  const held = heldRaw && !preview;
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<GuideRect | null>(null);
  const [anchorSettled, setAnchorSettled] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          user?: { id?: string; guideSeenAt?: string | null };
        };
        if (!cancelled) {
          setUserId(data.user?.id ?? null);
          // A dismissal on another device lives on the account, not on this
          // browser's localStorage.
          setSeenOnServer(Boolean(data.user?.guideSeenAt));
          setMeChecked(true);
        }
      } catch {
        /* tour can still run manually */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerHost = useCallback((actions: GuideHostActions) => {
    hostRef.current = { ...hostRef.current, ...actions };
  }, []);

  const goTo = useCallback((index: number) => {
    const clamped = Math.min(Math.max(0, index), GUIDE_STEPS.length - 1);
    setStepIndex(clamped);
    if (previewRef.current) return;
    const storage = sessionStore();
    if (storage) writeGuideStepIndex(storage, clamped);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setRect(null);
    setPos(null);
    prevStepRef.current = null;
    // Leaving must not leave a scratch session behind (or a set running).
    try {
      hostRef.current.stopSet?.();
      hostRef.current.closeGear?.();
      hostRef.current.closeAccountMenu?.();
      hostRef.current.cleanupSession?.();
    } catch {
      /* a failing host action must not trap the exit */
    }
    if (previewRef.current) {
      // Preview: nothing is marked seen or consumed, locally or on the account.
      previewRef.current = false;
      setPreview(false);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (isGuidePreviewSearch(url.searchParams)) {
          url.searchParams.delete(PREVIEW_PARAM);
          window.history.replaceState(window.history.state, "", url.toString());
        }
      }
      return;
    }
    const session = sessionStore();
    if (session) clearGuideStepIndex(session);
    const local = localStore();
    if (local) {
      markGuideSeenForUser(local, userId);
      // Onboarding may have queued an autostart; dismissing must cancel it.
      consumeGuideAutostart(local, userId);
    }
    // Persist on the account so a new device (or cleared storage) stays quiet.
    setSeenOnServer(true);
    if (userId) {
      void fetch("/api/guide/seen", { method: "POST" }).catch(() => {
        /* the local flag still holds for this browser */
      });
    }
  }, [userId]);

  const start = useCallback((from = 0) => {
    const next = Math.min(Math.max(0, from), GUIDE_STEPS.length - 1);
    prevStepRef.current = null;
    setStepIndex(next);
    setRect(null);
    setPos(null);
    setActive(true);
    if (previewRef.current) return;
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
            case "stopSet":
              host.stopSet?.();
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

  /* Prepare the step once its screen is mounted. Failure must not change the step. */
  useEffect(() => {
    if (!active || held) return;
    const current = GUIDE_STEPS[stepIndex];
    if (!current) return;
    // Resources and the session screen are different pages. Preparing on the
    // wrong one fails, and skipping the session block jumped step 6 to 16.
    if (current.surface !== pathname) return;

    let cancelled = false;

    const run = async () => {
      const previousStep = prevStepRef.current;
      if (previousStep && previousStep.id !== current.id) {
        await runActions(previousStep.cleanup);
      }
      if (cancelled) return;
      prevStepRef.current = current;

      const ok = await runActions(current.prepare, current);
      if (cancelled || ok || current.group !== "session") return;
      // The mode step opens the picker. Other session steps open the set themselves.
      if (current.prepare?.some((action) => action !== "ensurePendingThread" && action !== "stopSet")) {
        return;
      }
      const created = await hostRef.current.ensurePendingThread?.();
      if (cancelled || !created) return;
      const retry = (current.prepare ?? []).filter(
        (action) => action !== "ensurePendingThread"
      );
      if (retry.length === 0) return;
      await runActions(retry, current);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [active, held, stepIndex, pathname, runActions]);

  /* The step button picks the screen. Replace so the browser Back stack stays out of it. */
  useEffect(() => {
    if (!active || held) return;
    const current = GUIDE_STEPS[stepIndex];
    if (!current) return;
    if (current.surface !== pathname) router.replace(current.surface);
  }, [active, held, pathname, router, stepIndex]);

  /* Find and measure the spotlight target, and keep the measurement fresh. */
  useEffect(() => {
    if (!active || held) {
      setRect(null);
      return;
    }
    const current = GUIDE_STEPS[stepIndex];
    const selector = current?.target;
    if (!selector) {
      setRect(null);
      setAnchorSettled(true);
      return;
    }
    setAnchorSettled(false);

    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let detach: (() => void) | null = null;
    let timer = 0;
    let attempts = 0;
    const startedAt = Date.now();
    /** Last measured box, so a 4Hz poll does not re-render the card for nothing. */
    let lastKey = "";

    const attach = (el: Element) => {
      // A step about the workspace must not be highlighted behind the mobile
      // drawer: close it before measuring. Steps inside the rail keep it open.
      if (!el.closest(".app-sidebar")) hostRef.current.closeSidebar?.();

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
        setAnchorSettled(true);
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
  }, [active, held, pathname, stepIndex]);

  /* Place the card next to the spotlight, clamped to the viewport. */
  useLayoutEffect(() => {
    if (!active || held) {
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

    if (!rect && current.target && !anchorSettled) {
      setPos(null);
      return;
    }

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
      // pinned above the controls bar (and the dot moves to the target's top
      // edge, see dotStyle), instead of hunting for the smallest overlap.
      const dock = document.querySelector(".bls-dock");
      const dockBox = dock?.getBoundingClientRect();
      const dockTop =
        dockBox && dockBox.height > 8 && dockBox.top < vh ? dockBox.top : null;
      const pinnedTop =
        dockTop != null
          ? dockTop - ch - 12
          : vh - ch - m - 8;
      const pinned = { left: (vw - cw) / 2, top: pinnedTop };

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
      // The controls bar is not part of the spotlight, but the pinned card
      // used to cover its labels. Keep the card above that bar.
      if (dockTop != null && top + ch > dockTop - 12) {
        top = dockTop - ch - 12;
      }
    }

    const maxLeft = Math.max(m, vw - cw - m);
    const maxTop = Math.max(m, vh - ch - m);
    setPos({
      left: Math.min(Math.max(m, left), maxLeft),
      top: Math.min(Math.max(m, top), maxTop),
    });
  }, [active, held, anchorSettled, rect, sizeTick, stepIndex]);

  /* Card height can change with the step (longer copy, different buttons). */
  useEffect(() => {
    if (!active || held) return;
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSizeTick((t) => t + 1));
    observer.observe(card);
    return () => observer.disconnect();
  }, [active, held, stepIndex]);

  useEffect(() => {
    if (!active || held) return;
    const onResize = () => setSizeTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, held]);

  /* Keyboard: arrows move, Escape leaves. */
  useEffect(() => {
    if (!active || held) return;
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
  }, [active, held, next, previous, stop]);

  useEffect(() => {
    if (!active || held) return;
    const el = cardRef.current;
    if (!el) return;
    const id = window.setTimeout(() => el.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(id);
  }, [active, held, stepIndex]);

  /* First visit after onboarding: run once, resume where a reload left off.
     Only inside the app itself (not login, onboarding, billing, settings),
     only once the account and its tour state are known, and decided when the
     timer fires: a hold (consent screen) or a route change in between
     cancels the timer without using up the one autostart. */
  useEffect(() => {
    if (active || autoStartRef.current || held) return;
    if (!pathname?.startsWith(APP_BASE) || isAccessAllowedPath(pathname)) return;
    if (!userId || !meChecked) return;
    const id = window.setTimeout(() => {
      if (!mountedRef.current || autoStartRef.current) return;
      const local = localStore();
      if (!local) return;
      autoStartRef.current = true;
      const decision = resolveGuideAutostart(local, sessionStore(), userId, seenOnServer);
      if (decision.start) start(decision.resumeIndex);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [active, held, meChecked, pathname, seenOnServer, start, userId]);

  /* Preview: /app?tour=frost1 opens the intro for any signed-in account
     (tour already seen, consent missing, admin) without persisting anything. */
  useEffect(() => {
    if (!pathname?.startsWith(APP_BASE) || isAccessAllowedPath(pathname)) return;
    // React dev (Strict Mode) runs this effect twice and clears the first
    // timer, so the guard is "started", not "seen the param".
    if (previewStartedRef.current || active) return;
    if (!previewRequestedRef.current && !isGuidePreviewSearch(window.location.search)) {
      return;
    }
    previewRef.current = true;
    autoStartRef.current = true;
    setPreview(true);
    const id = window.setTimeout(() => {
      if (!mountedRef.current || previewStartedRef.current) return;
      previewStartedRef.current = true;
      previewRef.current = true;
      start(0);
    }, 400);
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
      setHeld,
      preview,
      registerHost,
    }),
    [active, next, preview, previous, registerHost, setHeld, start, stepIndex, stop]
  );

  const current = active && !held ? GUIDE_STEPS[stepIndex] ?? null : null;
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
        <div
          className={`pg-root${current.target ? "" : " pg-root--intro"}`}
          data-guide-root=""
        >
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
