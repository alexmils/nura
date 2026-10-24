"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Eye, Gamepad2, Volume2 } from "lucide-react";
import { reducedMotion, useInViewLoop, wait } from "./demo-loop";
import "./ground-first-tutorial.css";
import "./session-stage-demos.css";
import "./check-in-demo.css";

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

/* --- Check in: the real set screen, then the guide asks --- */

/**
 * Mirrors the app: screen 1 is the set surface (BallCanvas defaults: white
 * background, near-black ball with a soft shadow) with the ball sweeping
 * left-right ease-in-out; screen 2 is the guide's check-in in the chat
 * (typing dots, then the question). Loops while in view. Timing:
 * set 4.4s (4 passes of 1.1s), typing dots 1.2s, question 3.4s, then
 * back to the set (about 9s per loop).
 * Reduced motion: the check-in screen, static.
 */
export type CheckPhase = "set" | "typing" | "ask";
export const CHECK_PASS_MS = 1100;
export const CHECK_SET_PASSES = 4;
export const CHECK_SET_MS = CHECK_PASS_MS * CHECK_SET_PASSES;
export const CHECK_TYPING_MS = 1200;
export const CHECK_ASK_MS = 3400;
export const CHECK_QUESTION = "What did you notice?";

export function CheckInDemo({ forcePlay = false }: { forcePlay?: boolean }) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [phase, setPhase] = useState<CheckPhase>("set");
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setPhase("ask");
      return;
    }
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        setPhase("set");
        setLoop((n) => n + 1);
        await wait(CHECK_SET_MS);
        if (cancelled) return;
        setPhase("typing");
        await wait(CHECK_TYPING_MS);
        if (cancelled) return;
        setPhase("ask");
        await wait(CHECK_ASK_MS);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div
      ref={rootRef}
      className={`gft ssd ssd--check is-${phase}${inView ? " is-playing" : ""}`}
      data-phase={phase}
      aria-hidden
    >
      <div className="ssd-frame ssd-checkin">
        <div className="ssd-setscreen">
          <span
            key={loop}
            className="ssd-setball"
            style={{ ["--ssd-pass" as string]: `${CHECK_PASS_MS}ms` }}
          />
        </div>
        <div className="ssd-guide">
          <div className="ssd-chat">
            {phase === "typing" ? (
              <div className="gft-row gft-row--agent">
                <span className="gft-avatar gft-avatar--guide">
                  <Image src={GUIDE_MARK} alt="" width={28} height={28} />
                </span>
                <div className="gft-bubble gft-bubble--agent ssd-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
            {phase === "ask" ? <AgentRow>{CHECK_QUESTION}</AgentRow> : null}
          </div>
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
