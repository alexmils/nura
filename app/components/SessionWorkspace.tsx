"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "./AppProvider";
import { BallCanvas } from "./BallCanvas";
import {
  freeSessionChromeCssVars,
  resolveFreeSessionChrome,
} from "@/lib/free-session-chrome";
import { BlsToolbar } from "./BlsToolbar";
import { AgentOverlay } from "./AgentOverlay";
import { GearPanel } from "./GearPanel";
import { SessionStatusBar } from "./SessionStatusBar";
import { SessionStartScreen } from "./SessionStartScreen";
import { SessionDescription } from "./SessionDescription";
import { InformedConsentGate } from "./InformedConsentGate";
import { CrisisHelpButton } from "./CrisisHelpButton";
import {
  ResumeClosureBanner,
  SessionClosureModal,
} from "./SessionClosureModal";
import { signalFeedbackSessionEnd } from "./FeedbackPromptHost";
import { startGamepadLoop, stopGamepadLoop } from "@/lib/gamepad";
import { displayNameFor, useCurrentUser } from "./useCurrentUser";
import {
  moveBlsToolbarField,
  type BlsToolbarField,
} from "@/lib/bls-toolbar-nav";
import { getActiveSpeedHz } from "@/lib/bls-speed";
import { useGamepadConnected } from "@/lib/useGamepadConnected";
import { useGuideHost } from "./guide/ProductGuide";
import {
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

  // The product tour points at the controls bar, then opens the gear sheet.
  useGuideHost({
    openGear: () => setGearOpen(true),
    closeGear: () => setGearOpen(false),
  });

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

  const stopSetForLeave = useCallback(() => {
    if (freeLeaseTimerRef.current) {
      clearTimeout(freeLeaseTimerRef.current);
      freeLeaseTimerRef.current = null;
    }
    runningRef.current = false;
    setRunning(false);
    setSessionMode("idle");
  }, [setSessionMode]);

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

  // Signal NPS only when *this* thread transitions into closure — not when
  // switching to a thread that is already closed, and not on first hydrate.
  const prevThreadMetaRef = useRef<{
    id: string | undefined;
    phase: string | undefined;
  }>({ id: undefined, phase: undefined });
  useEffect(() => {
    const id = thread?.id;
    const phase = thread?.phase;
    const prev = prevThreadMetaRef.current;
    prevThreadMetaRef.current = { id, phase };

    if (!id || id !== prev.id) return;
    if (
      phase === "closure" &&
      prev.phase !== "closure" &&
      thread.incomplete !== true
    ) {
      void signalFeedbackSessionEnd();
    }
  }, [thread?.id, thread?.phase, thread?.incomplete]);

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
  ]);

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

  const stopPlayback = useCallback(() => {
    playGenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      try {
        URL.revokeObjectURL(audioRef.current.src);
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
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (gen !== playGenRef.current) return;
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        if (gen !== playGenRef.current) return;
        const blob = new Blob([buf], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
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

  const handleReply = useCallback(
    async (text: string) => {
      if (!guided) return { startSet: false as const };
      const result = await sendUserMessage(text);
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
  });

  voiceActiveRef.current = voice.active;

  const exitVoiceMode = voice.exit;
  const exitVoice = useCallback(() => {
    stopPlayback();
    exitVoiceMode();
  }, [stopPlayback, exitVoiceMode]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const showConsent = consentOk === false;
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
              <WorkspaceMenuButton />
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
  if (!thread && restoringSession) {
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
      <header className="workspace-header">
        <div className="workspace-header-row">
          <div className="workspace-header-lead">
            <WorkspaceMenuButton />
            <div className="min-w-0">
              <h1 className="workspace-title">{thread.title}</h1>
              <SessionDescription
                threadId={thread.id}
                description={thread.description}
              />
            </div>
          </div>
          <div className="workspace-header-trail">
            <BillingChargeHint />
            {guided ? (
              <SessionStatusBar
                phase={thread.phase}
                mode={sessionMode}
                suds={thread.suds}
                voc={thread.voc}
                target={thread.target}
              />
            ) : null}
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
          sound={bls.sound}
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
            setStopped={thread.lastSetOutcome === "stopped"}
            guideLanguage={thread.agentLanguage}
            agentTyping={agentTyping}
            userAvatarUrl={currentUser?.avatarUrl}
            userDisplayName={displayNameFor(currentUser)}
            onReply={(t) => void handleReply(t)}
            onPlayLine={(t) => void playLine(t)}
            onRepeatSet={repeatAllowed ? repeatSet : undefined}
            voiceAvailable={voice.available}
            voiceActive={voice.active}
            voicePhase={voice.phase}
            voiceInterim={voice.interim}
            voiceError={voice.error}
            onEnterVoice={voice.enter}
            onExitVoice={exitVoice}
            chromeId={guidedChatChromeId}
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
          />
        )}
      </div>

      {gearOpen && toolbarVisible && !running && (
        <GearPanel
          bls={bls}
          onChange={setBls}
          onClose={() => setGearOpen(false)}
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
