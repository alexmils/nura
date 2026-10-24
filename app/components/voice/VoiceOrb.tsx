"use client";

/*
 * VoiceOrb: the one place the voice stage asks for an orb.
 *
 *   <VoiceOrb state="idle|listening|thinking|speaking" level={0..1 | () => 0..1} />
 *
 * To swap in a different orb design, change only this file: keep the props,
 * render whatever you like inside `.voice-orb` (it fills its parent square).
 *
 * Which Orbkit orb renders is an admin choice (Admin -> Platform -> Voice
 * orb, app_settings.voiceOrbId, allowlisted in lib/voice-orb-catalog.ts);
 * SHDR-21 (cloud) is the default. Only the chosen orb's file is downloaded
 * (orb-loaders.ts), on every device, iPhone included. A CSS blob (soft radial
 * gradient, yellow -> pastel -> green, breathing per state) stays as the
 * fallback under reduced motion and without WebGL.
 *
 * Every allowlisted orb is an Orbkit original; they and Orbkit's runtime
 * (components/ui/orbkit-core.tsx) are MIT (c) 2026 zzzzshawn, so fine for a
 * paid product. Do not swap in an orb credited to XorDev (shdr-01..10, 15,
 * 18..20, 22, 25, 26, 28, 31): those are non-commercial only.
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OrbVariant } from "@/components/ui/orbkit-core";
import { normalizeVoiceOrbId, voiceOrbOption, type VoiceOrbId } from "@/lib/voice-orb-catalog";
import { loadOrbVariant } from "./orb-loaders";
import { orbLook, orbStateColors } from "./voice-orb-looks";
import { useVoicePrefs } from "./useVoicePrefs";
import {
  orbkitState,
  orbVolumes,
  pickOrbRenderer,
  readLevel,
  type OrbRenderer,
  type OrbVolumes,
  type VoiceOrbLevel,
  type VoiceOrbState,
} from "./voice-orb-env";
import { useMedia } from "./useMedia";
import "./voice-orb.css";

export type { VoiceOrbLevel, VoiceOrbState } from "./voice-orb-env";

export type VoiceOrbProps = {
  state: VoiceOrbState;
  /** Loudness for the current state: mic while listening, reply while speaking. */
  level?: VoiceOrbLevel;
  /** Force a renderer (dev previews); default picks per device. */
  renderer?: "auto" | OrbRenderer;
  /** Which orb look (allowlisted id). Omit to use the admin's saved choice. */
  orbId?: VoiceOrbId | string;
  /** Freeze the shader on its current frame (picker cards not in focus). */
  paused?: boolean;
  className?: string;
};

/** Orbkit's runtime loads only with the stage; each orb file is its own chunk (orb-loaders). */
const ShaderOrb = dynamic(() => import("@/components/ui/orbkit-core").then((m) => m.ShaderOrb), {
  ssr: false,
  loading: () => null,
});

/**
 * WebGL 1 is all Orbkit needs. Probed once per page (not on every voice
 * open), and the probe context is released straight away, so repeated
 * open / close never piles up contexts against Safari's live-context cap.
 */
let webglProbe: boolean | null = null;
function canUseWebGL(): boolean {
  if (webglProbe === null) webglProbe = probeWebGL();
  return webglProbe;
}
function probeWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function VoiceOrb({ state, level, renderer = "auto", orbId, paused = false, className }: VoiceOrbProps) {
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    setWebgl(canUseWebGL());
  }, []);

  const levelRef = useRef(level);
  levelRef.current = level;

  const kind: OrbRenderer | "pending" =
    renderer !== "auto"
      ? renderer
      : webgl === null
        ? "pending"
        : pickOrbRenderer({ reducedMotion: reduced, webgl });
  // The saved choice is only needed (and fetched) when no id is passed in.
  const prefs = useVoicePrefs(orbId === undefined);
  const resolvedId = orbId !== undefined ? normalizeVoiceOrbId(orbId) : prefs?.orbId ?? null;

  return (
    <span
      className={`voice-orb voice-orb--${kind} voice-orb--${state}${className ? ` ${className}` : ""}`}
      data-orb-id={resolvedId ?? undefined}
      aria-hidden
    >
      {kind === "webgl" && resolvedId ? (
        <ShaderAdapter orbId={resolvedId} state={state} levelRef={levelRef} paused={paused} />
      ) : kind === "css" ? (
        <CssBlob state={state} levelRef={levelRef} animate={!reduced} />
      ) : null}
    </span>
  );
}

