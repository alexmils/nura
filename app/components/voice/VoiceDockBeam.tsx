"use client";

/*
 * Phone held sideways (PHONE_LANDSCAPE_QUERY): no orb stage; the chat's
 * Listening / Speaking pill is wrapped in voice-glow's VoiceBeam, a
 * sound-reactive glow along the pill's bottom edge that changes colour per
 * state (voice-beam-palette.ts). It is driven by the session's own meters
 * (getInputLevel / getOutputLevel through glowLevel), so no second
 * getUserMedia is opened. Everywhere else the children render unchanged.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { VoiceBeam, type VoiceBeamMotion } from "voice-glow";
import { glowLevel, PHONE_LANDSCAPE_QUERY, sweepMotion, type VoiceOrbState } from "./voice-orb-env";
import {
  BEAM_PALETTES,
  blendPalette,
  easeBeam,
  edgeIntensity,
  REDUCED_MOTION_STRENGTH,
  type BeamPalette,
} from "./voice-beam-palette";
import { useMedia } from "./useMedia";
import "./voice-immersive.css";

const FADE_MS = 450;

/** Effect layers never take taps or selection; the pill inside keeps its buttons. */
const BEAM_CSS = `[data-voice-beam="{id}"]::before,[data-voice-beam="{id}"]::after,[data-voice-beam="{id}"] [data-voice-beam-bloom]{pointer-events:none;-webkit-user-select:none;user-select:none;}`;

/** Cross-fade the palette when the state changes (rAF tween, ~0.45 s). */
function useBeamPalette(state: VoiceOrbState, reduced: boolean): BeamPalette {
  const [palette, setPalette] = useState<BeamPalette>(BEAM_PALETTES[state]);
  const current = useRef(palette);
  current.current = palette;
  useEffect(() => {
    const to = BEAM_PALETTES[state];
    if (reduced) {
      setPalette(to);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      setPalette(blendPalette(from, to, easeBeam(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state, reduced]);
  return palette;
}

export function VoiceDockBeam(props: {
  state: VoiceOrbState;
  exiting: boolean;
  getInputLevel: () => number;
  getOutputLevel: () => number;
  children: ReactNode;
}) {
  const { state, exiting, getInputLevel, getOutputLevel, children } = props;
  const phoneLandscape = useMedia(PHONE_LANDSCAPE_QUERY);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const stateRef = useRef(state);
  stateRef.current = state;
  const palette = useBeamPalette(state, reduced);

  // Immersive layout (voice-immersive.css): no header, no chat card, one
  // corner help button. Set on <html> while this landscape beam is mounted,
  // i.e. only while voice mode is active; removed on unmount or rotation.
  useEffect(() => {
    if (!phoneLandscape) return;
    const html = document.documentElement;
    html.setAttribute("data-voice-immersive", "");
    return () => html.removeAttribute("data-voice-immersive");
  }, [phoneLandscape]);

  // The pill's gradient edge follows the beam's own smoothed level (a CSS
  // var written per frame, no React state).
  const rootRef = useRef<HTMLDivElement>(null);
  const onLevel = useCallback((l: number) => {
    rootRef.current?.style.setProperty("--beam-edge", edgeIntensity(stateRef.current, l).toFixed(3));
  }, []);

  const level = useCallback(
    () => glowLevel(stateRef.current, getInputLevel(), getOutputLevel(), performance.now() / 1000),
    [getInputLevel, getOutputLevel],
  );

  // Thinking: the lobes gather into one beam that travels the range (the
  // package's `processing` is a paid add-on in 0.3, so this drives `motion`).
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

  if (!phoneLandscape) return <>{children}</>;
  return (
    <VoiceBeam
      ref={rootRef}
      type="mobile"
      theme="light"
      colors={palette.colors}
      bandColors={palette.bandColors}
      staticColors={reduced}
      hueRange={reduced ? 0 : 18}
      saturation={1.9}
      brightness={1.1}
      strength={reduced ? REDUCED_MOTION_STRENGTH : palette.strength}
      idle={palette.idle}
      level={reduced ? 0.25 : level}
      motion={reduced ? null : motion}
      onLevel={reduced ? undefined : onLevel}
      reach={2.2}
      spread={0.9}
      rangeWidth={1}
      glowWidth={0.95}
      bloomOpacity={1.25}
      innerOpacity={0.6}
      active={!exiting}
      paused={reduced}
      css={BEAM_CSS}
      className={`voice-dock-beam${reduced ? " voice-dock-beam--still" : ""}`}
      data-state={state}
      style={{ ["--beam-edge" as string]: edgeIntensity(state, 0.25).toFixed(3) }}
    >
      {children}
    </VoiceBeam>
  );
}
