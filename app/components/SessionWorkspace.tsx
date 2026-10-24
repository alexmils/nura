"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  cancelDeviceVoice,
  prepareVoicePlayback,
  speakWithDeviceVoice,
  voiceAudioElement,
} from "@/lib/voice-audio";
import { useApp } from "./AppProvider";
import { BallCanvas } from "./BallCanvas";
import {
  freeSessionChromeCssVars,
  resolveFreeSessionChrome,
} from "@/lib/free-session-chrome";
import { BlsToolbar } from "./BlsToolbar";
import { AgentOverlay } from "./AgentOverlay";
import { GearPanel, type GearSectionId } from "./GearPanel";
import { SessionStatusBar } from "./SessionStatusBar";
import { SessionStartScreen } from "./SessionStartScreen";
import { SessionDescription } from "./SessionDescription";
import { InformedConsentGate } from "./InformedConsentGate";
import { CrisisHelpButton } from "./CrisisHelpButton";
import {
  ResumeClosureBanner,
  SessionClosureModal,
} from "./SessionClosureModal";
import { startGamepadLoop, stopGamepadLoop } from "@/lib/gamepad";
import { displayNameFor, useCurrentUser } from "./useCurrentUser";
import {
  moveBlsToolbarField,
  type BlsToolbarField,
} from "@/lib/bls-toolbar-nav";
import { getActiveSpeedHz } from "@/lib/bls-speed";
import { useGamepadConnected } from "@/lib/useGamepadConnected";
import { useGuideHost, useGuideOptional } from "./guide/ProductGuide";
import {
  canManualStartGuidedSet,
  canRepeatGuidedSet,
  canStartBls,
  phaseAllowsBlsSet,
  shouldAutoStartSet,
  showsBlsToolbar,
  showsComposer,
  usesAgent,
} from "@/lib/session-mode";
import { shouldBeginBlsAfterAd } from "@/lib/ads";
import { WorkspaceMenuButton } from "./SidebarNavContext";
import { LearnTeaser } from "./LearnTeaser";
import { BillingChargeHint } from "./BillingChargeHint";
import { useGuidedVoiceMode } from "./useGuidedVoiceMode";
import { GuidedSetReady } from "./agent/GuidedSetReady";
import { SessionClosureCard } from "./agent/SessionClosureCard";
import { closureCardData } from "@/lib/session-closure-card";
import {
  shouldOfferResumeClosure,
  shouldPromptSessionClosure,
  isEmptyDisposableSession,
} from "@/lib/session-closure";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function SessionWorkspace() {
  const {
    threads,
    activeThreadId,
    messages,
    agentTyping,
    restoringSession,
    bls,
    setBls,
    sessionMode,
    setSessionMode,
    sendUserMessage,
    noteComposerDraft,
    flushPendingReplies,
    requestCheckIn,
    settings,
    entitlement,
    leaseBlsSeconds,
    openUpgradeModal,
    createThread,
    maybeShowAd,
    noteAdSetCompleted,
    voiceEnabled,
    guidedChatChromeId,
    freeSessionChromeId,
    consentOk,
    refreshConsent,
    registerLeaveGuard,
    updateThreadLocal,
    deleteThread,
  } = useApp();
  const { user: currentUser } = useCurrentUser();

  const [running, setRunning] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [gearSection, setGearSection] = useState<{
    id: GearSectionId;
    nonce: number;
  } | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [focusedField, setFocusedField] = useState<BlsToolbarField>("speed1");
  const [closureOpen, setClosureOpen] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playResolveRef = useRef<(() => void) | null>(null);
  const playGenRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const blsDockRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(running);
  /** True while Voice Mode owns auto-start, so chat does not double-start a set. */
  const voiceActiveRef = useRef(false);
  const toggleRunningRef = useRef<() => void>(() => {});
  const navigateToolbarRef = useRef<
    (direction: "left" | "right" | "up" | "down") => void
  >(() => {});
  const gamepadConnected = useGamepadConnected();
  const gamepadConnectedRef = useRef(gamepadConnected);
  const freeLeaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeLeaseBusyRef = useRef(false);
  const adGateBusyRef = useRef(false);

  runningRef.current = running;
  gamepadConnectedRef.current = gamepadConnected;

  // The controller step shows the real vibration control, which the bar hides
  // until a gamepad is connected.
  const guide = useGuideOptional();
  const previewVibration = guide?.active === true && guide.step?.id === "joystick";

  const thread = threads.find((t) => t.id === activeThreadId);
  const hasUserMessage = messages.some((m) => m.role === "user");
  const guided = thread ? usesAgent(thread.mode) : false;
  const blsActive = thread != null && thread.mode !== "pending";
  const startAllowed =
    thread != null &&
    canStartBls({
      sessionKind: thread.mode,
      phase: thread.phase,
      sessionMode,
    });
  const repeatAllowed =
    thread != null &&
    canRepeatGuidedSet({
      sessionKind: thread.mode,
      phase: thread.phase,
      sessionMode,
    });
  const toolbarVisible =
    thread != null &&
    showsBlsToolbar({
      sessionKind: thread.mode,
      phase: thread.phase,
      sessionMode,
    });
  const setGate =
    thread != null
      ? {
          sessionKind: thread.mode,
          phase: thread.phase,
          sessionMode,
          target: thread.target,
          suds: thread.suds,
          dissociation: thread.dissociation,
        }
      : null;
  const manualStartAllowed =
    setGate != null && !running && canManualStartGuidedSet(setGate);
  const showClosureCard =
    thread != null &&
    thread.mode === "guided" &&
    thread.phase === "closure" &&
    hasUserMessage;

  const stopSetForLeave = useCallback(() => {
    if (freeLeaseTimerRef.current) {
      clearTimeout(freeLeaseTimerRef.current);
      freeLeaseTimerRef.current = null;
    }
    runningRef.current = false;
    setRunning(false);
    setSessionMode("idle");
  }, [setSessionMode]);

  // The product tour points at the controls bar, opens the gear sheet and
  // expands the section it talks about, and can stop a set before switching
  // session (so no lease keeps ticking behind the tour).
  useGuideHost({
    openGear: () => setGearOpen(true),
    closeGear: () => setGearOpen(false),
    stopSet: stopSetForLeave,
    openGearSection: (section) => {
      setGearSection({ id: section, nonce: Date.now() });
      setGearOpen(true);
    },
  });

  useEffect(() => {
    registerLeaveGuard((proceed) => {
      const gate = {
        thread,
        setRunning: runningRef.current,
        hasUserMessage,
      };
      if (isEmptyDisposableSession(gate)) {
        const id = thread?.id;
        void (async () => {
          stopSetForLeave();
          if (id) await deleteThread(id);
          proceed();
        })();
        return true;
      }
      // Self-guided: leave quietly (stop set if running; no closure modal).
      if (thread?.mode === "free") {
        stopSetForLeave();
        return false;
      }
      if (!shouldPromptSessionClosure(gate)) {
        return false;
      }
      pendingLeaveRef.current = proceed;
      setClosureOpen(true);
      return true;
    });
    return () => registerLeaveGuard(null);
  }, [
    registerLeaveGuard,
    thread,
    hasUserMessage,
    deleteThread,
    stopSetForLeave,
  ]);

  useEffect(() => {
    setResumeDismissed(false);
  }, [thread?.id]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const gate = {
        thread,
        setRunning: runningRef.current,
        hasUserMessage,
      };
      if (isEmptyDisposableSession(gate) && thread?.id) {
        void fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: thread.id }),
          keepalive: true,
        });
        return;
      }
      if (shouldPromptSessionClosure(gate)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [thread, hasUserMessage]);

  const handleDoClosure = useCallback(() => {
    setClosureOpen(false);
    stopSetForLeave();
    if (thread) {
      void updateThreadLocal(thread.id, {
        phase: "closure",
        incomplete: false,
      });
    }
    pendingLeaveRef.current = null;
  }, [thread, updateThreadLocal, stopSetForLeave]);

  const handleLeaveAnyway = useCallback(() => {
    setClosureOpen(false);
    stopSetForLeave();
    const proceed = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    if (thread) {
      void updateThreadLocal(thread.id, { incomplete: true }).then(() => {
        proceed?.();
      });
      return;
    }
    proceed?.();
  }, [thread, updateThreadLocal, stopSetForLeave]);

  const handleClosureCancel = useCallback(() => {
    setClosureOpen(false);
    pendingLeaveRef.current = null;
  }, []);

  const handleResumeClosure = useCallback(() => {
    if (!thread) return;
    void updateThreadLocal(thread.id, {
      phase: "closure",
      incomplete: false,
    });
    setResumeDismissed(true);
  }, [thread, updateThreadLocal]);

  const clearFreeLeaseTimer = useCallback(() => {
    if (freeLeaseTimerRef.current) {
      clearTimeout(freeLeaseTimerRef.current);
      freeLeaseTimerRef.current = null;
    }
  }, []);

  const stopFreeBls = useCallback(() => {
    clearFreeLeaseTimer();
    runningRef.current = false;
    setRunning(false);
    setSessionMode("idle");
  }, [clearFreeLeaseTimer, setSessionMode]);

  const continueFreeLease = useCallback(async () => {
    if (!runningRef.current || freeLeaseBusyRef.current) return;
    freeLeaseBusyRef.current = true;
    try {
      const granted = await leaseBlsSeconds(30);
      if (!runningRef.current) return;
      if (granted <= 0) {
        stopFreeBls();
        openUpgradeModal("bls_limit_reached");
        return;
      }
      clearFreeLeaseTimer();
      freeLeaseTimerRef.current = setTimeout(() => {
        void continueFreeLease();
      }, granted * 1000);
    } finally {
      freeLeaseBusyRef.current = false;
    }
  }, [leaseBlsSeconds, stopFreeBls, openUpgradeModal, clearFreeLeaseTimer]);

  const beginBlsRun = useCallback(() => {
    if (!thread) return;
    // Anything still waiting for the quiet window goes to the guide now.
    flushPendingReplies();
    setRunning(true);
    runningRef.current = true;
    setSessionMode("running");
    if (thread.mode === "free" && !thread.intakeComplete) {
      void updateThreadLocal(thread.id, { intakeComplete: true });
    }
    if (thread.mode === "free" && entitlement?.isTrialLimited) {
      void continueFreeLease();
    }
  }, [
    thread,
    setSessionMode,
    entitlement,
    continueFreeLease,
    updateThreadLocal,
    flushPendingReplies,
  ]);

  /**
   * Safety net: target + SUDs are known but the phase never advanced. Move the
   * thread into desensitization first so the check-in after the set reads it
   * as a real processing set, then run the ball.
   */
  const startGuidedSetManually = useCallback(async () => {
    if (!thread || runningRef.current) return;
    if (!phaseAllowsBlsSet(thread.phase)) {
      await updateThreadLocal(thread.id, {
        phase: "desensitization",
        intakeComplete: true,
        incomplete: true,
      });
    }
    beginBlsRun();
  }, [thread, updateThreadLocal, beginBlsRun]);

  const toggleRunning = useCallback(() => {
    if (!blsActive || !thread) return;
    if (runningRef.current) {
      clearFreeLeaseTimer();
      runningRef.current = false;
      setRunning(false);
      // A set cut short processed nothing. Record it as stopped so the guide
      // knows the work did not happen and offers the same set again, instead
      // of silently reading it as a finished set.
      if (guided && phaseAllowsBlsSet(thread.phase)) {
        setSessionMode("check_in");
        void requestCheckIn("stopped");
        return;
      }
      setSessionMode("idle");
      return;
    }
    if (adGateBusyRef.current) return;
    if (
      !canStartBls({
        sessionKind: thread.mode,
        phase: thread.phase,
        sessionMode,
      })
    ) {
      return;
    }

    if (
      thread.mode === "free" &&
      entitlement?.isTrialLimited &&
      entitlement.blsSecondsRemaining <= 0
    ) {
      openUpgradeModal("bls_limit_reached");
      return;
    }

    if (thread.mode === "free" && entitlement?.isTrialLimited) {
      adGateBusyRef.current = true;
      void (async () => {
        try {
          const result = await maybeShowAd();
          if (!blsActive) return;
          if (shouldBeginBlsAfterAd(result)) {
            beginBlsRun();
          }
        } finally {
          adGateBusyRef.current = false;
        }
      })();
      return;
    }

    beginBlsRun();
  }, [
    blsActive,
    thread,
    guided,
    sessionMode,
    setSessionMode,
    entitlement,
    openUpgradeModal,
    clearFreeLeaseTimer,
    maybeShowAd,
    beginBlsRun,
    requestCheckIn,
  ]);

  useEffect(() => {
    return () => clearFreeLeaseTimer();
  }, [clearFreeLeaseTimer]);

  const repeatSet = useCallback(() => {
    if (!thread || !repeatAllowed) return;
    setRunning(true);
    runningRef.current = true;
    setSessionMode("running");
  }, [thread, repeatAllowed, setSessionMode]);

  const handleSetComplete = useCallback(() => {
    clearFreeLeaseTimer();
    runningRef.current = false;
    setRunning(false);
    if (!guided) {
      noteAdSetCompleted();
      setSessionMode("idle");
      return;
    }
    setSessionMode("check_in");
    void requestCheckIn("completed");
  }, [
    guided,
    setSessionMode,
    requestCheckIn,
    clearFreeLeaseTimer,
    noteAdSetCompleted,
  ]);

  /** In-flight /api/voice request; aborted when playback stops or restarts. */
  const playAbortRef = useRef<AbortController | null>(null);
  const stopPlayback = useCallback(() => {
    playGenRef.current += 1;
    playAbortRef.current?.abort();
    playAbortRef.current = null;
    cancelDeviceVoice();
    if (audioRef.current) {
      audioRef.current.pause();
      try {
        if (audioRef.current.src.startsWith("blob:")) URL.revokeObjectURL(audioRef.current.src);
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    const resolve = playResolveRef.current;
    playResolveRef.current = null;
    resolve?.();
  }, []);

  const playLine = useCallback(
    async (text: string) => {
      stopPlayback();
      const gen = playGenRef.current;
      const ctl = new AbortController();
      playAbortRef.current = ctl;
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ctl.signal,
        });
        if (gen !== playGenRef.current) return;
        if (!res.ok) {
          // Server voice unavailable: in voice mode the guide still speaks,
          // with the device's own voice.
          if (voiceActiveRef.current) {
            if (!(await prepareVoicePlayback({ isCancelled: () => gen !== playGenRef.current }))) return;
            await speakWithDeviceVoice(text);
          }
          return;
        }
        const buf = await res.arrayBuffer();
        if (gen !== playGenRef.current) return;
        // Voice mode: after the start chime, with the output warmed up, so
        // the first syllable is not clipped (lib/voice-playback.ts).
        if (
          voiceActiveRef.current &&
          !(await prepareVoicePlayback({ isCancelled: () => gen !== playGenRef.current }))
        ) {
          return;
        }
        const blob = new Blob([buf], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        // Reuse the element unlocked by the "Start voice" tap: iOS rejects a
        // brand-new Audio() that starts seconds after the tap.
        const audio = voiceAudioElement();
        audio.src = url;
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            if (playResolveRef.current === done) playResolveRef.current = null;
            try {
              URL.revokeObjectURL(url);
            } catch {
              /* ignore */
            }
            resolve();
          };
          playResolveRef.current = done;
          audio.addEventListener("ended", done, { once: true });
          audio.addEventListener("error", done, { once: true });
          void audio.play().catch(() => done());
        });
      } catch {
        /* voice optional */
      }
    },
    [stopPlayback]
  );

  const navigateToolbar = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const step = direction === "left" || direction === "up" ? -1 : 1;
      setFocusedField((prev) =>
        moveBlsToolbarField(prev, step, gamepadConnectedRef.current)
      );
    },
    []
  );

  toggleRunningRef.current = toggleRunning;
  navigateToolbarRef.current = navigateToolbar;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleRunningRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    startGamepadLoop({
      onToggle: () => toggleRunningRef.current(),
      onNavigate: (d) => navigateToolbarRef.current(d),
    });
    return () => stopGamepadLoop();
  }, [setBls]);

  useEffect(() => {
    if (!toolbarVisible) {
      setGearOpen(false);
      setToolbarCollapsed(false);
    }
  }, [toolbarVisible]);

  useEffect(() => {
    if (running) setGearOpen(false);
  }, [running]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    if (!toolbarVisible || running) {
      stage.style.setProperty("--bls-dock-height", "0px");
      return;
    }

    const dock = blsDockRef.current;
    if (!dock) return;

    const syncDockHeight = () => {
      stage.style.setProperty("--bls-dock-height", `${dock.offsetHeight}px`);
    };

    syncDockHeight();
    const observer = new ResizeObserver(syncDockHeight);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [toolbarVisible, toolbarCollapsed, gamepadConnected, thread?.mode, running]);

  // Typing in the composer keeps the "wait for them to finish" window open
  // (lib/reply-debounce.ts). Leaving the session screen sends what is waiting.
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement | null;
      if (el?.classList?.contains("agent-composer-input")) {
        noteComposerDraft(el.value ?? "");
      }
    };
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      flushPendingReplies();
    };
  }, [noteComposerDraft, flushPendingReplies]);

  const handleReply = useCallback(
    async (text: string, opts?: { immediate?: boolean }) => {
      if (!guided) return { startSet: false as const };
      // Voice Mode keeps its own turn-taking: no typing wait there.
      const result = await sendUserMessage(text, {
        immediate: opts?.immediate,
        voice: voiceActiveRef.current,
      });
      setSessionMode("idle");
      // The guide owns the ball in chat too, not only in Voice Mode. Without
      // this the reply says "I'll start the set now" and then nothing moves,
      // which is what forced people to press Space themselves.
      if (
        !voiceActiveRef.current &&
        shouldAutoStartSet({
          startSet: result.startSet,
          sessionKind: thread?.mode ?? "pending",
          phase: result.phase ?? thread?.phase ?? "intake",
          sessionMode: "idle",
          riskFlag: result.riskFlag,
          outOfWindow: result.outOfWindow,
        })
      ) {
        beginBlsRun();
      }
      return result;
    },
    [guided, thread?.mode, thread?.phase, sendUserMessage, setSessionMode, beginBlsRun]
  );

  const lastAgent = [...messages].reverse().find((m) => m.role === "agent");

  const voice = useGuidedVoiceMode({
    voiceFeatureOn: Boolean(voiceEnabled && guided),
    sessionKind: thread?.mode ?? "pending",
    phase: thread?.phase ?? "intake",
    sessionMode,
    running,
    onSend: handleReply,
    onPlayLine: playLine,
    onBeginBls: beginBlsRun,
    lastAgentId: lastAgent?.id ?? null,
    lastAgentContent: lastAgent?.content ?? null,
    onStopPlayback: stopPlayback,
  });

  voiceActiveRef.current = voice.active;

  const exitVoiceMode = voice.exit;
  const exitVoice = useCallback(() => {
    stopPlayback();
    exitVoiceMode();
  }, [stopPlayback, exitVoiceMode]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const showConsent = consentOk === false;
  // Hold the tour until consent is known: holding only once it turned out to
  // be missing let the tour card flash before the consent screen.
  const holdGuide = consentOk !== true;
  useEffect(() => {
    if (!guide) return;
    guide.setHeld(holdGuide);
    return () => guide.setHeld(false);
  }, [guide, holdGuide]);
  const showResume =
    Boolean(thread) &&
    shouldOfferResumeClosure(thread) &&
    !resumeDismissed &&
    !showConsent;

  if (showConsent) {
    return (
      <main className="workspace-main flex min-h-0 flex-1 flex-col">
        <header className="workspace-header workspace-header--consent">
          <div className="workspace-header-row">
            <div className="workspace-header-lead">
              <div className="min-w-0">
                <h1 className="workspace-title">Safety consent</h1>
              </div>
            </div>
            <div className="workspace-header-trail">
              <CrisisHelpButton />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
          <InformedConsentGate
            onCompleted={() => {
              void refreshConsent();
            }}
          />
        </div>
      </main>
    );
  }

  /**
   * A reload re-opens the session in the background. Hold a quiet placeholder
   * meanwhile: showing "Start a session" here would look like the session was
   * lost.
   */
  if (!thread && (restoringSession || activeThreadId)) {
    return (
      <main className="workspace-main flex min-h-0 flex-1 flex-col">
        <header className="workspace-header">
          <div className="workspace-header-row">
            <div className="workspace-header-lead">
              <WorkspaceMenuButton />
              <div className="min-w-0">
                <h1 className="workspace-title">Nura</h1>
              </div>
            </div>
          </div>
        </header>
        <div
          className="workspace-restore"
          role="status"
          aria-live="polite"
        >
          <span className="workspace-restore-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <p className="workspace-restore-text">Opening your session</p>
        </div>
      </main>
    );
  }

  if (!thread) {
    return (
      <main className="workspace-main flex min-h-0 flex-1 flex-col">
        <header className="workspace-header">
          <div className="workspace-header-row">
            <div className="workspace-header-lead">
              <WorkspaceMenuButton />
              <div className="min-w-0">
                <h1 className="workspace-title">Nura</h1>
              </div>
            </div>
            <div className="workspace-header-trail">
              <BillingChargeHint />
              <CrisisHelpButton />
            </div>
          </div>
        </header>
        <div className="workspace-home-empty flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
          <div className="workspace-home-empty-top flex flex-col items-center gap-4 text-center">
            <h2 className="session-start-title">Start a session</h2>
            <p className="session-start-subtitle max-w-md">
              Open a new chat to choose AI-guided or Free.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void createThread()}
            >
              New chat
            </button>
          </div>
          <div className="workspace-home-empty-learn">
            <LearnTeaser />
          </div>
        </div>
        <SessionClosureModal
          open={closureOpen}
          onDoClosure={handleDoClosure}
          onLeaveAnyway={handleLeaveAnyway}
          onCancel={handleClosureCancel}
        />
      </main>
    );
  }

  if (thread.mode === "pending") {
    return (
      <main className="workspace-main flex min-h-0 flex-1 flex-col">
        <header className="workspace-header">
          <div className="workspace-header-row">
            <div className="workspace-header-lead">
              <WorkspaceMenuButton />
              <div className="min-w-0">
                <h1 className="workspace-title">{thread.title}</h1>
                <p className="workspace-hint">Choose a session type to begin</p>
              </div>
            </div>
            <div className="workspace-header-trail">
              <BillingChargeHint />
              <CrisisHelpButton />
            </div>
          </div>
        </header>
        <SessionStartScreen />
        <SessionClosureModal
          open={closureOpen}
          onDoClosure={handleDoClosure}
          onLeaveAnyway={handleLeaveAnyway}
          onCancel={handleClosureCancel}
        />
      </main>
    );
  }

  return (
    <main
      className={`workspace-main flex min-h-0 flex-1 flex-col${
        running ? " workspace-main--immersive" : ""
      }${thread.mode === "free" ? " workspace-main--free-chrome" : ""}`}
      style={
        {
          ...(running ? { background: bls.background } : null),
          ...(thread.mode === "free"
            ? freeSessionChromeCssVars(
                resolveFreeSessionChrome(freeSessionChromeId).theme
              )
            : null),
        } as CSSProperties
      }
    >
      {/* One calm row: menu, one-line title + read-only description, quiet
          help. Editing lives in the sidebar (long press / right-click / ⋯).
          Phase lives in the transcript as badges. */}
      <header className="workspace-header workspace-header--calm">
        <div className="workspace-header-row">
          <div className="workspace-header-lead">
            <WorkspaceMenuButton />
            <SessionDescription
              title={thread.title}
              description={thread.description}
            />
          </div>
          <div className="workspace-header-trail">
            <BillingChargeHint />
            {!running ? <CrisisHelpButton /> : null}
          </div>
        </div>
      </header>

      {showResume ? (
        <ResumeClosureBanner
          open
          onResume={handleResumeClosure}
          onDismiss={() => setResumeDismissed(true)}
        />
      ) : null}

      <div
        ref={stageRef}
        className="workspace-stage relative flex min-h-0 flex-1 flex-col"
      >
        {guided && sessionMode === "check_in" && (
          <div className="session-status-float">
            <SessionStatusBar
              phase={thread.phase}
              mode={sessionMode}
              suds={thread.suds}
              voc={thread.voc}
              compact
            />
          </div>
        )}

        <BallCanvas
          running={running}
          speedHz={getActiveSpeedHz(bls)}
          ballColor={bls.ballColor}
          ballSize={bls.ballSize}
          background={bls.background}
          animation={bls.animation}
          animationPath={bls.animationPath}
          brightenFlashes={bls.brightenFlashes}
          flashColor={bls.flashColor}
          soundMuted={bls.soundMuted}
          leftSound={bls.leftSound}
          rightSound={bls.rightSound}
          reverseStereo={bls.reverseStereo}
          setLengthSec={bls.setLengthSec}
          repeats={bls.repeats}
          vibration={bls.vibration}
          onSetComplete={handleSetComplete}
          onToggle={toggleRunning}
          idleHint={
            guided
              ? startAllowed
                ? "default"
                : sessionMode === "check_in"
                  ? "check_in"
                  : "guided_wait"
              : "default"
          }
        />

        {showsComposer(thread.mode) && (
          <AgentOverlay
            messages={messages}
            hidden={running}
            autoVoice={settings.autoVoice}
            sessionMode={sessionMode}
            phase={thread.phase}
            phaseChanges={thread.phaseChanges}
            setStopped={thread.lastSetOutcome === "stopped"}
            guideLanguage={thread.agentLanguage}
            agentTyping={agentTyping}
            userAvatarUrl={currentUser?.avatarUrl}
            userDisplayName={displayNameFor(currentUser)}
            onReply={(t, o) => void handleReply(t, o)}
            onPlayLine={(t) => void playLine(t)}
            onRepeatSet={repeatAllowed ? repeatSet : undefined}
            voiceAvailable={voice.available}
            voiceActive={voice.active}
            voicePhase={voice.phase}
            voiceInterim={voice.interim}
            voiceError={voice.error}
            voiceStalled={voice.stalled}
            onEnterVoice={voice.enter}
            onExitVoice={exitVoice}
            onResumeVoice={voice.resume}
            voiceStarting={voice.starting}
            voiceMuted={voice.muted}
            onToggleMuteVoice={voice.toggleMute}
            onInterruptVoice={voice.interrupt}
            getVoiceInputLevel={voice.getInputLevel}
            getVoiceOutputLevel={voice.getOutputLevel}
            chromeId={guidedChatChromeId}
            setReady={
              guided && manualStartAllowed ? (
                <GuidedSetReady
                  compact={voice.active}
                  onStartSet={
                    manualStartAllowed
                      ? () => void startGuidedSetManually()
                      : undefined
                  }
                />
              ) : null
            }
            sessionClosed={showClosureCard}
            closureCard={
              showClosureCard ? (
                <SessionClosureCard
                  data={closureCardData(thread)}
                  onNextSession={() => void createThread()}
                />
              ) : null
            }
          />
        )}

        {toolbarVisible && !running && (
          <BlsToolbar
            ref={blsDockRef}
            bls={bls}
            onChange={setBls}
            collapsed={toolbarCollapsed}
            onToggleCollapse={() => setToolbarCollapsed((c) => !c)}
            onOpenGear={() => setGearOpen(true)}
            focusedField={focusedField}
            onFocusField={setFocusedField}
            previewVibration={previewVibration}
          />
        )}
      </div>

      {gearOpen && toolbarVisible && !running && (
        <GearPanel
          bls={bls}
          onChange={setBls}
          onClose={() => setGearOpen(false)}
          expandSection={gearSection}
        />
      )}

      <SessionClosureModal
        open={closureOpen}
        onDoClosure={handleDoClosure}
        onLeaveAnyway={handleLeaveAnyway}
        onCancel={handleClosureCancel}
      />
    </main>
  );
}
