"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isBrowserSpeechSupported,
  startBrowserSpeech,
  type BrowserSpeechSession,
} from "@/lib/browser-speech";
import type { SessionMode } from "@/lib/protocol";
import { shouldAutoStartSet } from "@/lib/session-mode";
import type { ProtocolPhase, SessionKind } from "@/lib/types";

export type VoicePhase =
  | "off"
  | "listening"
  | "thinking"
  | "speaking"
  | "bls";

export type SendUserMessageResult = {
  startSet: boolean;
  riskFlag?: boolean;
  /** Flooding / dissociation / felt unsafety. Never set by a high SUDs. */
  outOfWindow?: boolean;
  distress?: "ok" | "elevated" | "overwhelm";
  agentText?: string;
  agentId?: string;
  phase?: ProtocolPhase;
};

type UseGuidedVoiceModeOpts = {
  voiceFeatureOn: boolean;
  sessionKind: SessionKind;
  phase: ProtocolPhase;
  sessionMode: SessionMode;
  running: boolean;
  onSend: (text: string) => Promise<SendUserMessageResult>;
  onPlayLine: (text: string) => Promise<void>;
  onBeginBls: () => void;
  /** Latest agent message id — used after check-in to speak the new line. */
  lastAgentId: string | null;
  lastAgentContent: string | null;
};

const SILENCE_MS = 1400;

