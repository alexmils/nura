"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Circle,
  Eye,
  Gamepad2,
  Infinity as InfinityIcon,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
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

/* --- Check in: the real set screen, then the guide's check-in --- */

/**
 * A scaled-down replica of the real session screen. The set surface and the
 * BLS control bar are rendered at a fixed virtual desktop size (1280px wide,
 * the card's aspect) with the app's own .bls-* classes from globals.css, then
 * scaled with one transform so every proportion matches the app. The chat
 * uses the app's .agent-chat-* classes, scaled separately so it stays legible.
 *
 * Loop (about 11.6s): ball 2 passes (2.2s), 0.4s fade, then the check-in
 * conversation (agent lines get 0.6s typing dots first), then back to the set.
 * Reduced motion: the full conversation, static.
 */
export const CHECK_VIRTUAL_W = 1280;
export const CHECK_CHAT_VIRTUAL_W = 768;
export const CHECK_PASS_MS = 1100;
export const CHECK_SET_PASSES = 2;
export const CHECK_SET_MS = CHECK_PASS_MS * CHECK_SET_PASSES;
export const CHECK_FADE_MS = 400;
export const CHECK_TYPING_MS = 600;
export const CHECK_QUESTION = "What did you notice?";

export type CheckLine = { role: "agent" | "user"; text: string; holdMs: number };
export const CHECK_SCRIPT: CheckLine[] = [
  { role: "agent", text: CHECK_QUESTION, holdMs: 1400 },
  { role: "user", text: "My chest feels a bit lighter.", holdMs: 1200 },
  { role: "agent", text: "On a scale of 0\u201310, how disturbing does it feel now?", holdMs: 1400 },
  { role: "user", text: "4", holdMs: 1100 },
  { role: "agent", text: "Let\u2019s do another set.", holdMs: 1800 },
];

/** Total loop length in ms (set + fade + typing before agent lines + holds). */
export function checkLoopMs(): number {
  return (
    CHECK_SET_MS +
    CHECK_FADE_MS +
    CHECK_SCRIPT.reduce((t, l) => t + l.holdMs + (l.role === "agent" ? CHECK_TYPING_MS : 0), 0)
  );
}

type CheckPhase = "set" | "chat";

/** Real BlsToolbar markup (app defaults), static and non-interactive. */
function DemoBlsGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bls-group">
      <div className="bls-seg">{children}</div>
      <span className="bls-group-meta">
        <span className="bls-group-label">{label}</span>
      </span>
    </div>
  );
}

function DemoBlsBar() {
  return (
    <div className="ssd-app-dock" data-testid="check-demo-bls">
      <div className="bls-bar">
        <span className="bls-collapse-btn">
          <ChevronDown size={16} strokeWidth={2} />
        </span>
        <div className="bls-panel">
          <DemoBlsGroup label="Speed">
            <span className="bls-seg-btn">0.1</span>
            <span className="bls-seg-btn bls-seg-btn-active">1</span>
            <span className="bls-seg-btn">5</span>
          </DemoBlsGroup>
          <DemoBlsGroup label="Repeats">
            <span className="bls-seg-btn bls-seg-btn-active">24</span>
            <span className="bls-seg-btn">
              <InfinityIcon size={16} strokeWidth={2} />
            </span>
          </DemoBlsGroup>
          <DemoBlsGroup label="Stereo sound">
            <span className="bls-seg-btn">
              <VolumeX size={16} strokeWidth={2} />
            </span>
            <span className="bls-seg-btn bls-seg-btn-active">
              <Volume2 size={16} strokeWidth={2} />
            </span>
          </DemoBlsGroup>
          <DemoBlsGroup label="Animation">
            <span className="bls-seg-btn bls-seg-btn-active">
              <Circle size={16} strokeWidth={2.5} />
            </span>
            <span className="bls-seg-btn">
              <Square size={15} strokeWidth={2} />
            </span>
          </DemoBlsGroup>
          <DemoBlsGroup label="Adjustments">
            <span className="bls-seg-btn">
              <SlidersHorizontal size={16} strokeWidth={2} />
            </span>
          </DemoBlsGroup>
        </div>
      </div>
    </div>
  );
}

function ChatAvatar() {
  return (
    <Image
      src={GUIDE_MARK}
      alt=""
      width={44}
      height={44}
      className="avatar-img avatar-sm avatar-guide ssd-chat-avatar"
    />
  );
}

/** Scale factors for the virtual app + chat, from the card's real size. */
function useCheckScale(ref: { current: HTMLDivElement | null }) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const scale = w / CHECK_VIRTUAL_W;
      // Chat uses the same scale as the replica; narrow cards get a legibility
      // floor so the column fills most of the card instead of 60%.
      const chat = Math.max(scale, Math.min(1, (Math.min(w, 560) * 0.92) / CHECK_CHAT_VIRTUAL_W));
      el.style.setProperty("--ssd-scale", String(scale));
      el.style.setProperty("--ssd-vh", `${Math.round(h / scale)}px`);
      el.style.setProperty("--ssd-chat-scale", String(chat));
      el.style.setProperty("--ssd-chat-vw", `${Math.round(w / chat)}px`);
      el.style.setProperty("--ssd-chat-vh", `${Math.round(h / chat)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

export function CheckInDemo({ forcePlay = false }: { forcePlay?: boolean }) {
  const { rootRef, inView } = useInViewLoop(forcePlay);
  const [phase, setPhase] = useState<CheckPhase>("set");
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [loop, setLoop] = useState(0);
  useCheckScale(rootRef);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setPhase("chat");
      setTyping(false);
      setShown(CHECK_SCRIPT.length);
      return;
    }
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        setPhase("set");
        setShown(0);
        setTyping(false);
        setLoop((n) => n + 1);
        await wait(CHECK_SET_MS);
        if (cancelled) return;
        setPhase("chat");
        await wait(CHECK_FADE_MS);
        for (let i = 0; i < CHECK_SCRIPT.length; i++) {
          if (cancelled) return;
          const line = CHECK_SCRIPT[i];
          if (line.role === "agent") {
            setTyping(true);
            await wait(CHECK_TYPING_MS);
            if (cancelled) return;
            setTyping(false);
          }
          setShown(i + 1);
          await wait(line.holdMs);
        }
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
        <div className="ssd-app">
          <div className="ssd-app-canvas">
            <span
              key={loop}
              className="ssd-setball"
              style={{ ["--ssd-pass" as string]: `${CHECK_PASS_MS}ms` }}
            />
          </div>
          <DemoBlsBar />
        </div>
        <div className="ssd-guide">
          <div className="ssd-guide-inner">
            <div className="agent-chat-messages ssd-chat-messages">
              {CHECK_SCRIPT.slice(0, shown).map((line, i) =>
                line.role === "agent" ? (
                  <div key={i} className="agent-chat-row agent-chat-row--agent">
                    <ChatAvatar />
                    <div className="agent-chat-bubble agent-chat-bubble--agent">
                      <p className="agent-chat-text">{line.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="agent-chat-row agent-chat-row--user">
                    <div className="agent-chat-bubble agent-chat-bubble--user">
                      <p className="agent-chat-text">{line.text}</p>
                    </div>
                  </div>
                )
              )}
              {typing ? (
                <div className="agent-chat-row agent-chat-row--agent agent-chat-row--thinking">
                  <ChatAvatar />
                  <div className="agent-chat-bubble agent-chat-bubble--agent ssd-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </div>
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
