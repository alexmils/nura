"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AudioLines, Maximize2, Mic, Volume2, X } from "lucide-react";
import {
  GUIDED_CHAT_CHROMES,
  guidedChatChromeCssVars,
  type GuidedChatChrome,
} from "@/lib/guided-chat-chrome";
import "./guided-chat-chrome-picker.css";

type GuidedChatChromePickerProps = {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
};

function MiniPreview({
  chrome,
  large = false,
}: {
  chrome: GuidedChatChrome;
  large?: boolean;
}) {
  const vars = guidedChatChromeCssVars(chrome.theme) as CSSProperties;
  return (
    <div
      className={`gc-pick-preview${large ? " gc-pick-preview--large" : ""}`}
      style={vars}
      aria-hidden
    >
      <div className="gc-pick-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={chrome.avatar}
          alt=""
          width={large ? 40 : 28}
          height={large ? 40 : 28}
          className="gc-pick-avatar"
        />
        <div className="gc-pick-bubble gc-pick-bubble--agent">
          <span>Welcome — what would you like to work on?</span>
          <Volume2
            size={large ? 20 : 12}
            strokeWidth={2}
            className="gc-pick-speak"
          />
        </div>
      </div>
      <div className="gc-pick-row gc-pick-row--user">
        <div className="gc-pick-bubble gc-pick-bubble--user">
          <span>Not sure yet</span>
        </div>
        <span className="gc-pick-user-av">4</span>
      </div>
      <div className="gc-pick-chips">
        <span>Anxiety</span>
        <span>Stress</span>
      </div>
      <div className="gc-pick-composer">
        <Mic size={large ? 22 : 14} strokeWidth={2} className="gc-pick-mic" />
        <span className="gc-pick-ph">Type here…</span>
        <span className="gc-pick-voice">
          <AudioLines size={large ? 22 : 14} strokeWidth={2.25} />
        </span>
      </div>
    </div>
  );
}

export function GuidedChatChromePicker({
  value,
  onChange,
  disabled = false,
}: GuidedChatChromePickerProps) {
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const lightbox = GUIDED_CHAT_CHROMES.find((c) => c.id === lightboxId) ?? null;

  useEffect(() => {
    if (lightboxId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxId(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightboxId]);

  return (
    <div className="gc-pick">
      <div
        className="gc-pick-grid"
        role="radiogroup"
        aria-label="Guided chat look"
      >
        {GUIDED_CHAT_CHROMES.map((chrome) => {
          const selected = chrome.id === value;
          return (
            <article
              key={chrome.id}
              className={`gc-pick-card${selected ? " is-selected" : ""}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                className="gc-pick-select"
                onClick={() => onChange(chrome.id)}
                aria-label={`${chrome.title}. ${chrome.note}`}
              >
                <span
                  className={`admin-voice-check${selected ? " is-on" : ""}`}
                  aria-hidden="true"
                />
                <span className="gc-pick-head">
                  <span className="gc-pick-num">{chrome.id}</span>
                  <span className="gc-pick-meta">
                    <span className="gc-pick-title">{chrome.title}</span>
                    <span className="gc-pick-note">{chrome.note}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="gc-pick-preview-hit"
                disabled={disabled}
                onClick={() => setLightboxId(chrome.id)}
                aria-label={`View ${chrome.title} larger`}
              >
                <MiniPreview chrome={chrome} />
                <span className="gc-pick-expand" aria-hidden="true">
                  <Maximize2 size={14} strokeWidth={2.25} />
                </span>
              </button>
            </article>
          );
        })}
      </div>

      {lightbox ? (
        <div
          className="admin-modal-backdrop gc-pick-lightbox-backdrop"
          role="presentation"
          onClick={() => setLightboxId(null)}
        >
          <div
            className="admin-modal gc-pick-lightbox"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gc-pick-lightbox-top">
              <div className="gc-pick-lightbox-meta">
                <h2 id={titleId} className="admin-panel-title">
                  {lightbox.id}. {lightbox.title}
                </h2>
                <p className="admin-panel-sub">{lightbox.note}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="gc-pick-lightbox-close"
                onClick={() => setLightboxId(null)}
                aria-label="Close preview"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="gc-pick-lightbox-stage">
              <MiniPreview chrome={lightbox} large />
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setLightboxId(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={() => {
                  onChange(lightbox.id);
                  setLightboxId(null);
                }}
              >
                Use this look
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
