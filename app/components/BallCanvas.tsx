"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AnimationMode,
  RepeatMode,
  SoundMode,
  VibrationMode,
} from "@/lib/types";
import { BlsAudioEngine } from "@/lib/bls-audio";
import { rumble } from "@/lib/gamepad";
import {
  motionAxisFromSize,
  type BlsMotionAxis,
} from "@/lib/bls-motion";
import {
  BLS_BALL_MAX_DT_SEC,
  blsBallStep,
} from "@/lib/bls-ball-motion";
import { blsBackgroundIsDark } from "@/lib/bls-prefs";
import { repeatsLimit } from "@/lib/bls-repeats";

interface BallCanvasProps {
  running: boolean;
  speedHz: number;
  ballColor: string;
  ballSize: number;
  background: string;
  animation: AnimationMode;
  sound: SoundMode;
  setLengthSec: number;
  repeats: RepeatMode;
  vibration: VibrationMode;
  onSetComplete: () => void;
  onToggle: () => void;
  /** Idle center hint; guided wait/check-in hide free start messaging. */
  idleHint?: "default" | "guided_wait" | "check_in";
}

function useBlsMotionAxis(): BlsMotionAxis {
  const [axis, setAxis] = useState<BlsMotionAxis>("horizontal");

  useEffect(() => {
    const update = () => {
      setAxis(motionAxisFromSize(window.innerWidth, window.innerHeight));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const mq = window.matchMedia("(orientation: landscape)");
    const onMq = () => update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onMq);
    } else {
      mq.addListener(onMq);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", onMq);
      } else {
        mq.removeListener(onMq);
      }
    };
  }, []);

  return axis;
}

function paintBall(
  el: HTMLDivElement | null,
  container: HTMLElement | null,
  pos: number,
  horizontal: boolean,
  ballSize: number
) {
  if (!el || !container) return;
  const travel = Math.max(
    0,
    (horizontal ? container.clientWidth : container.clientHeight) - ballSize
  );
  const px = pos * travel;
  el.style.transform = horizontal
    ? `translate3d(${px}px, -50%, 0)`
    : `translate3d(-50%, ${px}px, 0)`;
}

function paintFlash(
  a: HTMLDivElement | null,
  b: HTMLDivElement | null,
  pos: number
) {
  if (a) a.style.opacity = pos < 0.5 ? "1" : "0.15";
  if (b) b.style.opacity = pos >= 0.5 ? "1" : "0.15";
}