/** Soft breathing blob. Live level arrives through --voice-level. */
function CssBlob({
  state,
  levelRef,
  animate = false,
}: {
  state: VoiceOrbState;
  levelRef?: React.RefObject<VoiceOrbLevel | undefined>;
  animate?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!animate || !levelRef) return;
    let raf = 0;
    let smooth = 0;
    const loop = () => {
      const target = readLevel(levelRef.current);
      smooth += (target - smooth) * 0.18;
      ref.current?.style.setProperty("--voice-level", smooth.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, levelRef]);
  return (
    <span ref={ref} className={`voice-orb-blob voice-orb-blob--${state}`}>
      <span className="voice-orb-blob-core" />
    </span>
  );
}

/**
 * Samples the live level (~30 fps) while it matters and hands it to Orbkit's
 * `volumes`; Orbkit eases it on its own spring, so coarse steps are fine.
 */
function useLiveVolumes(state: VoiceOrbState, levelRef: React.RefObject<VoiceOrbLevel | undefined>): OrbVolumes | undefined {
  const [volumes, setVolumes] = useState<OrbVolumes | undefined>(() => orbVolumes(state, readLevel(levelRef.current)));
  useEffect(() => {
    setVolumes(orbVolumes(state, readLevel(levelRef.current)));
    if (state !== "listening" && state !== "speaking") return;
    let raf = 0;
    let lastAt = 0;
    let last: OrbVolumes | undefined;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastAt < 33) return;
      lastAt = now;
      const next = orbVolumes(state, readLevel(levelRef.current));
      const a = last?.input ?? last?.output;
      const b = next?.input ?? next?.output;
      if ((a === undefined) !== (b === undefined) || (a !== undefined && b !== undefined && Math.abs(a - b) > 0.01)) {
        last = next;
        setVolumes(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state, levelRef]);
  return volumes;
}

/** Maps our four states onto Orbkit's three, plus the look's tints and live volume. */
function ShaderAdapter({
  orbId,
  state,
  levelRef,
  paused,
}: {
  orbId: VoiceOrbId;
  state: VoiceOrbState;
  levelRef: React.RefObject<VoiceOrbLevel | undefined>;
  paused: boolean;
}) {
  const volumes = useLiveVolumes(state, levelRef);
  const base = voiceOrbOption(orbId).base;
  const [variant, setVariant] = useState<{ base: string; v: OrbVariant } | null>(null);
  useEffect(() => {
    let live = true;
    loadOrbVariant(base)
      .then((v) => {
        if (live) setVariant({ base, v });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [base]);
  const look = orbLook(orbId);
  const stateColors = useMemo(() => orbStateColors(look), [look]);
  if (!variant || variant.base !== base) return null;
  // Listening shares Orbkit's idle motion, so its colours go in explicitly
  // (they still cross-fade); the other states use stateColors.
  const colors = state === "listening" ? look.colors.listening : undefined;
  return (
    <ShaderOrb
      variant={variant.v}
      className="voice-orb-shdr"
      style={SHADER_SIZE}
      state={orbkitState(state)}
      stateColors={stateColors}
      statePresets={look.statePresets}
      colors={colors}
      volumes={volumes}
      paused={paused}
    />
  );
}

/** Orbkit sets an inline default size; the caller's style wins, so size it from CSS here. */
const SHADER_SIZE = { width: "var(--voice-orb-size)", height: "var(--voice-orb-size)" };
