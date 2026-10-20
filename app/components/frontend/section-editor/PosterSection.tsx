"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { frameKey, storedFrameStyle } from "@/lib/image-position";
import { sectionBackground, sectionText, type SectionConfig } from "@/lib/marketing-sections";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * "Heal" poster (after the "Light" poster). ONE photo covers the whole stage.
 * A paper layer (the section colour, white by default) covers the top with a
 * hard edge that sits on the word's baseline, so the letters stand on the
 * photo. The word is a window onto the same photo (the image is clipped to the
 * glyphs), so the white block above and the photo below read as one poster.
 *
 * When a Video screen directly follows, the poster pins for a scroll runway:
 * the word dissolves, the scene pushes in gently with a hint of 3D, and the
 * whole poster fades into the video screen pinned underneath it. "dive" comes
 * from the page layout (nextType === "video"), so the two sections stay
 * independent and the video keeps its own Edit chip.
 */

export const POSTER_WORD_MAX = 12;

/**
 * The paper/photo edge sits exactly on the word's baseline, so the flat bottoms
 * of H, h and l stand on the photo (as in the reference poster). Used only when
 * canvas metrics are unavailable; the live value comes from the real font.
 */
export const POSTER_BASELINE = 0.79;

/** Scroll runway of the dive, on top of the pinned 100svh poster. */
export const POSTER_DIVE_VH = 100;


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

export function PosterStage({ copy, id, dive = false }: { copy: SectionConfig; id?: string; dive?: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [quiet, setQuiet] = useState(false);
  const word = sectionText(copy, "word");
  const letters = posterLetters(word);
  const image = sectionText(copy, "image").trim();
  const alt = sectionText(copy, "alt");
  const line = sectionText(copy, "line").trim();
  const note = sectionText(copy, "note").trim();
  const signature = `${letters.join("")}|${image}|${dive}`;
  const hasThrough = dive;
  // Section colour comes from the Background panel (Color); white by default.
  const bg = sectionBackground(copy);
  const paper = bg?.kind === "color" ? bg.color : "#ffffff";

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

  // Fit the word (as large as it can be, fully visible) and put the
  // paper/photo edge across it.
  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector<HTMLElement>(".fe-poster-stage");
    if (!root || !stage) return;
    const scene = stage.querySelector<HTMLElement>(".fe-poster-scene");
    let frame = 0;
    const fit = () => {
      const rows = [...stage.querySelectorAll<HTMLElement>(".fe-poster-word-inner")];
      if (!rows.length) return;
      const glyphs = rows[0]!.querySelectorAll<HTMLElement>(".fe-poster-letter");
      const firstG = glyphs[0];
      const lastG = glyphs[glyphs.length - 1];
      if (!firstG || !lastG) return;
      // Measure in layout space: while the dive is scrubbed the scene carries a
      // 3D transform, and rects would include it. Widths/sizes below are layout
      // values already, but the Range/stage rects are not.
      const sceneTransform = scene?.style.transform;
      if (scene) scene.style.transform = "none";
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
        // HEAL stands ON the image's edge: the hard white/photo line is the
        // word's baseline, so the bottom of every flat letter (H, h, l) rests
        // on the photo. A Range rect spans the font's full em box (ascent +
        // descent), not the ink, so the baseline is derived from the same
        // font metrics the browser laid the text out with.
        const node = firstG.firstChild;
        if (node) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          const stageRect = stage.getBoundingClientRect();
          const style = getComputedStyle(firstG);
          const ctx = document.createElement("canvas").getContext("2d");
          let baseline = rect.top + rect.height * POSTER_BASELINE;
          if (ctx) {
            ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            // Any glyph yields the same font-wide ascent/descent.
            const metrics = ctx.measureText(firstG.textContent || "H");
            const ascent = metrics.fontBoundingBoxAscent;
            const descent = metrics.fontBoundingBoxDescent;
            if (ascent > 0 && descent >= 0) {
              baseline = rect.top + rect.height * (ascent / (ascent + descent));
            }
          }
          root.style.setProperty("--poster-cut", `${Math.round(baseline - stageRect.top)}px`);
        }
      }
      if (scene && sceneTransform) scene.style.transform = sceneTransform;
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

  // The dive: pin the poster, dissolve the word, push in and fade into the
  // video screen pinned underneath.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || quiet || !dive) return;
    const scene = root.querySelector<HTMLElement>(".fe-poster-scene");
    const wordLayer = root.querySelector<HTMLElement>(".fe-poster-word");
    const lineLayer = root.querySelector<HTMLElement>(".fe-poster-line");
    const noteLayer = root.querySelector<HTMLElement>(".fe-poster-note");
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
      // A shallow push-in with a hint of tilt: depth without showing the
      // glyphs' imperfections up close. It levels off as the film takes over.
      if (scene) {
        tl.fromTo(
          scene,
          { scale: 1, rotateX: 0, rotateY: 0 },
          { scale: 1.55, rotateX: 3, rotateY: -1.5, duration: 0.8 },
          0
        );
        tl.to(scene, { scale: 1.62, rotateX: 0, rotateY: 0, duration: 0.2 }, 0.8);
      }
      if (lineLayer) tl.to(lineLayer, { autoAlpha: 0, duration: 0.12 }, 0);
      if (noteLayer) tl.to(noteLayer, { autoAlpha: 0, duration: 0.12 }, 0);
      // The word goes first, then the whole poster (paper + photo) dissolves
      // into the video screen pinned underneath it - early, so the film is
      // already surfacing as soon as the scroll starts.
      if (wordLayer) tl.to(wordLayer, { autoAlpha: 0, duration: 0.16 }, 0.02);
      if (scene) tl.to(scene, { autoAlpha: 0, duration: 0.45 }, 0.1);
    }, root);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [signature, quiet, dive]);

  const glyphRow = (cls: string) => (
    <span className={`fe-poster-word-inner ${cls}`} aria-hidden>
      {letters.map((letter, index) => (
        <span key={index} className="fe-poster-letter">
          {letter === " " ? " " : letter}
        </span>
      ))}
    </span>
  );
  const style = {
    "--poster-len": Math.max(letters.length, 3),
    "--poster-paper": paper,
    "--poster-ink": posterInk(paper),
    "--poster-runway": `${POSTER_DIVE_VH}svh`,
  } as CSSProperties;
  const light = paperIsLight(paper);
  return (
    <div
      ref={rootRef}
      className={`fe-poster${image ? " has-image" : ""}${hasThrough ? " has-through" : ""}${light ? "" : " is-dark-paper"}`}
      style={style}
    >
      <div className="fe-poster-pin">
        <div className="fe-poster-stage">
          <div className="fe-poster-scene">
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
      </div>
    </div>
  );
}
