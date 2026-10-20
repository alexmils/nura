"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { frameKey, storedFrameStyle } from "@/lib/image-position";
import { sectionBackground, sectionText, type SectionConfig } from "@/lib/marketing-sections";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * "Heal" poster (after the "Light" poster). ONE photo covers the whole stage.
 * A paper layer (the section colour, white by default) covers the top and
 * fades into the photo with a feathered mask. The word is cut out of that
 * paper (mix-blend lighten with black letters), so it grows out of the photo
 * below and dissolves into the white above. Static: no scroll animation - the
 * poster is always fully visible, only the fit is recalculated on resize.
 */

export const POSTER_WORD_MAX = 12;

/** The hard white/photo edge crosses the letters this far down their visual height. */
export const POSTER_CROSS = 0.55;


/** Dark or light ink for text on the section colour (white by default). */
export function paperIsLight(paper: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(paper);
  if (!m) return true;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.55;
}

export function posterInk(paper: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(paper);
  if (!m) return "#1d2a17";
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.55 ? "#1d2a17" : "#f4f7ef";
}

export function posterLetters(word: string): string[] {
  return Array.from(word.trim()).slice(0, POSTER_WORD_MAX);
}

export function PosterStage({ copy, id }: { copy: SectionConfig; id?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const word = sectionText(copy, "word");
  const letters = posterLetters(word);
  const image = sectionText(copy, "image").trim();
  const alt = sectionText(copy, "alt");
  const line = sectionText(copy, "line").trim();
  const note = sectionText(copy, "note").trim();
  const signature = `${letters.join("")}|${image}`;
  // Section colour comes from the Background panel (Color); white by default.
  const bg = sectionBackground(copy);
  const paper = bg?.kind === "color" ? bg.color : "#ffffff";

  // Fit the word (as large as it can be, fully visible) and put the
  // paper/photo edge across it.
  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector<HTMLElement>(".fe-poster-stage");
    if (!root || !stage) return;
    let frame = 0;
    const fit = () => {
      const rows = [...stage.querySelectorAll<HTMLElement>(".fe-poster-word-inner")];
      if (!rows.length) return;
      const glyphs = rows[0]!.querySelectorAll<HTMLElement>(".fe-poster-letter");
      const firstG = glyphs[0];
      const lastG = glyphs[glyphs.length - 1];
      if (!firstG || !lastG) return;
      // Fraunces is optically sized, so glyph widths do not scale linearly with
      // font-size. Fit iteratively at the real size instead of extrapolating
      // from 100px, otherwise large words overflow the stage ("Heal" lost its l).
      const maxWidth = stage.clientWidth * (stage.clientWidth < 700 ? 0.94 : 0.98);
      const maxSize = (stage.clientHeight * 0.42) / 0.8;
      let size = maxSize;
      for (let pass = 0; pass < 4; pass += 1) {
        rows.forEach((row) => (row.style.fontSize = `${size}px`));
        const width = lastG.offsetLeft + lastG.offsetWidth - firstG.offsetLeft || 1;
        const next = Math.max(48, Math.min(maxSize, (size * maxWidth) / width));
        if (Math.abs(next - size) < 1) break;
        size = next;
      }
      rows.forEach((row) => (row.style.fontSize = `${size}px`));
      if (firstG) {
        // HEAL stands ON the image's edge: the hard white/photo line crosses
        // the painted letters just below their middle, so the word dips into
        // the photo (a Range measures the visual glyphs, not the line-height
        // box). Offsets are relative to the stage box.
        const node = firstG.firstChild;
        if (node) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          const stageRect = stage.getBoundingClientRect();
          root.style.setProperty("--poster-cut", `${Math.round(rect.top - stageRect.top + rect.height * POSTER_CROSS)}px`);
        }
      }
      ScrollTrigger.refresh();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    schedule();
    void document.fonts?.ready.then(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [signature]);

  const glyphRow = (cls: string) => (
    <span className={`fe-poster-word-inner ${cls}`} aria-hidden>
      {letters.map((letter, index) => (
        <span key={index} className="fe-poster-letter">
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
    </span>
  );
  const style = {
    "--poster-len": Math.max(letters.length, 3),
    "--poster-paper": paper,
    "--poster-ink": posterInk(paper),
  } as CSSProperties;
  const light = paperIsLight(paper);
  return (
    <div
      ref={rootRef}
      className={`fe-poster${image ? " has-image" : ""}${light ? "" : " is-dark-paper"}`}
      style={style}
    >
      <div className="fe-poster-stage">
        {image ? (
          <div className="fe-poster-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin images can be any Cloudinary or site URL */}
            <img
              src={image}
              alt={alt}
              loading="lazy"
              decoding="async"
              data-frame-key={id ? frameKey(id, "image") : undefined}
              style={storedFrameStyle(sectionText(copy, "imagePos"))}
            />
          </div>
        ) : null}
        {/* White top with a hard edge; the word itself is a window onto the photo. */}
        <div className="fe-poster-paper" aria-hidden />
        {letters.length ? (
          <h2
            className={`fe-poster-word fe-poster-word--photo${image ? "" : " is-plain"}`}
            aria-label={letters.join("")}
            style={image ? { backgroundImage: `url("${image.replace(/"/g, "%22")}")` } : undefined}
          >
            {glyphRow("fe-poster-layer--photo")}
          </h2>
        ) : null}
        {line ? <p className="fe-poster-line fe-poster-aside">{line}</p> : null}
        {note ? <p className="fe-poster-note fe-poster-aside">{note}</p> : null}
      </div>
    </div>
  );
}
