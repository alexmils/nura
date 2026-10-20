"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { frameKey, storedFrameStyle } from "@/lib/image-position";
import {
  mediaNames,
  sectionBackground,
  sectionText,
  type SectionConfig,
} from "@/lib/marketing-sections";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * "Heal" poster (after the "Light" poster). ONE photo covers the whole stage.
 * A paper layer (the section colour, white by default) covers the top with a
 * hard edge that sits on the word's baseline, so the letters stand on the
 * photo. The word is a window onto the same photo (the image is clipped to the
 * glyphs), so the white block above and the photo below read as one poster.
 *
 * With a "Video after the word" set, the poster pins for a scroll runway and
 * the camera dives into HEAL in 3D: the scene scales past the letters while the
 * paper and word dissolve, then the film opens underneath it. There is no
 * second section and therefore no visible seam.
 */

export const POSTER_WORD_MAX = 12;

/**
 * The paper/photo edge sits exactly on the word's baseline, so the flat bottoms
 * of H, h and l stand on the photo (as in the reference poster). Used only when
 * canvas metrics are unavailable; the live value comes from the real font.
 */
export const POSTER_BASELINE = 0.79;

/** Scroll runway of the dive, on top of the pinned 100svh poster. */
export const POSTER_DIVE_VH = 170;


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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [quiet, setQuiet] = useState(false);
  const word = sectionText(copy, "word");
  const letters = posterLetters(word);
  const image = sectionText(copy, "image").trim();
  const alt = sectionText(copy, "alt");
  const line = sectionText(copy, "line").trim();
  const note = sectionText(copy, "note").trim();
  const names = mediaNames("media");
  const mediaKind = sectionText(copy, names.kind) === "image" ? "image" : "video";
  const video = mediaKind === "video" ? sectionText(copy, names.video).trim() : "";
  const still = mediaKind === "image" ? sectionText(copy, names.image).trim() : "";
  const through = video || still;
  const poster = sectionText(copy, names.poster).trim();
  const signature = `${letters.join("")}|${image}|${through}|${poster}|${mediaKind}`;
  const hasThrough = Boolean(through);
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

  // The dive: pin the poster, fly the camera into the word, open the film.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || quiet || !through) return;
    const scene = root.querySelector<HTMLElement>(".fe-poster-scene");
    const paperLayer = root.querySelector<HTMLElement>(".fe-poster-paper");
    const wordLayer = root.querySelector<HTMLElement>(".fe-poster-word");
    const lineLayer = root.querySelector<HTMLElement>(".fe-poster-line");
    const noteLayer = root.querySelector<HTMLElement>(".fe-poster-note");
    const screen = root.querySelector<HTMLElement>(".fe-poster-through");
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
      // A slight tilt on the way in sells the camera depth; it levels off as
      // we pass the word's plane.
      if (scene) {
        tl.fromTo(
          scene,
          { scale: 1, rotateX: 0, rotateY: 0 },
          { scale: 3.4, rotateX: 7, rotateY: -3, duration: 0.78 },
          0
        );
        tl.to(scene, { scale: 3.85, rotateX: 0, rotateY: 0, duration: 0.22 }, 0.78);
      }
      if (lineLayer) tl.to(lineLayer, { autoAlpha: 0, duration: 0.14 }, 0);
      if (noteLayer) tl.to(noteLayer, { autoAlpha: 0, duration: 0.14 }, 0);
      // The white paper dissolves first: the letters are already windows onto
      // the photo, so the whole frame becomes forest.
      if (paperLayer) tl.to(paperLayer, { autoAlpha: 0, duration: 0.22 }, 0.44);
      if (wordLayer) tl.to(wordLayer, { autoAlpha: 0, duration: 0.2 }, 0.62);
      if (screen) {
        tl.fromTo(
          screen,
          { autoAlpha: 0, scale: 1.12 },
          { autoAlpha: 1, scale: 1, duration: 0.28 },
          0.66
        );
      }
    }, root);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [signature, quiet, through]);

  // Play only while the poster is on screen (and never under reduced motion).
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

  const glyphRow = (cls: string) => (
    <span className={`fe-poster-word-inner ${cls}`} aria-hidden>
      {letters.map((letter, index) => (
        <span key={index} className="fe-poster-letter">
          {letter === " " ? " " : letter}
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
          {through && !quiet ? (
            video ? (
              <video
                ref={videoRef}
                className="fe-poster-through"
                src={video}
                poster={poster || image || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
                tabIndex={-1}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin images can be any Cloudinary or site URL
              <img className="fe-poster-through" src={still} alt="" loading="lazy" decoding="async" />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
