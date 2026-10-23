"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { mediaNames, sectionText } from "@/lib/marketing-sections";
import { SectionMedia } from "./SectionMedia";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./session-modes-pair.css";

type ModeId = "guided" | "free";

type ModeSlide = {
  id: ModeId;
  label: string;
  kind: string;
  image: string;
  video: string;
  poster: string;
  alt: string;
};

const MODES: { id: ModeId; prefix: "guidedMedia" | "selfMedia" }[] = [
  { id: "guided", prefix: "guidedMedia" },
  { id: "free", prefix: "selfMedia" },
];

export function SessionModesPair() {
  const copy = useSectionConfig("home-modes");
  const modes: ModeSlide[] = MODES.map((mode) => {
    const names = mediaNames(mode.prefix);
    return {
      id: mode.id,
      label: mode.id === "guided" ? sectionText(copy, "guided") : sectionText(copy, "self"),
      kind: sectionText(copy, names.kind),
      image: sectionText(copy, names.image),
      video: sectionText(copy, names.video),
      poster: sectionText(copy, names.poster),
      alt: sectionText(copy, names.alt),
    };
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState<ModeId>("guided");
  const [playing, setPlaying] = useState(false);
  const slide = modes.find((m) => m.id === active) ?? modes[0];

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
    <section className="fe-modes fe-has-edit" data-section="home-modes" aria-labelledby="fe-modes-title">
      <SectionEdit id="home-modes" />
      <div className="fe-container fe-modes-frame">
        <LetterRevealHeading id="fe-modes-title" className="fe-modes-title">
          {sectionText(copy, "title")}
        </LetterRevealHeading>
        <div className="fe-modes-board fe-animate">
          <div className="fe-modes-tabs" role="tablist" aria-label="Session modes">
            {modes.map((mode) => {
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
                        ? modes[(modes.findIndex((m) => m.id === active) + 1) % modes.length]
                        : modes[
                            (modes.findIndex((m) => m.id === active) + modes.length - 1) %
                              modes.length
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
            {slide.kind === "none" ? null : slide.kind === "video" && slide.video && /youtube|youtu\.be|vimeo/i.test(slide.video) ? (
              <SectionMedia
                key={slide.id}
                className="fe-modes-video"
                kind="video"
                image={slide.image}
                video={slide.video}
                poster={slide.poster}
                alt={slide.alt || slide.label}
              />
            ) : slide.kind === "video" && slide.video ? (
            <video
              key={slide.id}
              ref={videoRef}
              className="fe-modes-video"
              src={slide.video}
              poster={slide.poster || slide.image}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            ) : (
              <SectionMedia
                className="fe-modes-video"
                kind="image"
                image={slide.image || slide.poster}
                video=""
                poster={slide.poster}
                alt={slide.alt || slide.label}
              />
            )}
            {slide.kind === "video" && slide.video && !/youtube|youtu\.be|vimeo/i.test(slide.video) ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
