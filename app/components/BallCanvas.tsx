"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AnimationMode,
  AnimationPath,
  BlsSoundId,
  BrightenFlashes,
  RepeatMode,
  VibrationMode,
} from "@/lib/types";
import { BlsAudioEngine } from "@/lib/bls-audio";
import { edgeSound } from "@/lib/bls-sounds";
import { pulseVibration } from "@/lib/bls-vibrate";
import {
  ballTravelOffset,
  flashClipPaths,
  flashPaint,
  motionAxisFromSize,
  pickRandomAnimationPath,
  resolveAnimationPath,
  type BlsMotionAxis,
  type ConcreteAnimationPath,
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
  animationPath: AnimationPath;
  brightenFlashes: BrightenFlashes;
  flashColor: string;
  soundMuted: boolean;
  leftSound: BlsSoundId;
  rightSound: BlsSoundId;
  reverseStereo: boolean;
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
  path: ConcreteAnimationPath,
  ballSize: number
) {
  if (!el || !container) return;
  const travelX = Math.max(0, container.clientWidth - ballSize);
  const travelY = Math.max(0, container.clientHeight - ballSize);
  const { x, y } = ballTravelOffset(path, pos, travelX, travelY);
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function paintFlash(
  a: HTMLDivElement | null,
  b: HTMLDivElement | null,
  pos: number,
  path: ConcreteAnimationPath,
  brighten: BrightenFlashes,
  flashColor: string,
  background: string
) {
  const clips = flashClipPaths(path);
  const startOn = pos < 0.5;
  const startPaint = flashPaint(brighten, flashColor, startOn, background);
  const endPaint = flashPaint(brighten, flashColor, !startOn, background);
  if (a) {
    a.style.clipPath = clips.start;
    a.style.background = startPaint.color;
    a.style.opacity = startPaint.opacity;
  }
  if (b) {
    b.style.clipPath = clips.end;
    b.style.background = endPaint.color;
    b.style.opacity = endPaint.opacity;
  }
}

export function BallCanvas({
  running,
  speedHz,
  ballColor,
  ballSize,
  background,
  animation,
  animationPath,
  brightenFlashes,
  flashColor,
  soundMuted,
  leftSound,
  rightSound,
  reverseStereo,
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
  const vibrationRef = useRef(vibration);
  const onCompleteRef = useRef(onSetComplete);
  const axisRef = useRef(axis);
  const ballSizeRef = useRef(ballSize);
  const animationRef = useRef(animation);
  const pathRef = useRef(animationPath);
  const brightenRef = useRef(brightenFlashes);
  const flashColorRef = useRef(flashColor);
  const backgroundRef = useRef(background);
  const mutedRef = useRef(soundMuted);
  const leftRef = useRef(leftSound);
  const rightRef = useRef(rightSound);
  const reverseRef = useRef(reverseStereo);
  const randomPathRef = useRef<ConcreteAnimationPath>("horizontal");

  speedRef.current = speedHz;
  vibrationRef.current = vibration;
  onCompleteRef.current = onSetComplete;
  axisRef.current = axis;
  ballSizeRef.current = ballSize;
  animationRef.current = animation;
  pathRef.current = animationPath;
  brightenRef.current = brightenFlashes;
  flashColorRef.current = flashColor;
  backgroundRef.current = background;
  mutedRef.current = soundMuted;
  leftRef.current = leftSound;
  rightRef.current = rightSound;
  reverseRef.current = reverseStereo;

  const pathNow = (): ConcreteAnimationPath => {
    const box = containerRef.current;
    const width = box?.clientWidth || (axisRef.current === "vertical" ? 390 : 844);
    const height = box?.clientHeight || (axisRef.current === "vertical" ? 844 : 390);
    return resolveAnimationPath(
      pathRef.current,
      width,
      height,
      randomPathRef.current
    );
  };

  const playEnd = (side: "left" | "right") => {
    if (mutedRef.current) return;
    const edge = edgeSound(side, leftRef.current, rightRef.current, reverseRef.current);
    audioRef.current?.play(edge.id, edge.pan);
  };

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

    audioRef.current?.resume();
    startTime.current = performance.now();
    lastFrameRef.current = startTime.current;
    lastSide.current = null;
    posRef.current = 0.5;
    dirRef.current = 1;
    randomPathRef.current = pickRandomAnimationPath();
    playEnd("left");
    lastSide.current = "left";

    const paint = () => {
      const path = pathNow();
      if (animationRef.current === "dot") {
        paintBall(
          ballRef.current,
          containerRef.current,
          posRef.current,
          path,
          ballSizeRef.current
        );
      } else {
        paintFlash(
          flashARef.current,
          flashBRef.current,
          posRef.current,
          path,
          brightenRef.current,
          flashColorRef.current,
          backgroundRef.current
        );
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

        if (next >= 1 || next <= 0) {
          const side = next >= 1 ? "right" : "left";
          next = side === "right" ? 1 : 0;
          dirRef.current = side === "right" ? -1 : 1;
          repeatCount.current += 1;
          if (pathRef.current === "random") {
            randomPathRef.current = pickRandomAnimationPath();
          }
          pulseVibration(vibrationRef.current);
          playEnd(side);
          lastSide.current = side;
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
    const box = containerRef.current;
    const path = resolveAnimationPath(
      animationPath,
      box?.clientWidth || (axis === "vertical" ? 390 : 844),
      box?.clientHeight || (axis === "vertical" ? 844 : 390),
      randomPathRef.current
    );
    paintBall(ballRef.current, containerRef.current, posRef.current, path, ballSize);
  }, [running, animation, animationPath, ballSize, ballColor, axis]);

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
      data-bls-path={animationPath}
      data-guide="canvas"
    >
      {animation === "flash" && running && (
        <>
          <div
            ref={flashARef}
            className="pointer-events-none absolute inset-0"
            style={{ background: flashColor, opacity: 0.55 }}
          />
          <div
            ref={flashBRef}
            className="pointer-events-none absolute inset-0"
            style={{ background: flashColor, opacity: 0.08 }}
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
            left: 0,
            top: 0,
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
