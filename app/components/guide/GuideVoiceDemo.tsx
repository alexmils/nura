"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Simulation for the composer step: a pointer moves to the real voice button,
 * clicks it, and voice mode plays out with the sound wave, the spoken line and
 * the guide's answer.
 *
 * Nothing here touches the microphone or the agent API, so the tour never opens
 * a permission prompt. The status bar reuses the real `.agent-voice-*` classes
 * so what the person sees matches the product.
 */

type Beat = "idle" | "move" | "click" | "listening" | "thinking" | "speaking";

const TIMELINE: { beat: Beat; at: number }[] = [
  { beat: "move", at: 520 },
  { beat: "click", at: 1480 },
  { beat: "listening", at: 2100 },
  { beat: "thinking", at: 5400 },
  { beat: "speaking", at: 6500 },
];

const LOOP_MS = 11500;
const TYPE_MS = 42;

const HEARD_LINE = "I keep replaying what he said last week.";
const GUIDE_LINE = "That sounds heavy. Do you want to start with that memory?";

type Rect = { top: number; left: number; width: number; height: number };

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function GuideVoiceDemo({ composerSelector }: { composerSelector: string }) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [beat, setBeat] = useState<Beat>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  /** The demo owns the composer, so it can key the timeline to the real element. */
  const ready = rect != null && anchor != null;

  /* Track the composer: it moves with the keyboard inset and window resizes. */
  useEffect(() => {
    let frame = 0;
    const composer = document.querySelector(composerSelector);
    if (!composer) {
      setRect(null);
      setAnchor(null);
      return;
    }

    const measure = () => {
      setRect(rectOf(composer));
      const button = composer.querySelector('[data-guide="voice-mode"]');
      const r = (button ?? composer).getBoundingClientRect();
      setAnchor(
        button
          ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
          : { x: r.right - 26, y: r.top + r.height / 2 }
      );
    };
    measure();

    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const id = window.setInterval(measure, 900);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(id);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [composerSelector]);

  /* Beat timeline, looping until the card moves on. */
  useEffect(() => {
    if (!ready) return;

    if (prefersReducedMotion()) {
      setBeat("speaking");
      setHeard(HEARD_LINE);
      setReply(GUIDE_LINE);
      return;
    }

    let timers: number[] = [];
    let loopTimer = 0;
    let typeTimer = 0;

    const typeInto = (
      text: string,
      set: (value: string) => void,
      done: () => void
    ) => {
      let i = 0;
      window.clearInterval(typeTimer);
      set("");
      typeTimer = window.setInterval(() => {
        i += 1;
        set(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(typeTimer);
          done();
        }
      }, TYPE_MS);
    };

    const cycle = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
      setBeat("idle");
      setHeard("");
      setReply("");

      for (const { beat: next, at } of TIMELINE) {
        timers.push(
          window.setTimeout(() => {
            setBeat(next);
            if (next === "listening") typeInto(HEARD_LINE, setHeard, () => {});
            if (next === "speaking") typeInto(GUIDE_LINE, setReply, () => {});
          }, at)
        );
      }

      loopTimer = window.setTimeout(cycle, LOOP_MS);
    };
    cycle();

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(loopTimer);
      window.clearInterval(typeTimer);
    };
  }, [ready]);

  if (!ready) return null;

  const dockVisible = beat !== "idle" && beat !== "move" && beat !== "click";
  // On the button while it presses, then it steps out of the way of the dock.
  const onButton = beat === "move" || beat === "click";
  const cursor = onButton
    ? { x: anchor.x + 6, y: anchor.y + 4 }
    : { x: anchor.x + 96, y: anchor.y + 104 };

  return (
    <div className="pg-demo-layer" aria-hidden data-guide="voice-demo">
      <span
        className={`pg-cursor${beat === "click" ? " is-clicking" : ""}${
          dockVisible ? " is-away" : ""
        }`}
        style={{ left: cursor.x, top: cursor.y }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <path
            d="M2 1.6 2 16.4 6.1 12.6 8.9 18.6 11.6 17.3 8.8 11.4 14.3 11.2Z"
            fill="#ffffff"
            stroke="rgba(42, 48, 32, 0.9)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`pg-ripple${beat === "click" ? " is-live" : ""}`}
        style={{ left: anchor.x, top: anchor.y }}
      />

      {dockVisible ? (
        <div
          className="pg-voice"
          style={{ left: rect.left - 8, width: rect.width + 16, top: rect.top - 86 }}
        >
          <div className="pg-voice-bars">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className={`pg-voice-bar${beat === "thinking" ? " is-idle" : ""}`}
                style={{ animationDelay: `${i * 85}ms` }}
              />
            ))}
          </div>
          <div className="agent-voice-bar">
            <div
              className={`agent-voice-orb agent-voice-orb--${
                beat === "speaking"
                  ? "speaking"
                  : beat === "thinking"
                    ? "thinking"
                    : "listening"
              }`}
            />
            <div className="agent-voice-meta">
              <p className="agent-voice-status">
                {beat === "speaking"
                  ? "Speaking…"
                  : beat === "thinking"
                    ? "Thinking…"
                    : "Listening…"}
              </p>
              <p className="agent-voice-interim">
                {beat === "speaking" ? reply || "…" : heard || "…"}
              </p>
            </div>
            <span className="agent-voice-end pg-voice-fake-end">
              <X size={16} strokeWidth={2.25} />
              <span>End voice</span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
