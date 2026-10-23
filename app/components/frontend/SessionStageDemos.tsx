"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Activity, Eye, Gamepad2, Volume2 } from "lucide-react";
import { reducedMotion, useInViewLoop, wait } from "./demo-loop";
import "./ground-first-tutorial.css";
import "./session-stage-demos.css";

/* Built-in default media for the "How it works" stages that have no uploaded
   image or video: Choose your rhythm, Check in, Close gently. Same mini-app
   look as the Ground first demos (gft-* bubbles, chips, avatar). */

const GUIDE_MARK = "/brand/nura-circle-variants/A-white-on-sage-128.png";

export type RhythmMode = "eyes" | "ears" | "hands";
export const RHYTHM_MODES: RhythmMode[] = ["eyes", "ears", "hands"];

const RHYTHM_CAPTION: Record<RhythmMode, string> = {
  eyes: "Visual set",
  ears: "Stereo cues",
  hands: "Gamepad pulse",
};

function AgentRow({ children }: { children: string }) {
  return (
    <div className="gft-row gft-row--agent">
      <span className="gft-avatar gft-avatar--guide">
        <Image src={GUIDE_MARK} alt="" width={28} height={28} />
      </span>
      <div className="gft-bubble gft-bubble--agent">
        <p>{children}</p>
      </div>
    </div>
  );
}

function UserRow({ children }: { children: string }) {
  return (
    <div className="gft-row gft-row--user">
      <div className="gft-bubble gft-bubble--user">
        <p>{children}</p>
      </div>
    </div>
  );
}

/* ─── Choose your rhythm: one ball, three ways to feel it ─── */

/**
 * Left-right ball (bilateral stimulation). The pulse decorations share the
 * ball's 2.4s cycle (left at 0%, right at 50%), so ears/hands light up on the
 * side the ball reaches. `pinned` (hover/click on a card) stops auto-cycling.
 */
export function RhythmDemo({
  pinned = null,
  onModeChange,
  forcePlay = false,
}: {
  pinned?: RhythmMode | null;
  onModeChange?: (mode: RhythmMode) => void;
  forcePlay?: boolean;
}) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [auto, setAuto] = useState<RhythmMode>("eyes");
  const mode = pinned ?? auto;

  useEffect(() => {
    if (pinned || !inView || reducedMotion()) return;
    const t = window.setInterval(() => {
      setAuto((m) => RHYTHM_MODES[(RHYTHM_MODES.indexOf(m) + 1) % RHYTHM_MODES.length]);
    }, 4800);
    return () => window.clearInterval(t);
  }, [pinned, inView]);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const Icon = mode === "eyes" ? Eye : mode === "ears" ? Volume2 : Gamepad2;

  return (
    <div
      ref={rootRef}
      className={`gft ssd ssd--rhythm is-${mode}${inView ? " is-playing" : ""}`}
      aria-hidden
    >
      <div className="ssd-frame">
        <div className="ssd-pill" key={mode}>
          <Icon size={13} strokeWidth={2.2} aria-hidden />
          <span>{RHYTHM_CAPTION[mode]}</span>
        </div>
        {/* Fixed stage: each mode shows only its own cue, all on the same
            2.4s cycle (left at 0%, right at 50%). Eyes = ball, Ears = the
            speakers alone, Hands = the gamepad alone. */}
        <div className="ssd-stage">
          <div className="ssd-track">
            <span className="ssd-side ssd-side--l">
              <span className="ssd-wave" />
              <span className="ssd-wave ssd-wave--2" />
              <Volume2 className="ssd-speaker" size={20} strokeWidth={2} aria-hidden />
            </span>
            <div className="ssd-lane">
              <span className="ssd-ball" />
            </div>
            <span className="ssd-side ssd-side--r">
              <span className="ssd-wave" />
              <span className="ssd-wave ssd-wave--2" />
              <Volume2 className="ssd-speaker" size={20} strokeWidth={2} aria-hidden />
            </span>
          </div>
          <div className="ssd-pad">
            <span className="ssd-rumble ssd-rumble--l" />
            <span className="ssd-rumble ssd-rumble--l ssd-rumble--outer" />
            <Gamepad2 className="ssd-pad-icon" size={44} strokeWidth={1.7} aria-hidden />
            <span className="ssd-rumble ssd-rumble--r ssd-rumble--outer" />
            <span className="ssd-rumble ssd-rumble--r" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Check in: the set winds down, SUD + body scan ─── */

type CheckScene = {
  stopped: boolean;
  ask: boolean;
  sud: number | null;
  scan: boolean;
  chips: boolean;
};

const CHECK_START: CheckScene = { stopped: false, ask: false, sud: null, scan: false, chips: false };
const CHECK_END: CheckScene = { stopped: true, ask: true, sud: 5, scan: true, chips: true };

/** Ball eases to a stop in the middle (rAF; amplitude and speed decay together). */
function useWindDownBall(ref: RefObject<HTMLSpanElement | null>, running: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!running) {
      el.style.transform = "translateX(0)";
      return;
    }
    let raf = 0;
    let phase = 0;
    let last = performance.now();
    const start = last;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const t = (now - start) / 1000;
      // Full speed for ~1.6s, then slow to a stop over ~1.8s.
      const k = t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 1.8);
      phase += dt * Math.PI * 1.25 * (0.25 + 0.75 * k);
      const amp = k;
      el.style.transform = `translateX(calc(${Math.sin(phase) * amp} * var(--ssd-travel)))`;
      if (k > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, running]);
}

