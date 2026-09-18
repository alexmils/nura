"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Maximize2, X } from "lucide-react";
import {
  FREE_SESSION_CHROMES,
  freeSessionChromeCssVars,
  type FreeSessionChrome,
} from "@/lib/free-session-chrome";
import "./free-session-chrome-picker.css";

type FreeSessionChromePickerProps = {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
};

function MiniPreview({
  chrome,
  large = false,
}: {
  chrome: FreeSessionChrome;
  large?: boolean;
}) {
  const vars = freeSessionChromeCssVars(chrome.theme) as CSSProperties;
  return (
    <div
      className={`fs-pick-preview${large ? " fs-pick-preview--large" : ""}`}
      style={vars}
      aria-hidden
    >
      <div className="fs-pick-header">
        <span className="fs-pick-header-title">Self-guided</span>
        <span className="fs-pick-header-hint">Calm paced sets</span>
      </div>
      <div className="fs-pick-canvas">
        <span className="fs-pick-idle">Press Space or click to start</span>
      </div>
      <div className="fs-pick-dock">
        <div className="fs-pick-bar">
          <div className="fs-pick-group">
            <span className="fs-pick-label">Speed</span>
            <div className="fs-pick-seg">
              <span className="fs-pick-chip is-on">1×</span>
              <span className="fs-pick-chip">2×</span>
            </div>
          </div>
          <div className="fs-pick-group">
            <span className="fs-pick-label">Repeats</span>
            <div className="fs-pick-seg">
              <span className="fs-pick-chip">24</span>
              <span className="fs-pick-chip is-on">36</span>
            </div>
          </div>
          <div className="fs-pick-group">
            <span className="fs-pick-label">Stereo</span>
            <div className="fs-pick-seg">
              <span className="fs-pick-chip is-on">On</span>
            </div>
          </div>
          <span className="fs-pick-gear" />
        </div>
      </div>
    </div>
  );
}

export function FreeSessionChromePicker({
  value,
  onChange,
  disabled = false,
}: FreeSessionChromePickerProps) {
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const lightbox = FREE_SESSION_CHROMES.find((c) => c.id === lightboxId) ?? null;

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
    <div className="fs-pick">
      <div
        className="fs-pick-grid"
        role="radiogroup"
        aria-label="Self-guided look"
      >
        {FREE_SESSION_CHROMES.map((chrome) => {
          const selected = chrome.id === value;
          return (
            <article
              key={chrome.id}
              className={`fs-pick-card${selected ? " is-selected" : ""}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                className="fs-pick-select"
                onClick={() => onChange(chrome.id)}
                aria-label={`${chrome.title}. ${chrome.note}`}
              >
                <span
                  className={`admin-voice-check${selected ? " is-on" : ""}`}
                  aria-hidden="true"
                />
                <span className="fs-pick-head">
                  <span className="fs-pick-num">{chrome.id}</span>
                  <span className="fs-pick-meta">
                    <span className="fs-pick-title">{chrome.title}</span>
                    <span className="fs-pick-note">{chrome.note}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="fs-pick-preview-hit"
                disabled={disabled}
                onClick={() => setLightboxId(chrome.id)}
                aria-label={`View ${chrome.title} larger`}
              >
                <MiniPreview chrome={chrome} />
                <span className="fs-pick-expand" aria-hidden="true">
                  <Maximize2 size={14} strokeWidth={2.25} />
                </span>
              </button>
            </article>
          );
        })}
      </div>

      {lightbox ? (
        <div
          className="admin-modal-backdrop fs-pick-lightbox-backdrop"
          role="presentation"
          onClick={() => setLightboxId(null)}
        >
          <div
            className="admin-modal fs-pick-lightbox"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fs-pick-lightbox-top">
              <div className="fs-pick-lightbox-meta">
                <h2 id={titleId} className="admin-panel-title">
                  {lightbox.id}. {lightbox.title}
                </h2>
                <p className="admin-panel-sub">{lightbox.note}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="fs-pick-lightbox-close"
                onClick={() => setLightboxId(null)}
                aria-label="Close preview"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="fs-pick-lightbox-stage">
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
