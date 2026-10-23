"use client";

/*
 * Landscape voice mode: the transcript stays (text mode), no orb. A
 * sound-reactive glow from `voice-glow` sits along the bottom edge of the
 * screen, just above the home-indicator safe area. It reuses the session's
 * own mic meter and playback analyser (no second getUserMedia).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VoiceBeam, type VoiceBeamMotion } from "voice-glow";
import { glowLevel, sweepMotion, type VoiceOrbState } from "./voice-orb-env";
import { useMedia } from "./useMedia";

/** Nura palette: yellows, pastel cream, greens (max 7 lobes). */
export const NURA_GLOW_COLORS = ["#e6c85e", "#f3d56a", "#fbf0c4", "#f1f7e6", "#c6dcae", "#9cc97a", "#6f9a52"];
/** The band ridge and fringes default to pink / lavender / sky on light; keep them in palette. */
const NURA_BAND_COLORS = { core: "#f3d56a", above: "#fbf0c4", mid: "#c6dcae", below: "#9cc97a" };

export type VoiceGlowProps = {
  state: VoiceOrbState;
  exiting?: boolean;
  getInputLevel: () => number;
  getOutputLevel: () => number;
};

export function VoiceGlow({ state, exiting = false, getInputLevel, getOutputLevel }: VoiceGlowProps) {
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Reduced motion: let it fade in, then hold a still, soft glow.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!reduced) setHeld(false);
  }, [reduced]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const level = useCallback(
    () => glowLevel(stateRef.current, getInputLevel(), getOutputLevel(), performance.now() / 1000),
    [getInputLevel, getOutputLevel],
  );

  // "processing" is a paid add-on in voice-glow 0.3, so thinking drives the
  // public `motion` prop: the lobes gather into one beam that sweeps the
  // range, eased in and out of each turn.
  const gatherRef = useRef(0);
  const lastRef = useRef(0);
  const motion = useCallback((): VoiceBeamMotion => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, lastRef.current ? now - lastRef.current : 0);
    lastRef.current = now;
    const target = stateRef.current === "thinking" ? 1 : 0;
    gatherRef.current += (target - gatherRef.current) * Math.min(1, dt * 4);
    return sweepMotion(gatherRef.current, now);
  }, []);

  if (!mounted) return null;
  return createPortal(
    <VoiceBeam
      type="mobile"
      theme="light"
      colors={NURA_GLOW_COLORS}
      bandColors={NURA_BAND_COLORS}
      hueRange={14}
      saturation={1.15}
      staticColors={reduced}
      level={reduced ? 0.3 : level}
      motion={reduced ? null : motion}
      idle={state === "idle" ? 0.12 : 0.23}
      active={!exiting}
      paused={reduced && held}
      onActivate={() => setHeld(true)}
      className="voice-glow"
      data-state={state}
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "env(safe-area-inset-bottom, 0px)",
        height: "min(45dvh, 15rem)",
        pointerEvents: "none",
        zIndex: 25,
      }}
    >
      <div className="voice-glow-host" style={{ width: "100%", height: "100%" }} />
    </VoiceBeam>,
    document.body,
  );
}