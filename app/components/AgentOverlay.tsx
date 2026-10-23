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
import { Avatar } from "./Avatar";
import type { VoicePhase } from "./useGuidedVoiceMode";
import { VoiceWave } from "./VoiceWave";
import { VoiceStage } from "./voice/VoiceStage";
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
  onReply: (text: string) => void;
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
  /** End-of-session summary card, shown above the composer after closure. */
  closureCard?: ReactNode;
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
}: AgentOverlayProps) {
  const chrome = resolveGuidedChatChrome(chromeId);
  const chromeVars = guidedChatChromeCssVars(chrome.theme);
  const guideAvatar = chrome.avatar;
  const [reply, setReply] = useState("");
  const [rollKey, setRollKey] = useState(0);
  const [dictating, setDictating] = useState(false);
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
  const canSend = reply.trim().length > 0;
  const userInitial = userDisplayName.trim().charAt(0) || "U";
  const showDictationMic = isBrowserSpeechSupported();
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

  const stopDictation = () => {
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
  };

  const toggleDictation = () => {
    if (dictating) {
      stopDictation();
      return;
    }
    setDictationError(null);
    dictationBaseRef.current = reply.trim();
    const session = startBrowserSpeech({
      onInterim: (t) => {
        const base = dictationBaseRef.current;
        setReply(base ? `${base} ${t}`.trim() : t);
      },
      onFinal: (chunk) => {
        dictationBaseRef.current =
          `${dictationBaseRef.current} ${chunk}`.trim();
        setReply(dictationBaseRef.current);
      },
      onError: (code, message) => {
        if (code === "aborted" || code === "no-speech") return;
        setDictationError(message);
        stopDictation();
      },
    });
    if (!session) {
      setDictationError(
        "Voice isn’t supported in this browser. Try Chrome or Edge."
      );
      return;
    }
    dictationRef.current = session;
    setDictating(true);
  };

  useEffect(() => {
    if (voiceActive) stopDictation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering voice mode
  }, [voiceActive]);

  useEffect(() => () => stopDictation(), []);

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
  }, [messages.length, hidden, conversationStarted, voiceInterim, agentTyping, showThinking]);

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
      <VoiceWave
        active={voiceChrome}
        phase={voiceExiting || voiceStalled ? "off" : voicePhase}
        fadingOut={voiceExiting}
      />
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
        className={`agent-composer${showDictationMic ? " agent-composer--with-mic" : ""}`}
        data-guide="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend) return;
          stopDictation();
          onReply(reply.trim());
          setReply("");
        }}
      >
        {showDictationMic ? (
          <button
            type="button"
            className={`agent-composer-mic${dictating ? " is-listening" : ""}`}
            onClick={toggleDictation}
            aria-label={dictating ? "Stop dictation" : "Dictate"}
            aria-pressed={dictating}
            title={dictating ? "Stop dictation" : "Dictate"}
          >
            <Mic size={22} strokeWidth={2.25} />
          </button>
        ) : null}
        <input
          ref={inputRef}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={composerPlaceholderText}
          className="agent-composer-input"
          aria-label={composerPlaceholderText}
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
      {dictationError ? (
        <p className="agent-composer-hint" role="status">
          {dictationError}
        </p>
      ) : null}
    </div>
  );

  const quickReplyRow =
    !voiceChrome && quickReplies.length > 0 ? (
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
              onReply(q.value);
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
