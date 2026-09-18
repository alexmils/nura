"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUp, AudioLines, Mic, Volume2, X } from "lucide-react";
import type { Message, ProtocolPhase } from "@/lib/types";
import type { SessionMode } from "@/lib/protocol";
import { checkInQuickReplies, showsSessionQuickReplies } from "@/lib/session-labels";import {
  isBrowserSpeechSupported,
  startBrowserSpeech,
  type BrowserSpeechSession,
} from "@/lib/browser-speech";
import { Avatar } from "./Avatar";
import type { VoicePhase } from "./useGuidedVoiceMode";
import { VoiceWave } from "./VoiceWave";
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
  onEnterVoice?: () => void;
  onExitVoice?: () => void;
  /** Platform chrome theme id (1–20). */
  chromeId?: number;
  /** Language the guide answers in; the composer hint follows it. */
  guideLanguage?: string | null;
}

/** Three dots that rise in sequence while the guide is writing. */
function TypingIndicator({ className = "" }: { className?: string }) {
  return (
    <span
      className={`agent-typing${className ? ` ${className}` : ""}`}
      role="status"
      aria-label="Nura is writing"
    >
      <span className="agent-typing-dot" aria-hidden="true" />
      <span className="agent-typing-dot" aria-hidden="true" />
      <span className="agent-typing-dot" aria-hidden="true" />
    </span>
  );
}

function voiceStatusLabel(phase: VoicePhase): string {
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
  onEnterVoice,
  onExitVoice,
  chromeId = DEFAULT_GUIDED_CHAT_CHROME_ID,
  guideLanguage = null,
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
  }, [messages.length, hidden, conversationStarted, voiceInterim, agentTyping]);

  if (hidden) return null;

  const voiceDock = voiceChrome ? (
    <div
      className={`agent-voice-dock${voiceExiting ? " agent-voice-dock--exit" : " agent-voice-dock--enter"}`}
    >
      <VoiceWave
        active={voiceChrome}
        phase={voiceExiting ? "off" : voicePhase}
        fadingOut={voiceExiting}
      />
      <div className="agent-voice-bar" role="status" aria-live="polite">
        <div
          className={`agent-voice-orb agent-voice-orb--${voiceExiting ? "off" : voicePhase}`}
          aria-hidden
        />
        <div className="agent-voice-meta">
          <p className="agent-voice-status">
            {voiceExiting ? "Ending…" : voiceStatusLabel(voicePhase)}
          </p>
          {!voiceExiting && voiceInterim ? (
            <p className="agent-voice-interim">{voiceInterim}</p>
          ) : null}
          {!voiceExiting && voiceError ? (
            <p className="agent-voice-error">{voiceError}</p>
          ) : null}
        </div>
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
            ) : agentTyping && !voiceChrome ? (
              <div className="agent-overlay-line">
                <TypingIndicator className="agent-typing--prompt" />
              </div>
            ) : null}
          </div>
          {quickReplyRow}
          {composer}
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
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
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
            );
          })}
          {agentTyping && !voiceChrome ? (
            <div className="agent-chat-row agent-chat-row--agent">
              <Avatar
                src={guideAvatar}
                alt="Nura"
                fallback="N"
                className="avatar-sm avatar-guide"
              />
              <div className="agent-chat-bubble agent-chat-bubble--agent agent-chat-bubble--typing">
                <TypingIndicator />
              </div>
            </div>
          ) : null}
        </div>

        {quickReplyRow}
        {composer}
      </div>
    </div>
  );
}
