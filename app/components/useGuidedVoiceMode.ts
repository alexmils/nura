"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  browserSpeechUsesContinuous,
  isBrowserSpeechSupported,
  startBrowserSpeech,
  type BrowserSpeechCallbacks,
  type BrowserSpeechSession,
} from "@/lib/browser-speech";
import { startServerSpeech, type ServerSpeechSession } from "@/lib/server-stt";
import { unlockVoiceAudio, voiceOutputLevel } from "@/lib/voice-audio";
import { createChimeGate, START_CHIME_MIC_GUARD_MS } from "@/lib/voice-chime";
import { createSpokenTracker } from "@/lib/voice-playback";
import { playVoiceChime } from "./voice/voice-chime-player";
import { useVoicePrefs } from "./voice/useVoicePrefs";
import { selectVoiceEngine, type VoiceEngine } from "@/lib/voice-capture";
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
  /** Stop the guide's current reply (tap to interrupt). */
  onStopPlayback?: () => void;
};

type EngineSession = BrowserSpeechSession & Partial<Pick<ServerSpeechSession, "pause" | "resume" | "level">>;

function readCapabilities(serverStt: boolean) {
  if (typeof window === "undefined") {
    return { hasSpeechRecognition: false, hasMediaRecorder: false, serverStt, userAgent: "" };
  }
  return {
    hasSpeechRecognition: isBrowserSpeechSupported(),
    hasMediaRecorder:
      typeof window.MediaRecorder !== "undefined" &&
      Boolean(window.navigator?.mediaDevices?.getUserMedia),
    serverStt,
    userAgent: window.navigator?.userAgent ?? "",
    maxTouchPoints: window.navigator?.maxTouchPoints ?? 0,
  };
}

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
  onStopPlayback,
}: UseGuidedVoiceModeOpts) {
  /** Server STT availability (GET /api/voice/transcribe), learned once. */
  const [serverStt, setServerStt] = useState(false);
  const [engineOverride, setEngineOverride] = useState<VoiceEngine | null>(null);
  useEffect(() => {
    if (!voiceFeatureOn) return;
    let cancelled = false;
    void fetch("/api/voice/transcribe")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d: { available?: boolean }) => {
        if (!cancelled) setServerStt(Boolean(d.available));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [voiceFeatureOn]);
  const engine: VoiceEngine = useMemo(
    () => engineOverride ?? selectVoiceEngine(readCapabilities(serverStt)),
    [engineOverride, serverStt]
  );
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const supported = engine !== "none";
  const available = voiceFeatureOn && supported;

  const [active, setActive] = useState(false);
  const [phaseVoice, setPhaseVoice] = useState<VoicePhase>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** True when the mic engine really stopped while we meant to be listening. */
  const [stalled, setStalled] = useState(false);
  /** Mic asked to start but not live yet (permission prompt, engine spin-up). */
  const [starting, setStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  /** Last time words arrived (browser engine has no level meter on phones). */
  const heardAtRef = useRef(0);

  const sessionRef = useRef<EngineSession | null>(null);
  const finalBufRef = useRef("");
  /** Latest interim text; used if the engine dies before it becomes final. */
  const interimBufRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ignore results until this timestamp (the guide's own voice tail). */
  const ignoreUntilRef = useRef(0);
  /** Start / end chimes: once per entry and exit (lib/voice-chime). */
  const voicePrefs = useVoicePrefs(voiceFeatureOn);
  const chimeOnRef = useRef(true);
  chimeOnRef.current = voicePrefs?.sounds ?? true;
  const chimeGateRef = useRef(createChimeGate());
  const activeRef = useRef(false);
  const phaseRef = useRef<VoicePhase>("off");
  const turnBusyRef = useRef(false);
  /**
   * Bumped on every enter and exit. Async work (a turn's reply, a spoken
   * line) checks it before touching state, so a quick close + reopen never
   * lets the old session speak or change phase in the new one.
   */
  const sessionGenRef = useRef(0);
  /** Agent ids already shown before voice opened or already spoken (once each). */
  const spokenRef = useRef(createSpokenTracker());
  const lastAgentIdRef = useRef(lastAgentId);
  lastAgentIdRef.current = lastAgentId;
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
    () => engineRef.current === "server" || browserSpeechUsesContinuous(),
    []
  );

  /** Stop the engine for this turn; a no-op when one session carries the dialogue. */
  const releaseForTurn = useCallback(() => {
    if (keepSessionAlive()) {
      clearSilence();
      // Server engine: stop listening while the guide thinks and speaks, so
      // its own voice cannot become the person's next turn.
      sessionRef.current?.pause?.();
      return;
    }
    stopRecognition();
  }, [clearSilence, keepSessionAlive, stopRecognition]);

  const finishTurn = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || turnBusyRef.current || !activeRef.current) return;
    const gen = sessionGenRef.current;
    const stale = () => gen !== sessionGenRef.current || !activeRef.current;
    turnBusyRef.current = true;
    releaseForTurn();
    setInterim("");
    finalBufRef.current = "";
    interimBufRef.current = "";
    setPhaseVoice("thinking");
    setError(null);

    try {
      const result = await optsRef.current.onSend(trimmed);
      if (stale()) return;

      spokenRef.current.mark(result.agentId);

      const agentText = result.agentText?.trim();
      if (agentText) {
        setPhaseVoice("speaking");
        await optsRef.current.onPlayLine(agentText);
        if (stale()) return;
        // Drop the tail of the guide's own voice before the person's turn.
        ignoreUntilRef.current = Date.now() + TTS_SETTLE_MS;
      }
      if (stale()) return;

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
      if (!stale()) {
        setError("Could not send that. Try again.");
        setPhaseVoice("listening");
      }
    } finally {
      // An old session's turn must not clear the new session's busy flag.
      if (gen === sessionGenRef.current) turnBusyRef.current = false;
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
      if (!mutedRef.current) sessionRef.current.resume?.();
      return;
    }

    stopRecognition();
    finalBufRef.current = "";
    interimBufRef.current = "";
    setInterim("");
    setStalled(false);
    setPhaseVoice("listening");

    const callbacks: BrowserSpeechCallbacks = {
      onInterim: (t) => {
        if (phaseRef.current !== "listening" || mutedRef.current) return;
        if (Date.now() < ignoreUntilRef.current) return;
        if (engineRef.current === "server") {
          // Server engine: "…" while an utterance uploads.
          setInterim(t);
          return;
        }
        heardAtRef.current = Date.now();
        interimBufRef.current = t;
        setInterim(t);
        // Keep the turn open while the person is still talking.
        scheduleSilenceCommit();
      },
      onFinal: (chunk) => {
        if (phaseRef.current !== "listening" || mutedRef.current) return;
        if (Date.now() < ignoreUntilRef.current) return;
        heardAtRef.current = Date.now();
        if (engineRef.current === "server") {
          // One upload is one whole utterance: answer it right away.
          void finishTurn(chunk);
          return;
        }
        interimBufRef.current = "";
        finalBufRef.current = `${finalBufRef.current} ${chunk}`.trim();
        setInterim("");
        scheduleSilenceCommit();
      },
      onError: (code, message) => {
        if (code === "aborted" || code === "no-speech") return;
        // Server STT not configured after all: fall back to the browser engine.
        if (code === "unsupported" && engineRef.current === "server" && isBrowserSpeechSupported()) {
          sessionRef.current = null;
          setEngineOverride("browser");
          setStarting(false);
          return;
        }
        setError(message);
        if (code === "not-allowed" || code === "unsupported") {
          setStarting(false);
          activeRef.current = false;
          setActive(false);
          setStalled(false);
          setPhaseVoice("off");
          stopRecognition();
        }
      },
      onStatus: (status) => {
        if (status === "starting") {
          setStarting(true);
          return;
        }
        if (status === "listening") {
          setStarting(false);
          setStalled(false);
          setError(null);
          return;
        }
        if (status !== "stopped") return;
        setStarting(false);
        // Drop the dead session so the reuse path cannot skip a real restart.
        sessionRef.current = null;
        // Only surface it when the person expects to be heard right now.
        if (activeRef.current && phaseRef.current === "listening") {
          setStalled(true);
        }
      },
    };
    const session: EngineSession | null =
      engineRef.current === "server"
        ? startServerSpeech(callbacks, { lang: typeof navigator !== "undefined" ? navigator.language : undefined })
        : startBrowserSpeech(callbacks);
    if (session && mutedRef.current) session.pause?.();

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
    finishTurn,
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
    // Inside the tap: unlock audio output (iOS) before anything async.
    unlockVoiceAudio();
    // A start that never went live leaves the gate open; resync it silently.
    if (!activeRef.current && chimeGateRef.current.open) chimeGateRef.current.exit();
    if (chimeGateRef.current.enter()) {
      // Before the mic opens (that waits on getUserMedia); words heard while
      // it rings are dropped so the chime is never transcribed.
      playVoiceChime("start", chimeOnRef.current);
      ignoreUntilRef.current = Date.now() + START_CHIME_MIC_GUARD_MS;
    }
    // Lines already on screen were shown (and maybe read) before voice
    // opened: never replay them. Only replies that arrive from now on speak.
    spokenRef.current.baseline(lastAgentIdRef.current);
    // New session: anything still running from the last one is stale.
    sessionGenRef.current += 1;
    turnBusyRef.current = false;
    clearSilence();
    setError(null);
    setStalled(false);
    setMuted(false);
    setActive(true);
    activeRef.current = true;
    setPhaseVoice("listening");
    startListeningRef.current();
  }, [available, supported, clearSilence]);

  const exit = useCallback(() => {
    sessionGenRef.current += 1;
    activeRef.current = false;
    setActive(false);
    setStalled(false);
    setPhaseVoice("off");
    setInterim("");
    finalBufRef.current = "";
    interimBufRef.current = "";
    turnBusyRef.current = false;
    setStarting(false);
    setMuted(false);
    stopRecognition();
  }, [stopRecognition]);

  /** Tap-to-resume after the browser gave the microphone back. */
  const resume = useCallback(() => {
    if (!activeRef.current || !available) return;
    unlockVoiceAudio();
    setError(null);
    setStalled(false);
    // A dead session cannot be resumed; drop it so a fresh one starts.
    if (phaseRef.current === "listening") stopRecognition();
    startListeningRef.current();
  }, [available, stopRecognition]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    clearSilence();
    if (next) {
      finalBufRef.current = "";
      interimBufRef.current = "";
      setInterim("");
      sessionRef.current?.pause?.();
    } else if (phaseRef.current === "listening") {
      sessionRef.current?.resume?.();
    }
  }, [clearSilence]);

  /** Tap while the guide speaks: stop the reply and listen (barge-in). */
  const interrupt = useCallback(() => {
    if (phaseRef.current === "speaking") onStopPlayback?.();
  }, [onStopPlayback]);

  /** 0..1 mic level for the orb: real meter on the server engine. */
  const getInputLevel = useCallback(() => {
    if (!activeRef.current || mutedRef.current || phaseRef.current !== "listening") return 0;
    const live = sessionRef.current?.level?.();
    if (typeof live === "number") return live;
    // Browser engine: no meter on phones, so glow while words are arriving.
    const since = Date.now() - heardAtRef.current;
    return since < 900 ? 0.75 * (1 - since / 900) + 0.15 : 0.12;
  }, []);

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
    if (spokenRef.current.has(lastAgentId)) return;
    if (turnBusyRef.current) {
      // The turn plays its own reply.
      spokenRef.current.mark(lastAgentId);
      return;
    }
    if (phaseVoice === "thinking" || phaseVoice === "speaking") return;
    if (!spokenRef.current.claim(lastAgentId)) return;
    // Not tied to this effect's cleanup: setting "speaking" re-runs the
    // effect, which used to cancel the line and leave the phase stuck.
    const gen = sessionGenRef.current;
    void (async () => {
      releaseForTurn();
      setPhaseVoice("speaking");
      await onPlayLine(lastAgentContent);
      if (gen !== sessionGenRef.current || !activeRef.current) return;
      ignoreUntilRef.current = Date.now() + TTS_SETTLE_MS;
      if (running) {
        setPhaseVoice("bls");
        return;
      }
      // startListening skips while the phase reads "speaking"; the ref is
      // what it checks, so move it on first (it sets the state itself).
      phaseRef.current = "listening";
      startListeningRef.current();
    })();
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

  // Engine fallback (server STT turned out unavailable): start the new one.
  useEffect(() => {
    if (!engineOverride || !activeRef.current) return;
    if (phaseRef.current === "listening" && !sessionRef.current) startListeningRef.current();
  }, [engineOverride]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  // End chime on every way out: End voice, mic denied, session end, unmount.
  useEffect(() => {
    if (!active && chimeGateRef.current.exit()) playVoiceChime("end", chimeOnRef.current);
  }, [active]);
  useEffect(
    () => () => {
      if (chimeGateRef.current.exit()) playVoiceChime("end", chimeOnRef.current);
    },
    []
  );

  return {
    available,
    supported,
    active,
    phase: phaseVoice,
    interim,
    error,
    /** Mic engine stopped while voice mode is still on. Offer `resume`. */
    stalled,
    /** Waiting for the microphone to really open. */
    starting,
    muted,
    engine,
    enter,
    exit,
    resume,
    toggleMute,
    interrupt,
    getInputLevel,
    getOutputLevel: voiceOutputLevel,
    clearError: () => setError(null),
  };
}