export function BallCanvas({
  running,
  speedHz,
  ballColor,
  ballSize,
  background,
  animation,
  sound,
  setLengthSec,
  repeats,
  vibration,
  onSetComplete,
  onToggle,
  idleHint = "default",
}: BallCanvasProps) {
  const axis = useBlsMotionAxis();
  const containerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const flashARef = useRef<HTMLDivElement>(null);
  const flashBRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<BlsAudioEngine | null>(null);
  const posRef = useRef(0.5);
  const dirRef = useRef(1);
  const repeatCount = useRef(0);
  const startTime = useRef(0);
  const lastFrameRef = useRef(0);
  const lastSide = useRef<"left" | "right" | null>(null);
  const rafRef = useRef<number>(0);
  const speedRef = useRef(speedHz);
  const soundRef = useRef(sound);
  const vibrationRef = useRef(vibration);
  const onCompleteRef = useRef(onSetComplete);
  const axisRef = useRef(axis);
  const ballSizeRef = useRef(ballSize);
  const animationRef = useRef(animation);

  speedRef.current = speedHz;
  soundRef.current = sound;
  vibrationRef.current = vibration;
  onCompleteRef.current = onSetComplete;
  axisRef.current = axis;
  ballSizeRef.current = ballSize;
  animationRef.current = animation;

  useEffect(() => {
    audioRef.current = new BlsAudioEngine();
    return () => audioRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!running) {
      cancelAnimationFrame(rafRef.current);
      repeatCount.current = 0;
      startTime.current = 0;
      lastFrameRef.current = 0;
      lastSide.current = null;
      posRef.current = 0.5;
      dirRef.current = 1;
      return;
    }

    startTime.current = performance.now();
    lastFrameRef.current = startTime.current;
    lastSide.current = null;
    posRef.current = 0.5;
    dirRef.current = 1;
    audioRef.current?.playPan("left", soundRef.current);
    lastSide.current = "left";

    const paint = () => {
      const horizontal = axisRef.current === "horizontal";
      if (animationRef.current === "dot") {
        paintBall(
          ballRef.current,
          containerRef.current,
          posRef.current,
          horizontal,
          ballSizeRef.current
        );
      } else {
        paintFlash(flashARef.current, flashBRef.current, posRef.current);
      }
    };

    // First paint after mount of ball/flash nodes.
    rafRef.current = requestAnimationFrame(() => {
      paint();
      lastFrameRef.current = performance.now();

      const loop = (now: number) => {
        const rawDt = (now - lastFrameRef.current) / 1000;
        lastFrameRef.current = now;
        const dt = Math.min(
          Math.max(rawDt, 0),
          BLS_BALL_MAX_DT_SEC
        );

        const step = blsBallStep(speedRef.current, dt);
        let next = posRef.current + dirRef.current * step;

        if (next >= 1) {
          next = 1;
          dirRef.current = -1;
          repeatCount.current += 1;
          if (vibrationRef.current !== "none") rumble(vibrationRef.current);
          audioRef.current?.playPan("right", soundRef.current);
          lastSide.current = "right";
        } else if (next <= 0) {
          next = 0;
          dirRef.current = 1;
          repeatCount.current += 1;
          if (vibrationRef.current !== "none") rumble(vibrationRef.current);
          audioRef.current?.playPan("left", soundRef.current);
          lastSide.current = "left";
        }

        posRef.current = next;
        paint();

        const elapsed = (now - startTime.current) / 1000;
        const maxRepeats = repeatsLimit(repeats);
        if (repeatCount.current >= maxRepeats || elapsed >= setLengthSec) {
          onCompleteRef.current();
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [running, repeats, setLengthSec]);

  // Keep ball size/color and axis transforms in sync without restarting the set.
  useEffect(() => {
    if (!running || animation !== "dot") return;
    const el = ballRef.current;
    if (el) {
      el.style.width = `${ballSize}px`;
      el.style.height = `${ballSize}px`;
      el.style.background = ballColor;
    }
    paintBall(
      ballRef.current,
      containerRef.current,
      posRef.current,
      axis === "horizontal",
      ballSize
    );
  }, [running, animation, ballSize, ballColor, axis]);

  const horizontal = axis === "horizontal";
  const idleHintOnDark = blsBackgroundIsDark(background);

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        // Space is owned by SessionWorkspace (start/stop). On role=button, Space
        // keyup also synthesizes a click — that double-fired toggle (stop then
        // restart). Prevent default only; Enter still activates when focused.
        if (e.code === "Space") {
          e.preventDefault();
          return;
        }
        if (e.code === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
      onKeyUp={(e) => {
        if (e.code === "Space") e.preventDefault();
      }}
      className="workspace-canvas relative h-full min-h-0 flex-1 overflow-hidden outline-none"
      style={{ background }}
      data-bls-axis={axis}
      data-guide="canvas"
    >
      {animation === "flash" && running && horizontal && (
        <>
          <div
            ref={flashARef}
            className="absolute inset-y-0 left-0 w-1/2"
            style={{ background: "rgba(0,0,0,0.06)", opacity: 1 }}
          />
          <div
            ref={flashBRef}
            className="absolute inset-y-0 right-0 w-1/2"
            style={{ background: "rgba(0,0,0,0.06)", opacity: 0.15 }}
          />
        </>
      )}
      {animation === "flash" && running && !horizontal && (
        <>
          <div
            ref={flashARef}
            className="absolute inset-x-0 top-0 h-1/2"
            style={{ background: "rgba(0,0,0,0.06)", opacity: 1 }}
          />
          <div
            ref={flashBRef}
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: "rgba(0,0,0,0.06)", opacity: 0.15 }}
          />
        </>
      )}
      {animation === "dot" && running && (
        <div
          ref={ballRef}
          className="bls-ball absolute rounded-full shadow-md"
          style={{
            width: ballSize,
            height: ballSize,
            background: ballColor,
            willChange: "transform",
            ...(horizontal
              ? { left: 0, top: "50%", transform: "translate3d(0, -50%, 0)" }
              : { top: 0, left: "50%", transform: "translate3d(-50%, 0, 0)" }),
          }}
        />
      )}
      {!running && idleHint === "default" && (
        <p
          className={`canvas-idle-hint pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center leading-relaxed${
            idleHintOnDark ? " canvas-idle-hint--on-dark" : ""
          }`}
        >
          <span className="canvas-idle-hint-desktop">
            Press{" "}
            <span className="canvas-idle-hint-strong font-medium">Space</span>{" "}
            or click to start
          </span>
          <span className="canvas-idle-hint-touch">Tap to start</span>
        </p>
      )}
      {!running && idleHint === "check_in" && (
        <p
          className={`canvas-idle-hint pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center leading-relaxed${
            idleHintOnDark ? " canvas-idle-hint--on-dark" : ""
          }`}
        >
          <span>Reply to the check-in, or use Repeat set if you missed this one</span>
        </p>
      )}
    </div>
  );
}
