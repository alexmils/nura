"use client";

import { useEffect, useRef, useState } from "react";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { mediaNames, sectionText, type SectionConfig } from "@/lib/marketing-sections";
import { SectionEdit } from "./SectionEdit";

/**
 * A full-screen film, as its own custom section so it has its own Edit chip.
 * When it follows the Heal poster, CSS pulls this block up behind the poster
 * and pins the screen for the poster's runway; the poster dissolves into it,
 * so the join is invisible.
 */
export function VideoScreen({ copy, id }: { copy: SectionConfig; id: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [quiet, setQuiet] = useState(false);
  const names = mediaNames("media");
  const kind = sectionText(copy, names.kind) === "image" ? "image" : "video";
  const video = kind === "video" ? sectionText(copy, names.video).trim() : "";
  const image = kind === "image" ? sectionText(copy, names.image).trim() : "";
  const poster = sectionText(copy, names.poster).trim();
  const alt = sectionText(copy, names.alt).trim();
  const still = poster || image;
  const signature = `${kind}|${video}|${image}|${poster}`;

  // Reduced motion: OS preference or the Nura accessibility panel.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setQuiet(mq.matches || isA11yReduceMotionPreferred());
    apply();
    mq.addEventListener("change", apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-a11y-motion"] });
    return () => {
      mq.removeEventListener("change", apply);
      observer.disconnect();
    };
  }, []);

  // Reduced motion: if there is no still, the video stays as a paused frame.
  useEffect(() => {
    if (!quiet) return;
    rootRef.current?.querySelector("video")?.pause();
  }, [quiet]);

  // Play only while the screen is on screen (and never under reduced motion).
  useEffect(() => {
    const root = rootRef.current;
    const el = videoRef.current;
    if (!root || !el || quiet) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void el.play().catch(() => {});
        else el.pause();
      },
      { rootMargin: "25% 0px" }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [signature, quiet]);

  return (
    <div ref={rootRef} className="fe-video-screen">
      <SectionEdit id={id} lift />
      {video && !quiet ? (
        <video
          ref={videoRef}
          className="fe-video-media"
          src={video}
          poster={poster || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : still ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin images can be any Cloudinary or site URL
        <img className="fe-video-media" src={still} alt={alt} loading="lazy" decoding="async" />
      ) : video ? (
        // Reduced motion without a poster: the first frame is the still.
        <video className="fe-video-media" src={video} poster={poster || undefined} muted playsInline preload="metadata" />
      ) : (
        <div className="fe-video-empty" aria-hidden />
      )}
    </div>
  );
}
