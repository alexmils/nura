"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { frameKey, storedFrameStyle } from "@/lib/image-position";
import { sectionBackground, sectionText, type SectionConfig } from "@/lib/marketing-sections";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * "Heal" poster, after the "Light" poster. ONE photo covers the whole stage.
 * Over it a paper layer (the section colour, white by default) covers the top
 * and fades into the photo with a feathered mask. The word is cut out of that
 * paper (mix-blend lighten with black letters), so above the edge the letters
 * are windows onto the very same photo: pixel-aligned by construction. A white
 * copy of the word shows only where the photo is (the same feather, inverted).
 * The edge crosses the letters about halfway down.
 * Scroll-scrubbed over a runway (the stage is held in view by counter-
 * translation, no pin spacer):
 *   1. letters rise, de-blur and fade in one by one (reverses on scroll up);
 *   2. the kicker, line and note settle in;
 *   3. "through the word": the letters fill with the NEXT section's colour and
 *      the camera dives into the first letter's stem until that colour covers
 *      the screen, so the next section arrives through the word.
 * transform/opacity/filter only. Reduced motion: a static one-screen poster.
 */

export const POSTER_WORD_MAX = 12;

/** Where the photo's top edge cuts the word: this share of the letters sits on the paper. */
export const POSTER_ON_PAPER = 0.55;
/** Feather of the paper/photo edge, as a share of the letter height. */
export const POSTER_FEATHER = 0.035;

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

