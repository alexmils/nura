"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { LetterRevealHeading } from "@/app/components/frontend/LetterRevealHeading";
import { KnowledgeSeriesBlock } from "@/app/components/frontend/KnowledgeSeriesBlock";
import {
  KNOWLEDGE_SERIES,
} from "@/lib/knowledge-clips";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import "./knowledge.css";

export function KnowledgeHub() {
  const heroCopy = useSectionConfig("knowledge-hero");
  const seriesCopy = useSectionConfig("knowledge-series");
  const moreCopy = useSectionConfig("knowledge-more");
  const seriesHeadings = sectionList(seriesCopy, "series");
  const seriesOrder = [
    ...seriesHeadings
      .map((row) => row.id)
      .filter((id): id is string => KNOWLEDGE_SERIES.some((series) => series.id === id)),
    ...KNOWLEDGE_SERIES.map((series) => series.id).filter(
      (id) => !seriesHeadings.some((row) => row.id === id)
    ),
  ];
  const seriesList = seriesOrder.flatMap((id) => {
    const series = KNOWLEDGE_SERIES.find((item) => item.id === id);
    if (!series) return [];
    const saved = seriesHeadings.find((row) => row.id === id);
    return [{
      ...series,
      title: saved?.title || series.title,
      role: saved?.role || series.role,
    }];
  });
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [heroPlaying, setHeroPlaying] = useState(false);
  const [heroStarted, setHeroStarted] = useState(false);
  const clipKind = sectionText(heroCopy, "clipKind");
  const clipVideo = sectionText(heroCopy, "clipVideo");
  const clipPoster = sectionText(heroCopy, "clipPoster") || sectionText(heroCopy, "clipImage");
  const hasHeroVideo = clipKind !== "image" && Boolean(clipVideo);

  const toggleHero = useCallback(() => {
    const el = heroVideoRef.current;
    if (!el || !hasHeroVideo) return;
    if (el.paused) {
      setHeroStarted(true);
      el.muted = false;
      void el.play().then(
        () => setHeroPlaying(true),
        () => {
          el.muted = true;
          void el.play().then(
            () => setHeroPlaying(true),
            () => setHeroPlaying(false)
          );
        }
      );
    } else {
      el.pause();
      setHeroPlaying(false);
    }
  }, [hasHeroVideo]);

  return (
    <div className="fe-knowledge">
      <PageSections
        page="knowledge"
        slots={{
      "knowledge-hero": (
      <>
      <section
        className="fe-knowledge-hero fe-has-edit"
        data-section="knowledge-hero"
        aria-labelledby="fe-knowledge-hero-title"
      >
        <SectionEdit id="knowledge-hero" lift />
        <div
          className={`fe-knowledge-hero-media${heroPlaying ? " is-playing" : ""}`}
        >
          {hasHeroVideo ? (
            <>
              {!heroStarted ? (
                <Image
                  src={clipPoster}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="fe-knowledge-hero-image"
                  unoptimized={!clipPoster.startsWith("/marketing/")}
                />
              ) : null}
              <video
                ref={heroVideoRef}
                className={`fe-knowledge-hero-video${heroStarted ? " is-on" : ""}`}
                src={clipVideo}
                poster={clipPoster}
                playsInline
                loop
                preload="metadata"
                onPlay={() => setHeroPlaying(true)}
                onPause={() => setHeroPlaying(false)}
              />
            </>
          ) : (
            <Image
              src={clipPoster}
              alt=""
              fill
              priority
              sizes="100vw"
              className="fe-knowledge-hero-image"
              unoptimized={!clipPoster.startsWith("/marketing/")}
            />
          )}
          <div className="fe-knowledge-hero-shade" aria-hidden />

          <button
            type="button"
            className={`fe-knowledge-hero-play${heroPlaying ? " is-playing" : ""}`}
            onClick={toggleHero}
            aria-label={heroPlaying ? "Pause video" : "Play video"}
            disabled={!hasHeroVideo}
          >
            {heroPlaying ? (
              <Pause size={30} strokeWidth={1.5} aria-hidden />
            ) : (
              <Play size={30} fill="currentColor" strokeWidth={0} aria-hidden />
            )}
          </button>

          <div className="fe-knowledge-hero-copy">
            <h1
              id="fe-knowledge-hero-title"
              className="fe-knowledge-hero-title"
            >
              {sectionText(heroCopy, "title")}
            </h1>
            <p className="fe-knowledge-hero-lead">{sectionText(heroCopy, "lead")}</p>
          </div>
        </div>
      </section>

      <p className="fe-knowledge-intro">{sectionText(heroCopy, "intro")}</p>
      </>
      ),
      "knowledge-series": (
      <div className="fe-knowledge-body fe-has-edit" data-section="knowledge-series">
        <SectionEdit id="knowledge-series" />
        {seriesList.map((series) => (
          <KnowledgeSeriesBlock key={series.id} series={series} />
        ))}

        <section
          className="fe-knowledge-more fe-has-edit"
          data-section="knowledge-more"
          aria-labelledby="fe-knowledge-more-title"
        >
          <SectionEdit id="knowledge-more" />
          <p className="fe-section-kicker">{sectionText(moreCopy, "kicker")}</p>
          <LetterRevealHeading
            id="fe-knowledge-more-title"
            className="fe-knowledge-more-title"
          >
            {sectionText(moreCopy, "title")}
          </LetterRevealHeading>
          <ul className="fe-knowledge-more-list">
            {sectionList(moreCopy, "links").map((item) => (
              <li key={item.href}>
                <Link href={item.href ?? "/"} className="fe-knowledge-more-link">
                  <span className="fe-knowledge-more-label">{item.label}</span>
                  <span className="fe-knowledge-more-dek">{item.dek}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      ),
        }}
      />
    </div>
  );
}
