"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUp, AudioLines, Mic, Volume2, X } from "lucide-react";
import type { Message, ProtocolPhase, ThreadPhaseChange } from "@/lib/types";
import type { SessionMode } from "@/lib/protocol";
import { checkInQuickReplies, showsSessionQuickReplies } from "@/lib/session-labels";import {
  isBrowserSpeechSupported,
  startBrowserSpeech,
  type BrowserSpeechSession,
} from "@/lib/browser-speech";
import {
  COMPOSER_STRINGS,
  dictationErrorMessage,
  dictationPlaceholder,
  dictationSpeechLang,
  type DictationState,
} from "@/lib/dictation";
import { Avatar } from "./Avatar";
import type { VoicePhase } from "./useGuidedVoiceMode";
import { VoiceStage, voiceStageState } from "./voice/VoiceStage";
import { VoiceDockBeam } from "./voice/VoiceDockBeam";
import { ThinkingIndicator } from "./agent/ThinkingIndicator";
import { PhaseBadge } from "./agent/PhaseBadge";
import { usePhaseTimeline } from "./agent/usePhaseTimeline";
import { useRotatingWelcome } from "./useRotatingWelcome";
import { composerPlaceholder } from "@/lib/session-placeholders";
import {
  DEFAULT_GUIDED_CHAT_CHROME_ID,
  guidedChatChromeCssVars,
  resolveGuidedChatChrome,
} from "@/lib/guided-chat-chrome";

interface AgentOverlayProps {
  messages: Message[];
  hidden: boolean;
  autoVoice: boolean;
  sessionMode: SessionMode;
  phase: ProtocolPhase;
  /** Server-recorded phase changes for the transcript phase badges. */
  phaseChanges?: ThreadPhaseChange[];
  /** True when the last set was cut short, so nothing was processed. */
  setStopped?: boolean;
  /** True while the guide is composing a reply. */
  agentTyping?: boolean;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
  /** `immediate`: quick replies skip the "wait for them to finish" window. */
  onReply: (text: string, opts?: { immediate?: boolean }) => void;
  onPlayLine: (text: string) => void;
  onRepeatSet?: () => void;
  voiceAvailable?: boolean;
  voiceActive?: boolean;
  voicePhase?: VoicePhase;
  voiceInterim?: string;
  voiceError?: string | null;
  /** Mic engine stopped while voice mode is on. */
  voiceStalled?: boolean;
  onEnterVoice?: () => void;
  onExitVoice?: () => void;
  onResumeVoice?: () => void;
  /** Mic requested but not live yet. */
  voiceStarting?: boolean;
  voiceMuted?: boolean;
  onToggleMuteVoice?: () => void;
  /** Stop the guide's reply (tap the orb while it speaks). */
  onInterruptVoice?: () => void;
  getVoiceInputLevel?: () => number;
  getVoiceOutputLevel?: () => number;
  /** Platform chrome theme id (1–20). */
  chromeId?: number;
  /** Language the guide answers in; the composer hint follows it. */
  guideLanguage?: string | null;
  /** Set availability line / manual Start set (chat and Voice Mode). */
  setReady?: ReactNode;
  /**
   * End-of-session summary card. In the chat thread it is the last item inside
   * the message scroll list (one scroll for messages + summary), full column
   * width like the composer.
   */
  closureCard?: ReactNode;
  /**
   * Session is closed (summary card shown): the composer is disabled and
   * greyed out, dictation / voice mode are off, nothing can be sent.
   */
  sessionClosed?: boolean;
}

const zeroLevel = () => 0;

function voiceStatusLabel(phase: VoicePhase, stalled = false, starting = false, muted = false): string {
  if (stalled) return "Mic paused";
  if (starting) return "Starting the mic\u2026";
  if (muted) return "Muted";
  switch (phase) {
    case "listening":
      return "Listening…";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking…";
    case "bls":
      return "Follow the ball";
    default:
      return "Voice";
  }
}