export function posterKicker(value: string): string[] {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** Scale at which a point inside a letter stem covers the whole viewport. */
export function diveScale(stemWidthPx: number, viewportW: number, viewportH: number): number {
  const reach = Math.hypot(viewportW, viewportH) * 2;
  return Math.min(140, Math.max(12, reach / Math.max(4, stemWidthPx)));
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || isA11yReduceMotionPreferred();
}

function layoutTop(el: HTMLElement): number {
  let y = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop;
  return y;
}

const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;
function nextColour(section: HTMLElement): string {
  let next = section.nextElementSibling as HTMLElement | null;
  // Climb out of wrappers (section gates) to the real neighbour.
  for (let host: HTMLElement | null = section; !next && host?.parentElement; host = host.parentElement) {
    next = host.parentElement.nextElementSibling as HTMLElement | null;
  }
  for (let node: HTMLElement | null = next; node; node = node.firstElementChild as HTMLElement | null) {
    const bg = getComputedStyle(node).backgroundColor;
    if (!TRANSPARENT.test(bg)) return bg;
    if (node.offsetHeight < 40) break;
  }
  return getComputedStyle(document.body).backgroundColor || "#ffffff";
}

export function PosterStage({ copy, id }: { copy: SectionConfig; id?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const word = sectionText(copy, "word");
  const letters = posterLetters(word);
  const image = sectionText(copy, "image").trim();
  const alt = sectionText(copy, "alt");
  const kicker = posterKicker(sectionText(copy, "kicker"));
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
      rows.forEach((row) => (row.style.fontSize = "100px"));
      const glyphs = rows[0]!.querySelectorAll<HTMLElement>(".fe-poster-letter");
      const firstG = glyphs[0];
      const lastG = glyphs[glyphs.length - 1];
      const measured = firstG && lastG ? lastG.offsetLeft + lastG.offsetWidth - firstG.offsetLeft || 1 : 1;
      const size = Math.max(48, Math.min((100 * stage.clientWidth * (stage.clientWidth < 700 ? 0.86 : 0.9)) / measured, (stage.clientHeight * 0.42) / 0.8));
      rows.forEach((row) => (row.style.fontSize = `${size}px`));
      if (firstG) {
        // Glyph box without its padding; offsets are relative to the stage-sized word box.
        const pad = size * 0.04;
        const top = firstG.offsetTop + pad;
        const glyphH = firstG.offsetHeight - pad * 2;
        root.style.setProperty("--poster-cut", `${Math.round(top + glyphH * POSTER_ON_PAPER)}px`);
        root.style.setProperty("--poster-feather", `${Math.round(glyphH * POSTER_FEATHER)}px`);
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion() || !letters.length) return;
    gsap.registerPlugin(ScrollTrigger);
    const section = (root.closest("section") as HTMLElement | null) ?? root;
    const stage = root.querySelector<HTMLElement>(".fe-poster-stage")!;
    // Every copy of the word (window, white, fill) moves as one.
    const words = [...root.querySelectorAll<HTMLElement>(".fe-poster-word")];
    const wordEl = words[0]!;
    const layers = [...root.querySelectorAll<HTMLElement>(".fe-poster-word-inner:not(.fe-poster-layer--fill)")].map((row) => [
      ...row.querySelectorAll<HTMLElement>(".fe-poster-letter"),
    ]);
    const fillRow = root.querySelector<HTMLElement>(".fe-poster-layer--fill");
    const count = layers[0]?.length ?? 0;
    const glyphs = layers[0] ?? [];
    const photo = root.querySelector<HTMLElement>(".fe-poster-photo");
    const asides = root.querySelectorAll<HTMLElement>(".fe-poster-aside");
    root.classList.add("is-scrolly");
    const ctx = gsap.context(() => {
      const vh = () => window.innerHeight;
      const travel = () => Math.max(0, root.offsetHeight - vh());
      const range = {
        trigger: root,
        start: () => layoutTop(root),
        end: () => layoutTop(root) + travel(),
        scrub: true,
        invalidateOnRefresh: true,
      };
      // Hold the stage in view for the runway (virtual pin).
      gsap.fromTo(stage, { y: 0 }, { y: () => travel(), ease: "none", scrollTrigger: range });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { ...range, scrub: 0.5 } });
      const step = 0.32;
      for (let i = 0; i < count; i += 1) {
        const group = layers.map((row) => row[i]).filter(Boolean);
        tl.fromTo(group, { yPercent: 62, opacity: 0, filter: "blur(18px)" }, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1 }, i * step);
      }
      const revealEnd = (count - 1) * step + 1;
      if (asides.length) tl.fromTo(asides, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, revealEnd * 0.6);
      // A short beat to read it.
      const dive = revealEnd + 0.9;
      const first = glyphs[0]!;
      const origin = () => {
        const w = wordEl.getBoundingClientRect();
        const g = first.getBoundingClientRect();
        // The first letter's left stem: solid for most serif capitals.
        return `${g.left - w.left + g.width * 0.16}px ${g.top - w.top + g.height * 0.55}px`;
      };
      const scale = () => {
        const g = first.getBoundingClientRect();
        return diveScale(g.width * 0.16, window.innerWidth, window.innerHeight);
      };
      const fill = nextColour(section);
      tl.set(words, { transformOrigin: origin }, dive);
      if (asides.length) tl.to(asides, { opacity: 0, duration: 0.4, ease: "none" }, dive);
      if (fillRow) {
        gsap.set(fillRow, { color: fill, opacity: 0 });
        tl.to(fillRow, { opacity: 1, duration: 0.7, ease: "none" }, dive);
      }
      tl.fromTo(words, { scale: 1 }, { scale, duration: 2.2, ease: "power3.in", immediateRender: false }, dive + 0.15);
      if (photo) tl.fromTo(photo, { filter: "brightness(1)" }, { filter: "brightness(0.8)", duration: 2.2, ease: "power1.in" }, dive + 0.15);
      // Fully covered: hand the colour to the stage so the release is seamless.
      tl.set(stage, { backgroundColor: fill }, dive + 2.3);
      tl.set([...words, photo, root.querySelector(".fe-poster-paper")].filter(Boolean), { autoAlpha: 0 }, dive + 2.35);
      tl.to({}, { duration: 0.3 });
    }, root);
    return () => {
      ctx.revert();
      root.classList.remove("is-scrolly");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* The paper over the top, feathered into the photo; the word is cut out of it. */}
        <div className="fe-poster-paper">
          {letters.length ? (
            <h2 className="fe-poster-word fe-poster-word--window" aria-label={letters.join("")}>
              {glyphRow("fe-poster-layer--window")}
            </h2>
          ) : null}
        </div>
        {letters.length && image ? <div className="fe-poster-word fe-poster-word--white" aria-hidden>{glyphRow("fe-poster-layer--white")}</div> : null}
        {letters.length ? <div className="fe-poster-word fe-poster-word--fill" aria-hidden>{glyphRow("fe-poster-layer--fill")}</div> : null}
        {kicker.length ? (
          <p className="fe-poster-top fe-poster-aside">
            {kicker.map((part, index) => (
              <span key={`${part}-${index}`}>{part}</span>
            ))}
          </p>
        ) : null}
        {line ? <p className="fe-poster-line fe-poster-aside">{line}</p> : null}
        {note ? <p className="fe-poster-note fe-poster-aside">{note}</p> : null}
      </div>
    </div>
  );
}
