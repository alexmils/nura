"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserSpeechUsesContinuous,
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

/**
 * After the guide finishes speaking, recognition may still deliver the tail of
 * its own voice. Hold the buffer for a moment so those words cannot land in the
 * person's turn.
 */
const TTS_SETTLE_MS = 500;

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
  /** Ignore results until this timestamp (the guide's own voice tail). */
  const ignoreUntilRef = useRef(0);
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

  /**
   * iOS WebKit and desktop Chromium keep one session alive across utterances, so
   * the whole voice conversation runs on a single instance. Ending it between
   * turns forces a fresh `start()` that iOS will not honour without a new tap,
   * which is what made listening die after the first reply. Chrome for Android
   * has no continuous sessions at all, so it still rebuilds every turn.
   */
  const keepSessionAlive = useCallback(
    () => browserSpeechUsesContinuous(),
    []
  );

  /** Stop the engine for this turn; a no-op when one session carries the dialogue. */
  const releaseForTurn = useCallback(() => {
    if (keepSessionAlive()) {
      clearSilence();
      return;
    }
    stopRecognition();
  }, [clearSilence, keepSessionAlive, stopRecognition]);

  const finishTurn = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || turnBusyRef.current || !activeRef.current) return;
    turnBusyRef.current = true;
    releaseForTurn();
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
        // Drop the tail of the guide's own voice before the person's turn.
        ignoreUntilRef.current = Date.now() + TTS_SETTLE_MS;
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
  }, [releaseForTurn]);

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

    // One session already carries the conversation: reuse it instead of
    // calling start() again, which iOS would refuse without a fresh tap.
    if (keepSessionAlive() && sessionRef.current) {
      clearSilence();
      finalBufRef.current = "";
      interimBufRef.current = "";
      setInterim("");
      setStalled(false);
      setPhaseVoice("listening");
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
        if (Date.now() < ignoreUntilRef.current) return;
        interimBufRef.current = t;
        setInterim(t);
        // Keep the turn open while the person is still talking.
        scheduleSilenceCommit();
      },
      onFinal: (chunk) => {
        if (phaseRef.current !== "listening") return;
        if (Date.now() < ignoreUntilRef.current) return;
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
        if (status !== "stopped") return;
        // Drop the dead session so the reuse path cannot skip a real restart.
        sessionRef.current = null;
        // Only surface it when the person expects to be heard right now.
        if (activeRef.current && phaseRef.current === "listening") {
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
  }, [
    running,
    scheduleSilenceCommit,
    stopRecognition,
    keepSessionAlive,
    clearSilence,
  ]);

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
      releaseForTurn();
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
  }, [active, running, sessionMode, phaseVoice, releaseForTurn]);

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
      releaseForTurn();
      setPhaseVoice("speaking");
      await onPlayLine(lastAgentContent);
      if (cancelled || !activeRef.current) return;
      ignoreUntilRef.current = Date.now() + TTS_SETTLE_MS;
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
    releaseForTurn,
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