export function CheckInDemo({ forcePlay = false }: { forcePlay?: boolean }) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [scene, setScene] = useState<CheckScene>(CHECK_START);
  const ballRef = useRef<HTMLSpanElement | null>(null);
  useWindDownBall(ballRef, inView && !scene.stopped);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setScene(CHECK_END);
      return;
    }
    let cancelled = false;
    const step = async (ms: number, next: Partial<CheckScene>) => {
      await wait(ms);
      if (cancelled) return false;
      setScene((s) => ({ ...s, ...next }));
      return true;
    };
    const run = async () => {
      while (!cancelled) {
        setScene(CHECK_START);
        if (!(await step(3500, { stopped: true }))) return;
        if (!(await step(450, { ask: true }))) return;
        if (!(await step(800, { sud: 7 }))) return;
        if (!(await step(700, { sud: 6 }))) return;
        if (!(await step(450, { sud: 5 }))) return;
        if (!(await step(600, { scan: true }))) return;
        if (!(await step(800, { chips: true }))) return;
        await wait(3200);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div ref={rootRef} className="gft ssd ssd--check" aria-hidden>
      <div className="ssd-frame ssd-frame--chat">
        <div className={scene.stopped ? "ssd-set is-done" : "ssd-set"}>
          <span className="ssd-set-label">{scene.stopped ? "Set 3 · paused" : "Set 3"}</span>
          <div className="ssd-lane ssd-lane--mini">
            <span className="ssd-rail" />
            <span ref={ballRef} className="ssd-ball ssd-ball--js" />
          </div>
        </div>
        <div className="ssd-chat">
          {scene.ask ? <AgentRow>What do you notice now?</AgentRow> : null}
          {scene.sud !== null ? (
            <div className="ssd-sud gft-row">
              <div className="ssd-sud-head">
                <span>SUD</span>
                <strong>{scene.sud}</strong>
              </div>
              <div className="ssd-sud-bar">
                <span className="ssd-sud-fill" style={{ width: `${scene.sud * 10}%` }} />
                <span className="ssd-sud-thumb" style={{ left: `${scene.sud * 10}%` }} />
              </div>
              <div className="ssd-sud-scale">
                <span>0</span>
                <span>10</span>
              </div>
            </div>
          ) : null}
          {scene.scan ? (
            <p className="ssd-hint gft-row">
              <Activity size={12} strokeWidth={2.2} aria-hidden />
              Body scan: chest a little lighter
            </p>
          ) : null}
          {scene.chips ? (
            <div className="gft-chips ssd-chips">
              <span className="gft-chip">Another set</span>
              <span className="gft-chip">I&apos;d like to stop</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Close gently: ground out, then a calm closing card ─── */

type CloseScene = {
  offer: boolean;
  chip: boolean;
  pressed: boolean;
  reply: boolean;
  closed: boolean;
  fade: boolean;
};

const CLOSE_START: CloseScene = {
  offer: false,
  chip: false,
  pressed: false,
  reply: false,
  closed: false,
  fade: false,
};
const CLOSE_END: CloseScene = {
  offer: true,
  chip: false,
  pressed: false,
  reply: true,
  closed: true,
  fade: false,
};

const CLOSE_REPLY = "The window, a plant, my mug.";

export function CloseGentlyDemo({ forcePlay = false }: { forcePlay?: boolean }) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [scene, setScene] = useState<CloseScene>(CLOSE_START);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setScene(CLOSE_END);
      return;
    }
    let cancelled = false;
    const step = async (ms: number, next: Partial<CloseScene>) => {
      await wait(ms);
      if (cancelled) return false;
      setScene((s) => ({ ...s, ...next }));
      return true;
    };
    const run = async () => {
      while (!cancelled) {
        setScene(CLOSE_START);
        if (!(await step(500, { offer: true }))) return;
        if (!(await step(1100, { chip: true }))) return;
        if (!(await step(900, { pressed: true }))) return;
        if (!(await step(350, { chip: false, reply: true }))) return;
        if (!(await step(1200, { closed: true }))) return;
        if (!(await step(3400, { fade: true }))) return;
        await wait(900);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div ref={rootRef} className="gft ssd ssd--close" aria-hidden>
      <div className={scene.fade ? "ssd-frame ssd-frame--chat is-fading" : "ssd-frame ssd-frame--chat"}>
        <div className={scene.closed ? "ssd-chat is-behind" : "ssd-chat"}>
          {scene.offer ? (
            <AgentRow>Before we close, let&apos;s ground. Name 3 things you can see.</AgentRow>
          ) : null}
          {scene.reply ? <UserRow>{CLOSE_REPLY}</UserRow> : null}
          {scene.chip ? (
            <div className="gft-chips ssd-chips ssd-chips--end">
              <span className={scene.pressed ? "gft-chip is-pressed" : "gft-chip"}>{CLOSE_REPLY}</span>
            </div>
          ) : null}
        </div>
        {scene.closed ? (
          <div className="ssd-closed">
            <span className="gft-avatar gft-avatar--guide ssd-closed-mark">
              <Image src={GUIDE_MARK} alt="" width={28} height={28} />
            </span>
            <p className="ssd-closed-title">
              Session closed <span aria-hidden>·</span> SUD 7 → 3
            </p>
            <p className="ssd-closed-line">Come back whenever you&apos;re ready.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
