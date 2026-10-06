"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, Home, Plus, User } from "lucide-react";
import { BrandLockup } from "@/app/components/BrandLockup";
import {
  SESSION_MODE_GUIDED_LABEL,
  SESSION_MODE_SELF_LABEL,
} from "@/lib/brand";
import "./ground-first-tutorial.css";

const GUIDE_MARK = "/brand/nura-circle-variants/A-white-on-sage-128.png";

const MOCK_RECENT = ["Feet on the floor", "Calm place check-in"];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function useInViewLoop(enabled: boolean) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(enabled);

  useEffect(() => {
    if (enabled) {
      setInView(true);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  return { rootRef, inView };
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ─── 1. Mode pick (cursor click, no zoom) ─── */

type ModeScene = {
  cursorX: number;
  cursorY: number;
  clicking: boolean;
  guidedHover: boolean;
  guidedSelected: boolean;
};

const MODE_END: ModeScene = {
  cursorX: 55,
  cursorY: 58,
  clicking: false,
  guidedHover: false,
  guidedSelected: true,
};

const MODE_START: ModeScene = {
  cursorX: 62,
  cursorY: 28,
  clicking: false,
  guidedHover: false,
  guidedSelected: false,
};

function pointInCamera(
  camera: HTMLElement,
  target: HTMLElement,
  ox = 0.5,
  oy = 0.42
): { x: number; y: number } {
  const cr = camera.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  if (cr.width < 1 || cr.height < 1) {
    return { x: MODE_END.cursorX, y: MODE_END.cursorY };
  }
  return {
    x: ((tr.left + tr.width * ox - cr.left) / cr.width) * 100,
    y: ((tr.top + tr.height * oy - cr.top) / cr.height) * 100,
  };
}

export function ModePickDemo({
  forcePlay = false,
}: {
  forcePlay?: boolean;
}) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const guidedRef = useRef<HTMLDivElement | null>(null);
  const [scene, setScene] = useState<ModeScene>(MODE_START);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setScene(MODE_END);
      return;
    }
    let cancelled = false;

    const guidedPoint = () => {
      const cam = cameraRef.current;
      const card = guidedRef.current;
      if (!cam || !card) {
        return { x: MODE_END.cursorX, y: MODE_END.cursorY };
      }
      return pointInCamera(cam, card);
    };

    const aim = async (
      x: number,
      y: number,
      patch: Partial<ModeScene> = {},
      ms = 600
    ) => {
      if (cancelled) return;
      setScene((s) => ({
        ...s,
        ...patch,
        cursorX: x,
        cursorY: y,
      }));
      await wait(ms);
    };

    const click = async () => {
      if (cancelled) return;
      setScene((s) => ({ ...s, clicking: true }));
      await wait(160);
      if (cancelled) return;
      setScene((s) => ({ ...s, clicking: false }));
    };

    const run = async () => {
      while (!cancelled) {
        setScene(MODE_START);
        await wait(1800);
        if (cancelled) return;

        const { x, y } = guidedPoint();
        await aim(x, y, { guidedHover: true }, 900);
        if (cancelled) return;
        await wait(350);
        if (cancelled) return;

        await click();
        if (cancelled) return;
        setScene((s) => ({
          ...s,
          guidedSelected: true,
          guidedHover: false,
          cursorX: x,
          cursorY: y,
        }));
        await wait(2200);
        if (cancelled) return;

        await aim(MODE_START.cursorX, MODE_START.cursorY, {
          guidedSelected: false,
        }, 800);
        if (cancelled) return;
        await wait(500);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div ref={rootRef} className="gft gft--mode" aria-hidden>
      <div className="gft-viewport">
        <div ref={cameraRef} className="gft-camera gft-camera--static">
          <div className="gft-shell">
            <aside className="gft-shell-sidebar">
              <div className="gft-shell-brand">
                <BrandLockup href={null} tone="white" className="gft-shell-logo" />
              </div>
              <div className="gft-shell-new">
                <span className="gft-shell-new-btn">
                  <Plus size={12} strokeWidth={2.25} aria-hidden />
                  New chat
                </span>
              </div>
              <nav className="gft-shell-nav">
                <span className="gft-shell-nav-link is-active">
                  <Home size={12} strokeWidth={2} aria-hidden />
                  Home
                </span>
                <span className="gft-shell-nav-link">
                  <BookOpen size={12} strokeWidth={2} aria-hidden />
                  Resources
                </span>
              </nav>
              <p className="gft-shell-section">Recent</p>
              <div className="gft-shell-recent">
                {MOCK_RECENT.map((title) => (
                  <span key={title} className="gft-shell-thread">
                    {title}
                  </span>
                ))}
              </div>
              <div className="gft-shell-foot">
                <span className="gft-shell-account">
                  <span className="gft-shell-account-av">A</span>
                  Alex
                </span>
              </div>
            </aside>
            <div className="gft-shell-main">
              <div className="gft-picker">
                <h3 className="gft-picker-title">Start a session</h3>
                <p className="gft-picker-lead">
                  AI agent-guided (with a session guide) or Self-guided (sets
                  you run yourself). This choice stays for this session.
                </p>
                <div className="gft-picker-grid">
                  <div
                    ref={guidedRef}
                    className={
                      scene.guidedSelected
                        ? "gft-mode-card is-selected"
                        : scene.guidedHover
                          ? "gft-mode-card is-hover"
                          : "gft-mode-card"
                    }
                  >
                    <span className="gft-mode-num">1</span>
                    <p className="gft-mode-title">{SESSION_MODE_GUIDED_LABEL}</p>
                    <p className="gft-mode-line">
                      An AI session guide walks you through EMDR phases,
                      grounding, and check-ins after each set.
                    </p>
                  </div>
                  <div className="gft-mode-card">
                    <span className="gft-mode-num">2</span>
                    <p className="gft-mode-title">{SESSION_MODE_SELF_LABEL}</p>
                    <p className="gft-mode-line">
                      Animation, sound, and joystick rumble. You set speed and
                      timing. No agent, no chat.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={
              scene.clicking ? "gft-cursor is-click" : "gft-cursor"
            }
            style={{
              left: `${scene.cursorX}%`,
              top: `${scene.cursorY}%`,
            }}
          >
            <svg
              className="gft-cursor-svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M5.5 3.2 5.5 18.8 10.1 14.6 13.2 21.1 15.4 20.1 12.2 13.4 18.2 13.4 5.5 3.2Z"
                fill="#1a1f14"
                stroke="#fff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
            <span className="gft-cursor-ripple" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Safe place (no cursor) ─── */

type SafeScene = {
  draft: string;
  showUser: boolean;
  showAgent: boolean;
  showChip: boolean;
  ken: number;
};

const SAFE_USER = "Feet on the floor.";
const SAFE_AGENT = "Good. Stay with that calm place for a moment.";

const SAFE_END: SafeScene = {
  draft: "",
  showUser: true,
  showAgent: true,
  showChip: true,
  ken: 1.04,
};

const SAFE_START: SafeScene = {
  draft: "",
  showUser: false,
  showAgent: false,
  showChip: false,
  ken: 1,
};

export function SafePlaceDemo({
  forcePlay = false,
}: {
  forcePlay?: boolean;
}) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [scene, setScene] = useState<SafeScene>(SAFE_START);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setScene(SAFE_END);
      return;
    }
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        setScene(SAFE_START);
        await wait(600);
        if (cancelled) return;

        setScene((s) => ({ ...s, ken: 1.06 }));
        await wait(400);

        let typed = "";
        for (const ch of SAFE_USER) {
          if (cancelled) return;
          typed += ch;
          const next = typed;
          setScene((s) => ({ ...s, draft: next }));
          await wait(48);
        }
        await wait(350);
        if (cancelled) return;

        setScene((s) => ({
          ...s,
          draft: "",
          showUser: true,
          ken: 1.08,
        }));
        await wait(500);
        if (cancelled) return;

        setScene((s) => ({ ...s, showAgent: true }));
        await wait(900);
        if (cancelled) return;

        setScene((s) => ({ ...s, showChip: true, ken: 1.05 }));
        await wait(1800);
        if (cancelled) return;

        setScene((s) => ({ ...s, ken: 1 }));
        await wait(700);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div ref={rootRef} className="gft gft--safe" aria-hidden>
      <div className="gft-viewport gft-viewport--card">
        <div
          className="gft-camera"
          style={{
            transformOrigin: "50% 55%",
            transform: `scale(${scene.ken})`,
          }}
        >
          <div className="gft-mini-chat">
            <div className="gft-mini-body">
              {scene.showUser ? (
                <div className="gft-row gft-row--user">
                  <div className="gft-bubble gft-bubble--user">
                    <p>{SAFE_USER}</p>
                  </div>
                  <span className="gft-avatar gft-avatar--user">
                    <User size={12} strokeWidth={2.1} aria-hidden />
                  </span>
                </div>
              ) : null}
              {scene.showAgent ? (
                <div className="gft-row gft-row--agent">
                  <span className="gft-avatar gft-avatar--guide">
                    <Image src={GUIDE_MARK} alt="" width={28} height={28} />
                  </span>
                  <div className="gft-bubble gft-bubble--agent">
                    <p>{SAFE_AGENT}</p>
                  </div>
                </div>
              ) : null}
              {scene.showChip ? (
                <div className="gft-chips">
                  <span className="gft-chip is-pressed">I&apos;m settled</span>
                </div>
              ) : null}
            </div>
            <div
              className={
                scene.draft || (!scene.showUser && !scene.showAgent)
                  ? "gft-composer is-focus"
                  : "gft-composer"
              }
            >
              <span className="gft-composer-draft">
                {scene.draft ||
                  (!scene.showUser ? (
                    <span className="gft-composer-hint">Write a reply…</span>
                  ) : null)}
                {scene.draft ? <span className="gft-caret" /> : null}
              </span>
              <span
                className={scene.draft ? "gft-send is-ready" : "gft-send"}
              >
                <ArrowUp size={12} strokeWidth={2.4} aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 3. No cold starts (static phase swap, no camera) ─── */

type ColdScene = {
  phase: "intake" | "grounding";
  showHint: boolean;
};

const COLD_END: ColdScene = {
  phase: "grounding",
  showHint: true,
};

const COLD_START: ColdScene = {
  phase: "intake",
  showHint: false,
};

export function NoColdStartDemo({
  forcePlay = false,
}: {
  forcePlay?: boolean;
}) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [scene, setScene] = useState<ColdScene>(COLD_START);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setScene(COLD_END);
      return;
    }
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        setScene(COLD_START);
        await wait(1100);
        if (cancelled) return;

        setScene({ phase: "grounding", showHint: false });
        await wait(700);
        if (cancelled) return;

        setScene({ phase: "grounding", showHint: true });
        await wait(2200);
        if (cancelled) return;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div ref={rootRef} className="gft gft--cold" aria-hidden>
      <div className="gft-viewport gft-viewport--card">
        <div className="gft-camera gft-camera--static">
          <div className="gft-phase">
            <span className="gft-phase-label">Phase</span>
            <span
              key={scene.phase}
              className={
                scene.phase === "grounding"
                  ? "gft-phase-pill is-ground"
                  : "gft-phase-pill"
              }
            >
              {scene.phase === "intake" ? "Intake" : "Grounding"}
            </span>
            <p
              className={
                scene.showHint
                  ? "gft-phase-hint is-on"
                  : "gft-phase-hint"
              }
            >
              {scene.phase === "intake"
                ? "A few calm questions first."
                : "Ready when you are. No set yet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer ModePickDemo / SafePlaceDemo / NoColdStartDemo */
export function GroundFirstTutorial({
  variant = "embedded",
}: {
  variant?: "embedded" | "stage";
}) {
  return <ModePickDemo forcePlay={variant === "stage"} />;
}
