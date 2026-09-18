"use client";

import { useEffect, useRef, useState } from "react";
import { browserSpeechNeedsExclusiveMic } from "@/lib/browser-speech";
import { waveAmplitude } from "@/lib/mic-level";
import type { VoicePhase } from "./useGuidedVoiceMode";
import { useMicLevel } from "./useMicLevel";

const W = 320;
const H = 88;

type VoiceWaveProps = {
  phase: VoicePhase;
  active: boolean;
  /** Soft canvas fade while the dock exits. */
  fadingOut?: boolean;
};

function modeForPhase(
  phase: VoicePhase
): "listening" | "ambient" | "quiet" {
  if (phase === "listening") return "listening";
  if (phase === "speaking" || phase === "thinking") return "ambient";
  return "quiet";
}

/** Motion signature per phase — readable without reading the status label. */
function motionForMode(mode: "listening" | "ambient" | "quiet") {
  if (mode === "listening") {
    return {
      drift: 3.2,
      harmonics: 1,
      micFloor: 0.12,
      levelFallback: 0.2,
    };
  }
  if (mode === "ambient") {
    // Agent speaking / thinking: slow breath, fewer wiggles
    return {
      drift: 1.15,
      harmonics: 0.45,
      micFloor: 0,
      levelFallback: 0.35,
    };
  }
  return {
    drift: 0.55,
    harmonics: 0.25,
    micFloor: 0,
    levelFallback: 0.2,
  };
}

/**
 * Soft pistachio sine ribbons — free wave, mic-reactive, no circle.
 * Three ribbons only; listening vs speaking read from motion, not just labels.
 */
export function VoiceWave({
  phase,
  active,
  fadingOut = false,
}: VoiceWaveProps) {
  const listen = active && phase === "listening" && !fadingOut;
  /**
   * On phones the recogniser and getUserMedia cannot both hold the mic, so the
   * ribbons ride the ambient fallback instead of stealing the audio. Assume
   * "don't share" until the first client effect says otherwise.
   */
  const [shareMic, setShareMic] = useState(false);
  useEffect(() => {
    setShareMic(!browserSpeechNeedsExclusiveMic());
  }, []);
  const micLevel = useMicLevel(listen && shareMic);
  const micRef = useRef(micLevel);
  micRef.current = micLevel;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const fadeRef = useRef(fadingOut);
  fadeRef.current = fadingOut;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opacityRef = useRef(1);

  useEffect(() => {
    if (!active && !fadingOut) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let running = true;
    const start = performance.now();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const paint = (now: number) => {
      if (!running || !ctx) return;
      const t = reduced ? (now - start) / 2800 : (now - start) / 1000;
      const mode = modeForPhase(phaseRef.current);
      const motion = motionForMode(mode);
      const raw =
        mode === "listening" ? micRef.current : motion.levelFallback;
      const level =
        mode === "listening"
          ? Math.max(raw, motion.micFloor)
          : motion.levelFallback;
      const amp = waveAmplitude(level, mode);

      const targetOp = fadeRef.current ? 0 : 1;
      opacityRef.current += (targetOp - opacityRef.current) * 0.08;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = Math.max(0, opacityRef.current);

      const cy = H / 2;
      const x0 = 6;
      const x1 = W - 6;
      const drift = t * motion.drift;
      const harm = motion.harmonics;

      const drawSine = (
        lag: number,
        color: string,
        width: number,
        ampScale: number,
        alpha: number,
        speed = 1
      ) => {
        ctx.beginPath();
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
          const nx = i / steps;
          const x = x0 + (x1 - x0) * nx;
          const envelope = Math.sin(nx * Math.PI);
          const y =
            cy +
            envelope *
              amp *
              ampScale *
              (Math.sin(nx * Math.PI * 1.65 + drift * speed + lag) +
                0.28 *
                  harm *
                  Math.sin(
                    nx * Math.PI * 3.1 + drift * 1.35 * speed + lag * 1.2
                  ) +
                0.12 * harm * Math.sin(drift * 1.8 + lag));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * opacityRef.current;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      };

      // Three ribbons: soft sage glow, ink-olive core, pistachio accent
      drawSine(1.1, "#84B067", 5.5, 0.88, 0.38, 1.12);
      drawSine(0, "#5F8A4A", 3.6, 1.1, 0.94, 1);
      drawSine(2.2, "#C6D67E", 2.1, 0.58, 0.42, 0.88);

      ctx.restore();
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [active, fadingOut]);

  if (!active && !fadingOut) return null;

  return (
    <div
      className={`agent-voice-wave agent-voice-wave--${phase}${fadingOut ? " agent-voice-wave--exit" : ""}`}
      aria-hidden
    >
      <canvas ref={canvasRef} className="agent-voice-wave-canvas" />
    </div>
  );
}