export function AgentOverlay({
  messages,
  hidden,
  autoVoice,
  sessionMode,
  phase,
  phaseChanges,
  setStopped = false,
  agentTyping = false,
  userAvatarUrl,
  userDisplayName = "You",
  onReply,
  onPlayLine,
  onRepeatSet,
  voiceAvailable = false,
  voiceActive = false,
  voicePhase = "off",
  voiceInterim = "",
  voiceError = null,
  voiceStalled = false,
  onEnterVoice,
  onExitVoice,
  onResumeVoice,
  voiceStarting = false,
  voiceMuted = false,
  onToggleMuteVoice,
  onInterruptVoice,
  getVoiceInputLevel,
  getVoiceOutputLevel,
  chromeId = DEFAULT_GUIDED_CHAT_CHROME_ID,
  guideLanguage = null,
  setReady = null,
  closureCard = null,
  sessionClosed = false,
}: AgentOverlayProps) {
  const chrome = resolveGuidedChatChrome(chromeId);
  const chromeVars = guidedChatChromeCssVars(chrome.theme);
  const guideAvatar = chrome.avatar;
  const [reply, setReply] = useState("");
  const [rollKey, setRollKey] = useState(0);
  /** off -> starting (mic asked) -> listening (engine open). */
  const [dictationState, setDictationState] = useState<DictationState>("off");
  /** Speech detected or a transcript arrived in this dictation run. */
  const [dictationHeard, setDictationHeard] = useState(false);
  const dictating = dictationState !== "off";
  /** Feature-detected after mount so server and client render the same tree. */
  const [speechSupported, setSpeechSupported] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  /** Keep voice chrome mounted while exit fade runs. */
  const [voiceExiting, setVoiceExiting] = useState(false);
  const [composerEnterKey, setComposerEnterKey] = useState(0);
  const wasVoiceActive = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dictationRef = useRef<BrowserSpeechSession | null>(null);
  const dictationBaseRef = useRef("");
  const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
  const phaseBadges = usePhaseTimeline(messages, phase, phaseChanges);
  const hasClosureCard = closureCard != null;
  const prevId = useRef<string | null>(null);
  const checkIn = sessionMode === "check_in";
  const intake = phase === "intake";
  /**
   * Composer hint follows the language the guide answers in, so the person is
   * invited to write in their own language. Falls back to English until the
   * session language is known.
   */
  const composerPlaceholderText = composerPlaceholder({
    phase,
    checkIn,
    language: guideLanguage,
    setStopped,
  });
  /** Chat bubbles only after the user has replied once; open session = centered prompt. */
  const conversationStarted = messages.some((m) => m.role === "user");
  // Topic starters only before the first user message; set-rating chips stay
  // available during check-in (see showsSessionQuickReplies).
  const quickReplies = showsSessionQuickReplies({
    sessionMode,
    phase,
    conversationStarted,
  })
    ? checkInQuickReplies(phase, { setStopped })
    : [];
  const canSend = !sessionClosed && reply.trim().length > 0;
  /** Placeholder: closed > dictation state > phase hint. English UI. */
  const composerHint = sessionClosed
    ? COMPOSER_STRINGS.sessionClosed
    : (dictationPlaceholder(dictationState, dictationHeard) ?? composerPlaceholderText);
  const userInitial = userDisplayName.trim().charAt(0) || "U";
  const showDictationMic = speechSupported;
  const showVoiceMode = Boolean(voiceAvailable && onEnterVoice);
  const voiceChrome = voiceActive || voiceExiting;
  /**
   * The guide is composing a reply: typed sessions use agentTyping, voice text
   * mode (landscape) uses the voice phase. Drives the ThinkingIndicator row.
   */
  const showThinking = voiceChrome
    ? voiceActive && !voiceExiting && !voiceStalled && voicePhase === "thinking"
    : agentTyping;
  const voiceThinkingLabel =
    voiceActive && !voiceExiting && !voiceStalled && !voiceStarting && !voiceMuted && voicePhase === "thinking";
  /** Opening line only: cycles languages until the person writes. */
  const welcome = useRotatingWelcome({
    text: lastAgent?.content ?? "",
    enabled: !conversationStarted && !voiceChrome,
    draft: reply,
  });

  useEffect(() => {
    if (voiceActive) {
      wasVoiceActive.current = true;
      setVoiceExiting(false);
      return;
    }
    if (!wasVoiceActive.current) return;
    wasVoiceActive.current = false;
    setVoiceExiting(true);
    const id = window.setTimeout(() => {
      setVoiceExiting(false);
      setComposerEnterKey((k) => k + 1);
    }, 480);
    return () => window.clearTimeout(id);
  }, [voiceActive]);

  /**
   * Stop dictation. `commit` keeps words the engine heard but had not marked
   * final yet (user tapped stop); submit / unmount / voice mode just drop the
   * engine, the input already shows everything heard.
   */
  const stopDictation = (commit = false) => {
    const session = dictationRef.current;
    dictationRef.current = null;
    if (commit) session?.stop();
    else session?.abort();
    setDictationState("off");
    setDictationHeard(false);
  };

  const toggleDictation = () => {
    if (dictating) {
      stopDictation(true);
      return;
    }
    if (sessionClosed) return;
    setDictationError(null);
    setDictationHeard(false);
    dictationBaseRef.current = reply.trim();
    let session: BrowserSpeechSession | null = null;
    const isCurrent = () => session != null && dictationRef.current === session;
    session = startBrowserSpeech(
      {
        onInterim: (t) => {
          if (!isCurrent()) return;
          setDictationHeard(true);
          const base = dictationBaseRef.current;
          setReply(base ? `${base} ${t}`.trim() : t);
        },
        onFinal: (chunk) => {
          if (!isCurrent() && dictationRef.current !== null) return;
          setDictationHeard(true);
          dictationBaseRef.current =
            `${dictationBaseRef.current} ${chunk}`.trim();
          setReply(dictationBaseRef.current);
        },
        onSpeechStart: () => {
          if (isCurrent()) setDictationHeard(true);
        },
        onStatus: (status) => {
          if (!isCurrent()) return;
          if (status === "listening") setDictationState("listening");
        },
        onError: (code) => {
          if (code === "aborted" || code === "no-speech") return;
          setDictationError(dictationErrorMessage(code));
          stopDictation();
        },
        onEnd: () => {
          if (isCurrent()) stopDictation();
        },
      },
      {
        lang: dictationSpeechLang(
          guideLanguage,
          typeof navigator !== "undefined" ? navigator.language : null
        ),
        // Dictation is a tap-to-talk helper: a dead speech service should say
        // so at once instead of retrying quietly for ~10 s.
        networkIsFatal: true,
      }
    );
    if (!session) {
      setDictationError(dictationErrorMessage("unsupported"));
      return;
    }
    dictationRef.current = session;
    setDictationState("starting");
  };

  useEffect(() => {
    if (voiceActive) stopDictation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering voice mode
  }, [voiceActive]);

  useEffect(() => () => stopDictation(), []);

  useEffect(() => {
    setSpeechSupported(isBrowserSpeechSupported());
  }, []);

  // Session closed: drop the mic and any half-typed draft right away.
  useEffect(() => {
    if (!sessionClosed) return;
    stopDictation();
    setReply("");
    setDictationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the session closes
  }, [sessionClosed]);

  // Session closed while Voice Mode is open: leave it once the guide has
  // finished its last line (do not cut the closing words off mid-sentence).
  useEffect(() => {
    if (!sessionClosed || !voiceActive) return;
    if (voicePhase === "speaking" || voicePhase === "thinking") return;
    onExitVoice?.();
  }, [sessionClosed, voiceActive, voicePhase, onExitVoice]);

  useEffect(() => {
    if (lastAgent && lastAgent.id !== prevId.current) {
      prevId.current = lastAgent.id;
      setRollKey((k) => k + 1);
      if (autoVoice && !hidden && !voiceActive) onPlayLine(lastAgent.content);
    }
  }, [lastAgent, autoVoice, hidden, onPlayLine, voiceActive]);

  useEffect(() => {
    if ((checkIn || intake) && !hidden && !voiceActive) {
      inputRef.current?.focus();
    }
  }, [checkIn, intake, hidden, lastAgent?.id, voiceActive]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, hidden, conversationStarted, voiceInterim, agentTyping, showThinking, hasClosureCard]);

  if (hidden) return null;

  // Desktop, tablets, portrait phones: full-screen orb stage only (it covers
  // the dock). Phone held sideways: VoiceStage shows just the bottom glow and
  // the dock + messages below are the text mode. Same session either way.
  const voiceStage = voiceChrome ? (
    <VoiceStage
      phase={voicePhase}
      starting={voiceStarting}
      stalled={voiceStalled}
      muted={voiceMuted}
      exiting={voiceExiting}
      error={voiceError}
      getInputLevel={getVoiceInputLevel ?? zeroLevel}
      getOutputLevel={getVoiceOutputLevel ?? zeroLevel}
      onEnd={() => onExitVoice?.()}
      onToggleMute={() => onToggleMuteVoice?.()}
      onResume={onResumeVoice}
      onInterrupt={onInterruptVoice}
    />
  ) : null;

  const voiceDock = voiceChrome ? (
    <div
      className={`agent-voice-dock${voiceExiting ? " agent-voice-dock--exit" : " agent-voice-dock--enter"}`}
    >
      {/* Phone landscape only: voice-glow beam along the pill's bottom edge. */}
      <VoiceDockBeam
        state={voiceStageState(voicePhase, { starting: voiceStarting, stalled: voiceStalled, muted: voiceMuted })}
        exiting={voiceExiting}
        getInputLevel={getVoiceInputLevel ?? zeroLevel}
        getOutputLevel={getVoiceOutputLevel ?? zeroLevel}
      >
      <div className="agent-voice-bar" role="status" aria-live="polite">
        <div
          className={`agent-voice-orb agent-voice-orb--${
            voiceExiting || voiceStalled ? "off" : voicePhase
          }`}
          aria-hidden
        />
        <div className="agent-voice-meta">
          <p className="agent-voice-status">
            {voiceExiting ? (
              "Ending…"
            ) : voiceThinkingLabel ? (
              <ThinkingIndicator
                showDot={false}
                announce={false}
                className="agent-voice-thinking"
              />
            ) : (
              voiceStatusLabel(voicePhase, voiceStalled, voiceStarting, voiceMuted)
            )}
          </p>
          {!voiceExiting && !voiceStalled && voiceInterim ? (
            <p className="agent-voice-interim">{voiceInterim}</p>
          ) : null}
          {!voiceExiting && voiceError ? (
            <p className="agent-voice-error">{voiceError}</p>
          ) : null}
        </div>
        {!voiceExiting && voiceStalled && onResumeVoice ? (
          <button
            type="button"
            className="agent-voice-resume"
            onClick={onResumeVoice}
          >
            <span>Resume</span>
          </button>
        ) : null}
        <button
          type="button"
          className="agent-voice-end"
          onClick={onExitVoice}
          aria-label="End voice"
          disabled={voiceExiting}
        >
          <X size={16} strokeWidth={2.25} />
          <span>End voice</span>
        </button>
      </div>
      </VoiceDockBeam>
    </div>
  ) : null;

  const composer = voiceChrome ? (
    voiceDock
  ) : (
    <div
      key={composerEnterKey}
      className={`agent-composer-wrap agent-composer-wrap--enter ${!conversationStarted ? "agent-fade-up agent-fade-up--late" : ""}`}
    >
      <form
        className={`agent-composer${showDictationMic ? " agent-composer--with-mic" : ""}${sessionClosed ? " agent-composer--closed" : ""}`}
        data-guide="composer"
        aria-disabled={sessionClosed || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend || sessionClosed) return;
          stopDictation();
          onReply(reply.trim());
          setReply("");
        }}
      >
        {showDictationMic ? (
          <button
            type="button"
            className={`agent-composer-mic${dictating ? " is-listening" : ""}${dictationState === "starting" ? " is-starting" : ""}`}
            onClick={toggleDictation}
            disabled={sessionClosed}
            aria-label={dictating ? COMPOSER_STRINGS.stopDictation : COMPOSER_STRINGS.dictate}
            aria-pressed={dictating}
            title={dictating ? COMPOSER_STRINGS.stopDictation : COMPOSER_STRINGS.dictate}
          >
            <Mic size={22} strokeWidth={2.25} />
          </button>
        ) : null}
        <input
          ref={inputRef}
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
            // Typing while dictating: keep the edit as the new base so the
            // next words are appended to it, not written over it.
            if (dictating) dictationBaseRef.current = e.target.value.trim();
          }}
          placeholder={composerHint}
          className="agent-composer-input"
          aria-label={composerHint}
          disabled={sessionClosed}
        />
        {canSend ? (
          <button
            type="submit"
            className="agent-composer-send"
            aria-label="Send"
          >
            <ArrowUp size={22} strokeWidth={2.25} />
          </button>
        ) : showVoiceMode ? (
          <button
            type="button"
            className="agent-composer-voice-mode"
            data-guide="voice-mode"
            disabled={sessionClosed}
            onClick={() => {
              stopDictation();
              onEnterVoice?.();
            }}
            aria-label="Start voice"
            title="Start voice"
          >
            <AudioLines size={22} strokeWidth={2.25} />
          </button>
        ) : null}
      </form>
      <span className="sr-only" role="status" aria-live="polite">
        {dictating
          ? dictationHeard
            ? COMPOSER_STRINGS.listening
            : COMPOSER_STRINGS.startTalking
          : ""}
      </span>
      {dictationError ? (
        <p className="agent-composer-hint" role="status">
          {dictationError}
        </p>
      ) : null}
    </div>
  );

  const quickReplyRow =
    !voiceChrome && !sessionClosed && quickReplies.length > 0 ? (
      <div
        className={`agent-quick-replies ${!conversationStarted ? "agent-fade-up agent-fade-up--late" : ""}`}
        role="group"
        aria-label="Quick replies"
      >
        {quickReplies.map((q) => (
          <button
            key={q.label}
            type="button"
            className="agent-quick-reply"
            onClick={() => {
              if (q.value.endsWith(" ")) {
                setReply(q.value);
                inputRef.current?.focus();
                return;
              }
              onReply(q.value, { immediate: true });
            }}
          >
            {q.label}
          </button>
        ))}
      </div>
    ) : null;

  const checkInBanner = checkIn ? (
    <div className="agent-checkin-banner-row agent-fade-up">
      <p className="agent-checkin-banner">
        Set complete. Share what you notice, or repeat if you missed it.
      </p>
      {onRepeatSet && !voiceChrome && (
        <button
          type="button"
          className="agent-repeat-set"
          onClick={onRepeatSet}
        >
          Repeat set
        </button>
      )}
    </div>
  ) : null;

  if (!conversationStarted) {
    return (
      <div
        className={`agent-overlay agent-overlay--prompt agent-overlay--chrome ${checkIn ? "agent-overlay--check-in" : ""} ${intake ? "agent-overlay--intake" : ""} ${voiceChrome ? "agent-overlay--voice" : ""} ${voiceExiting ? "agent-overlay--voice-exit" : ""}`}
        style={chromeVars as CSSProperties}
      >
        <div className="agent-overlay-inner">
          {checkInBanner}
          <div className="agent-overlay-body">
            {lastAgent ? (
              <div key={rollKey} className="agent-overlay-line agent-fade-up">
                {welcome.swap ? (
                  <p className="agent-overlay-text welcome-rotate-text">
                    <span key={welcome.key} className="welcome-rotate-swap">
                      {welcome.line}
                    </span>
                  </p>
                ) : (
                  <p className="agent-overlay-text">{lastAgent.content}</p>
                )}
                {!voiceChrome && (
                  <button
                    type="button"
                    onClick={() =>
                      onPlayLine(welcome.swap ? welcome.line : lastAgent.content)
                    }
                    className="btn-icon-sm agent-overlay-speak"
                    aria-label="Play message"
                  >
                    <Volume2 size={18} strokeWidth={2} />
                  </button>
                )}
              </div>
            ) : showThinking ? (
              <div className="agent-overlay-line agent-overlay-line--thinking">
                <ThinkingIndicator />
              </div>
            ) : null}
          </div>
          {closureCard}
          {setReady}
          {quickReplyRow}
          {composer}
          {voiceStage}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`agent-overlay agent-overlay--thread agent-overlay--chrome ${checkIn ? "agent-overlay--check-in" : ""} ${voiceChrome ? "agent-overlay--voice" : ""} ${voiceExiting ? "agent-overlay--voice-exit" : ""}`}
      style={chromeVars as CSSProperties}
    >
      <div className="agent-overlay-inner">
        {checkInBanner}

        <div ref={listRef} className="agent-chat-messages">
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <Fragment key={m.id}>
              {phaseBadges.before.get(i)?.map((p) => (
                <PhaseBadge key={`phase-${p}-${m.id}`} phase={p} />
              ))}
              <div
                className={`agent-chat-row ${isUser ? "agent-chat-row--user" : "agent-chat-row--agent"}`}
              >
                {!isUser && (
                  <Avatar
                    src={guideAvatar}
                    alt="Nura"
                    fallback="N"
                    className="avatar-sm avatar-guide"
                  />
                )}
                <div
                  className={`agent-chat-bubble ${isUser ? "agent-chat-bubble--user" : "agent-chat-bubble--agent"}`}
                >
                  <p className="agent-chat-text">{m.content}</p>
                  {!isUser && !voiceChrome && (
                    <button
                      type="button"
                      onClick={() => onPlayLine(m.content)}
                      className="btn-icon-sm agent-chat-voice"
                      aria-label="Play message"
                    >
                      <Volume2 size={17} strokeWidth={2} />
                    </button>
                  )}
                </div>
                {isUser && (
                  <Avatar
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    fallback={userInitial}
                    className="avatar-sm"
                  />
                )}
              </div>
              </Fragment>
            );
          })}
          {phaseBadges.end.map((p) => (
            <PhaseBadge key={`phase-${p}-end`} phase={p} />
          ))}
          {showThinking ? (
            <div className="agent-chat-row agent-chat-row--agent agent-chat-row--thinking">
              <Avatar
                src={guideAvatar}
                alt="Nura"
                fallback="N"
                className="avatar-sm avatar-guide"
              />
              <div className="agent-chat-thinking">
                <ThinkingIndicator />
              </div>
            </div>
          ) : null}
          {hasClosureCard ? (
            <div className="agent-chat-closure">{closureCard}</div>
          ) : null}
        </div>

        {setReady}
        {quickReplyRow}
        {composer}
        {voiceStage}
      </div>
    </div>
  );
}
