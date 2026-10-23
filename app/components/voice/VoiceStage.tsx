"use client";

import { Mic, MicOff, RotateCw, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { VoicePhase } from "../useGuidedVoiceMode";
import { VoiceOrb, type VoiceOrbState } from "./VoiceOrb";
import { VoiceGlow } from "./VoiceGlow";
import { useMedia } from "./useMedia";
import { PHONE_LANDSCAPE_QUERY } from "./voice-orb-env";
import "./voice-stage.css";

export type VoiceStageState = VoiceOrbState;

export function voiceStageState(phase: VoicePhase, opts: { starting?: boolean; stalled?: boolean; muted?: boolean }): VoiceStageState {
  if (opts.stalled || opts.starting || opts.muted) return "idle";
  if (phase === "listening" || phase === "thinking" || phase === "speaking") return phase;
  return "idle";
}

function stateLabel(phase: VoicePhase, o: { starting: boolean; stalled: boolean; muted: boolean; exiting: boolean }): string {
  if (o.exiting) return "Ending\u2026";
  if (o.stalled) return "Mic paused";
  if (o.starting) return "Starting the mic\u2026";
  if (o.muted) return "Muted";
  if (phase === "listening") return "Listening";
  if (phase === "thinking") return "Thinking";
  if (phase === "speaking") return "Speaking \u00b7 tap to interrupt";
  return "Voice";
}

/** Lock page scroll (iOS too) while the stage covers the screen. */
function useScrollLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow, touch: body.style.touchAction };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    html.classList.add("voice-stage-open");
    return () => {
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
      body.style.touchAction = prev.touch;
      html.classList.remove("voice-stage-open");
    };
  }, [on]);
}

export type VoiceStageProps = {
  phase: VoicePhase;
  starting: boolean;
  stalled: boolean;
  muted: boolean;
  exiting: boolean;
  error: string | null;
  interim?: string;
  getInputLevel: () => number;
  getOutputLevel: () => number;
  onEnd: () => void;
  onToggleMute: () => void;
  onResume?: () => void;
  onInterrupt?: () => void;
  /** Dev previews: force the orb renderer. */
  orbRenderer?: "auto" | "css" | "webgl";
  /** Orb look (allowlisted id). Omit to use the admin's saved choice (default SHDR-21). */
  orbId?: string;
};

/**
 * Voice mode: a full-viewport stage with only the orb, one short status line
 * and the controls, on desktop, tablets and portrait phones alike. It is
 * portalled to <body> so no session ancestor (the agent overlay is
 * transformed) can trap or clip it, and it covers the session's voice dock.
 * Only a phone held sideways (PHONE_LANDSCAPE_QUERY) skips the stage: the
 * transcript shows (text mode) with the bottom glow.
 */
export function VoiceStage(props: VoiceStageProps) {
  const phoneLandscape = useMedia(PHONE_LANDSCAPE_QUERY);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = voiceStageState(props.phase, props);
  const { getInputLevel, getOutputLevel, phase } = props;
  const level = useCallback(() => {
    if (phase === "listening") return getInputLevel();
    if (phase === "speaking") return getOutputLevel();
    return 0;
  }, [phase, getInputLevel, getOutputLevel]);

  const showStage = mounted && !phoneLandscape && phase !== "bls";
  useScrollLock(showStage && !props.exiting);

  if (!mounted || phase === "bls") return null;

  if (phoneLandscape) {
    return (
      <VoiceGlow
        state={state}
        exiting={props.exiting}
        getInputLevel={getInputLevel}
        getOutputLevel={getOutputLevel}
      />
    );
  }
  if (!showStage) return null;

  const label = stateLabel(phase, props);
  const speaking = phase === "speaking";
  return createPortal(
    <div
      className={`voice-stage voice-stage--${state}${props.exiting ? " voice-stage--exit" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Voice conversation"
    >
      <button
        type="button"
        className="voice-stage-orb"
        onClick={speaking ? props.onInterrupt : undefined}
        aria-label={speaking ? "Stop the reply and talk" : label}
        tabIndex={speaking ? 0 : -1}
      >
        <VoiceOrb state={state} level={level} renderer={props.orbRenderer} orbId={props.orbId} />
      </button>

      <div className="voice-stage-status" role="status" aria-live="polite">
        <p className="voice-stage-label">{label}</p>
        {props.error ? <p className="voice-stage-error">{props.error}</p> : null}
      </div>

      <div className="voice-stage-controls">
        {props.stalled && props.onResume ? (
          <button type="button" className="voice-stage-btn voice-stage-btn--resume" onClick={props.onResume}>
            <RotateCw size={20} aria-hidden />
            <span>Resume</span>
          </button>
        ) : (
          <button
            type="button"
            className={`voice-stage-btn voice-stage-btn--round${props.muted ? " is-on" : ""}`}
            onClick={props.onToggleMute}
            aria-pressed={props.muted}
            aria-label={props.muted ? "Unmute microphone" : "Mute microphone"}
            disabled={props.exiting}
          >
            {props.muted ? <MicOff size={22} aria-hidden /> : <Mic size={22} aria-hidden />}
          </button>
        )}
        <button
          type="button"
          className="voice-stage-btn voice-stage-btn--end"
          onClick={props.onEnd}
          aria-label="End voice"
          disabled={props.exiting}
        >
          <Square size={16} fill="currentColor" strokeWidth={0} aria-hidden />
          <span>End voice</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}