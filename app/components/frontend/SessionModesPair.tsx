"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  SESSION_MODE_GUIDED_LABEL,
  SESSION_MODE_SELF_LABEL,
} from "@/lib/brand";
import { LetterRevealHeading } from "./LetterRevealHeading";
import "./session-modes-pair.css";

type ModeId = "guided" | "free";

type ModeSlide = {
  id: ModeId;
  label: string;
  videoSrc: string;
  poster: string;
};

const MODES: ModeSlide[] = [
  {
    id: "guided",
    label: SESSION_MODE_GUIDED_LABEL,
    videoSrc: "/marketing/knowledge/stock-a.mp4",
    poster: "/marketing/landing/support-talk.jpg",
  },
  {
    id: "free",
    label: SESSION_MODE_SELF_LABEL,
    videoSrc: "/marketing/knowledge/stock-c.mp4",
    poster: "/marketing/landing/practice-space.jpg",
  },
];

export function SessionModesPair() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState<ModeId>("guided");
  const [playing, setPlaying] = useState(false);
  const slide = MODES.find((m) => m.id === active) ?? MODES[0];

  const selectMode = useCallback((id: ModeId) => {
    setPlaying(false);
    setActive(id);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    void el.play().then(
      () => setPlaying(true),
      () => setPlaying(false)
    );
  }, [slide.id]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.muted = true;
      void el.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <section className="fe-modes" aria-labelledby="fe-modes-title">
      <div className="fe-container fe-modes-frame">
        <LetterRevealHeading id="fe-modes-title" className="fe-modes-title">
          One app, two seamless experiences.
        </LetterRevealHeading>
        <div className="fe-modes-board fe-animate">
          <div className="fe-modes-tabs" role="tablist" aria-label="Session modes">
            {MODES.map((mode) => {
              const selected = mode.id === active;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  id={`fe-modes-tab-${mode.id}`}
                  aria-selected={selected}
                  aria-controls={`fe-modes-panel-${mode.id}`}
                  tabIndex={selected ? 0 : -1}
                  className={
                    selected ? "fe-modes-tab is-active" : "fe-modes-tab"
                  }
                  onClick={() => selectMode(mode.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                      return;
                    }
                    event.preventDefault();
                    const next =
                      event.key === "ArrowRight"
                        ? MODES[(MODES.findIndex((m) => m.id === active) + 1) % MODES.length]
                        : MODES[
                            (MODES.findIndex((m) => m.id === active) + MODES.length - 1) %
                              MODES.length
                          ];
                    selectMode(next.id);
                    requestAnimationFrame(() => {
                      document.getElementById(`fe-modes-tab-${next.id}`)?.focus();
                    });
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <div
            className={`fe-modes-stage${playing ? " is-playing" : ""}`}
            role="tabpanel"
            id={`fe-modes-panel-${slide.id}`}
            aria-labelledby={`fe-modes-tab-${slide.id}`}
          >
            <video
              key={slide.id}
              ref={videoRef}
              className="fe-modes-video"
              src={slide.videoSrc}
              poster={slide.poster}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            <button
              type="button"
              className={`fe-modes-play${playing ? " is-playing" : ""}`}
              onClick={togglePlay}
              aria-label={playing ? "Pause video" : "Play video"}
            >
              {playing ? (
                <Pause size={28} strokeWidth={1.5} aria-hidden />
              ) : (
                <Play size={28} fill="currentColor" strokeWidth={0} aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