export function useGuidedVoiceMode({
  voiceFeatureOn,
  sessionKind,
  phase,
  sessionMode,
  running,
  onSend,
  onPlayLine,
  onBeginBls,
  lastAgentId,
  lastAgentContent,
}: UseGuidedVoiceModeOpts) {
  const supported = isBrowserSpeechSupported();
  const available = voiceFeatureOn && supported;

  const [active, setActive] = useState(false);
  const [phaseVoice, setPhaseVoice] = useState<VoicePhase>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** True when the mic engine really stopped while we meant to be listening. */
  const [stalled, setStalled] = useState(false);

  const sessionRef = useRef<BrowserSpeechSession | null>(null);
  const finalBufRef = useRef("");
  /** Latest interim text; used if the engine dies before it becomes final. */
  const interimBufRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const phaseRef = useRef<VoicePhase>("off");
  const turnBusyRef = useRef(false);
  const spokenAgentIdRef = useRef<string | null>(null);
  const optsRef = useRef({
    sessionKind,
    phase,
    sessionMode,
    onSend,
    onPlayLine,
    onBeginBls,
  });

  activeRef.current = active;
  phaseRef.current = phaseVoice;
  optsRef.current = {
    sessionKind,
    phase,
    sessionMode,
    onSend,
    onPlayLine,
    onBeginBls,
  };

  const clearSilence = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    clearSilence();
    sessionRef.current?.abort();
    sessionRef.current = null;
  }, [clearSilence]);

  const finishTurn = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || turnBusyRef.current || !activeRef.current) return;
    turnBusyRef.current = true;
    stopRecognition();
    setInterim("");
    finalBufRef.current = "";
    interimBufRef.current = "";
    setPhaseVoice("thinking");
    setError(null);

    try {
      const result = await optsRef.current.onSend(trimmed);
      if (!activeRef.current) return;

      if (result.agentId) spokenAgentIdRef.current = result.agentId;

      const agentText = result.agentText?.trim();
      if (agentText) {
        setPhaseVoice("speaking");
        await optsRef.current.onPlayLine(agentText);
      }
      if (!activeRef.current) return;

      const auto = shouldAutoStartSet({
        startSet: result.startSet,
        sessionKind: optsRef.current.sessionKind,
        phase: result.phase ?? optsRef.current.phase,
        sessionMode: "idle",
        riskFlag: result.riskFlag,
        outOfWindow: result.outOfWindow,
      });

      if (auto) {
        setPhaseVoice("bls");
        optsRef.current.onBeginBls();
      } else {
        setPhaseVoice("listening");
      }
    } catch {
      if (activeRef.current) {
        setError("Could not send that. Try again.");
        setPhaseVoice("listening");
      }
    } finally {
      turnBusyRef.current = false;
    }
  }, [stopRecognition]);

  const scheduleSilenceCommit = useCallback(() => {
    clearSilence();
    silenceTimerRef.current = setTimeout(() => {
      const text = `${finalBufRef.current} ${interimBufRef.current}`.trim();
      if (text) void finishTurn(text);
    }, SILENCE_MS);
  }, [clearSilence, finishTurn]);

  const startListening = useCallback(() => {
    if (!activeRef.current || running) return;
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
      return;
    }
    stopRecognition();
    finalBufRef.current = "";
    interimBufRef.current = "";
    setInterim("");
    setStalled(false);
    setPhaseVoice("listening");

    const session = startBrowserSpeech({
      onInterim: (t) => {
        if (phaseRef.current !== "listening") return;
        interimBufRef.current = t;
        setInterim(t);
        // Keep the turn open while the person is still talking.
        scheduleSilenceCommit();
      },
      onFinal: (chunk) => {
        if (phaseRef.current !== "listening") return;
        interimBufRef.current = "";
        finalBufRef.current = `${finalBufRef.current} ${chunk}`.trim();
        setInterim("");
        scheduleSilenceCommit();
      },
      onError: (code, message) => {
        if (code === "aborted" || code === "no-speech") return;
        setError(message);
        if (code === "not-allowed" || code === "unsupported") {
          activeRef.current = false;
          setActive(false);
          setStalled(false);
          setPhaseVoice("off");
          stopRecognition();
        }
      },
      onStatus: (status) => {
        if (status === "listening") {
          setStalled(false);
          return;
        }
        // The engine gave up while the person still expects to be heard.
        if (
          status === "stopped" &&
          activeRef.current &&
          phaseRef.current === "listening"
        ) {
          setStalled(true);
        }
      },
    });

    if (!session) {
      activeRef.current = false;
      setActive(false);
      setStalled(false);
      setPhaseVoice("off");
      return;
    }
    sessionRef.current = session;
  }, [running, scheduleSilenceCommit, stopRecognition]);

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  const enter = useCallback(() => {
    if (!available) {
      setError(
        supported
          ? "Voice is turned off for this workspace."
          : "Voice isn’t supported in this browser. Try Chrome or Edge."
      );
      return;
    }
    setError(null);
    setStalled(false);
    setActive(true);
    activeRef.current = true;
    setPhaseVoice("listening");
    startListeningRef.current();
  }, [available, supported]);

  const exit = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setStalled(false);
    setPhaseVoice("off");
    setInterim("");
    finalBufRef.current = "";
    interimBufRef.current = "";
    turnBusyRef.current = false;
    stopRecognition();
  }, [stopRecognition]);

  /** Tap-to-resume after the browser gave the microphone back. */
  const resume = useCallback(() => {
    if (!activeRef.current || !available) return;
    setError(null);
    setStalled(false);
    startListeningRef.current();
  }, [available]);

  // Pause mic while BLS runs; resume after check-in TTS.
  useEffect(() => {
    if (!active) return;
    if (running) {
      stopRecognition();
      setPhaseVoice("bls");
      setInterim("");
      return;
    }
    if (sessionMode === "check_in" && phaseVoice === "bls") {
      // Wait for check-in message effect below to speak.
      return;
    }
    if (
      phaseVoice === "bls" &&
      sessionMode === "idle" &&
      !running
    ) {
      startListeningRef.current();
    }
  }, [active, running, sessionMode, phaseVoice, stopRecognition]);

  // Speak new agent lines that arrive outside a user turn (bootstrap / check-in).
  useEffect(() => {
    if (!active || !lastAgentId || !lastAgentContent) return;
    if (running) return;
    if (spokenAgentIdRef.current === lastAgentId) return;
    if (turnBusyRef.current) {
      spokenAgentIdRef.current = lastAgentId;
      return;
    }
    if (phaseVoice === "thinking" || phaseVoice === "speaking") return;

    spokenAgentIdRef.current = lastAgentId;
    let cancelled = false;
    void (async () => {
      stopRecognition();
      setPhaseVoice("speaking");
      await onPlayLine(lastAgentContent);
      if (cancelled || !activeRef.current) return;
      if (running) {
        setPhaseVoice("bls");
        return;
      }
      startListeningRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    active,
    lastAgentId,
    lastAgentContent,
    running,
    phaseVoice,
    onPlayLine,
    stopRecognition,
  ]);

  // Restart listening when entering listening phase without an active session.
  // When the engine stalled we wait for an explicit resume instead of spinning.
  useEffect(() => {
    if (!active || phaseVoice !== "listening" || running || stalled) return;
    if (sessionRef.current) return;
    startListening();
  }, [active, phaseVoice, running, stalled, startListening]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  return {
    available,
    supported,
    active,
    phase: phaseVoice,
    interim,
    error,
    /** Mic engine stopped while voice mode is still on. Offer `resume`. */
    stalled,
    enter,
    exit,
    resume,
    clearError: () => setError(null),
  };
}
