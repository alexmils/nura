"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { sectionText, type SectionConfig } from "@/lib/marketing-sections";

export const POSTER_WORD_MAX = 12;

/** The giant word, one entry per letter (grapheme-ish), capped so it always fits. */
export function posterLetters(word: string): string[] {
  return Array.from(word.trim()).slice(0, POSTER_WORD_MAX);
}

/** The mono kicker row: items separated by "|". */
export function posterKicker(value: string): string[] {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || isA11yReduceMotionPreferred();
}

/**
 * Poster section ("Heal"): a giant heavy serif word over a nature photo. Above
 * the photo's edge the letters are filled with the photo itself; where they
 * overlap it they turn white. Scrubbed on scroll, each letter rises, de-blurs
 * and fades in, staggered; scrolling back reverses it. transform / opacity /
 * filter only. Reduced motion: the finished poster, static.
 */
export function PosterStage({ copy }: { copy: SectionConfig }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const word = sectionText(copy, "word");
  const letters = posterLetters(word);
  const image = sectionText(copy, "image").trim();
  const alt = sectionText(copy, "alt");
  const kicker = posterKicker(sectionText(copy, "kicker"));
  const line = sectionText(copy, "line").trim();
  const note = sectionText(copy, "note").trim();
  const signature = `${letters.join("")}|${image}`;

  // Line each photo-filled letter's background up with the stage-sized photo
  // (object-fit: cover), so the picture reads straight through the word.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !image) return;
    let natural: { w: number; h: number } | null = null;
    let frame = 0;
    const fit = () => {
      if (!natural) return;
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const scale = Math.max(sw / natural.w, sh / natural.h);
      const w = natural.w * scale;
      const h = natural.h * scale;
      stage.querySelectorAll<HTMLElement>(".fe-poster-word--photo .fe-poster-letter").forEach((el) => {
        let x = 0;
        let y = 0;
        let node: HTMLElement | null = el;
        while (node && node !== stage) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        el.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
        el.style.backgroundSize = `${w}px ${h}px`;
        el.style.backgroundPosition = `${(sw - w) / 2 - x}px ${(sh - h) / 2 - y}px`;
      });
      stage.querySelector(".fe-poster-word--photo")?.classList.add("has-photo");
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const img = new Image();
    img.onload = () => {
      natural = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
      schedule();
    };
    img.src = image;
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.querySelector(".fe-poster-word--photo")?.classList.remove("has-photo");
    };
  }, [signature, image]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reducedMotion()) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const layers = [...stage.querySelectorAll(".fe-poster-word")].map((layer) => [
        ...layer.querySelectorAll<HTMLElement>(".fe-poster-letter"),
      ]);
      const count = layers[0]?.length ?? 0;
      const step = 0.32;
      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: stage, start: "top 88%", end: "top 12%", scrub: 0.5, invalidateOnRefresh: true },
      });
      for (let i = 0; i < count; i += 1) {
        const group = layers.map((layer) => layer[i]).filter(Boolean);
        tl.fromTo(
          group,
          { yPercent: 62, opacity: 0, filter: "blur(18px)" },
          { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1 },
          i * step
        );
      }
      const asides = stage.querySelectorAll(".fe-poster-aside");
      if (asides.length) {
        tl.fromTo(asides, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, Math.max(0, count * step * 0.6));
      }
    }, stage);
    return () => ctx.revert();
  }, [signature]);

  const style = { "--poster-len": Math.max(letters.length, 3) } as CSSProperties;
  return (
    <div ref={stageRef} className="fe-poster" style={style}>
      {kicker.length ? (
        <p className="fe-poster-top fe-poster-aside">
          {kicker.map((part, index) => (
            <span key={`${part}-${index}`}>{part}</span>
          ))}
        </p>
      ) : null}
      {line ? <p className="fe-poster-line fe-poster-aside">{line}</p> : null}
      {image ? (
        <div className="fe-poster-photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin images can be any Cloudinary or site URL */}
          <img src={image} alt={alt} loading="lazy" decoding="async" />
        </div>
      ) : null}
      {letters.length ? (
        <>
          <h2 className="fe-poster-word fe-poster-word--photo" aria-label={letters.join("")}>
            <span className="fe-poster-word-inner" aria-hidden>
              {letters.map((letter, index) => (
                <span key={index} className="fe-poster-letter">
                  {letter === " " ? "\u00a0" : letter}
                </span>
              ))}
            </span>
          </h2>
          {image ? (
          <div className="fe-poster-word fe-poster-word--white" aria-hidden>
            <span className="fe-poster-word-inner">
              {letters.map((letter, index) => (
                <span key={index} className="fe-poster-letter">
                  {letter === " " ? "\u00a0" : letter}
                </span>
              ))}
            </span>
          </div>
          ) : null}
        </>
      ) : null}
      {note ? <p className="fe-poster-note fe-poster-aside">{note}</p> : null}
    </div>
  );
}