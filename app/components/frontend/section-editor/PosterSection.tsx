"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { sectionText, type SectionConfig } from "@/lib/marketing-sections";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * "Heal" poster, after the "Light" poster: a white top half, the photo across
 * the bottom half (full width), and one giant heavy serif word straddling the
 * edge. Above the edge the letters are filled with the photo (background-clip:
 * text, aligned with the photo below); below it they are white over the photo.
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

export function PosterStage({ copy }: { copy: SectionConfig }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const word = sectionText(copy, "word");
  const letters = posterLetters(word);
  const image = sectionText(copy, "image").trim();
  const alt = sectionText(copy, "alt");
  const kicker = posterKicker(sectionText(copy, "kicker"));
  const line = sectionText(copy, "line").trim();
  const note = sectionText(copy, "note").trim();
  const signature = `${letters.join("")}|${image}`;

  // Fit the word (as large as it can be, fully visible) and paint the photo
  // through the letters so it lines up with the photo below the edge.
  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector<HTMLElement>(".fe-poster-stage");
    const word = root?.querySelector<HTMLElement>(".fe-poster-word");
    if (!root || !stage || !word) return;
    let natural: { w: number; h: number } | null = null;
    let frame = 0;
    const fit = () => {
      const rows = [...word.querySelectorAll<HTMLElement>(".fe-poster-word-inner")];
      if (!rows.length) return;
      rows.forEach((row) => (row.style.fontSize = "100px"));
      const glyphs = rows[0]!.querySelectorAll<HTMLElement>(".fe-poster-letter");
      const firstG = glyphs[0];
      const lastG = glyphs[glyphs.length - 1];
      const measured = firstG && lastG ? lastG.offsetLeft + lastG.offsetWidth - firstG.offsetLeft || 1 : 1;
      const size = Math.max(48, Math.min((100 * stage.clientWidth * (stage.clientWidth < 700 ? 0.86 : 0.9)) / measured, (stage.clientHeight * 0.5) / 0.8));
      rows.forEach((row) => (row.style.fontSize = `${size}px`));
      if (natural && image) {
        const sw = stage.clientWidth;
        const sh = stage.clientHeight;
        const scale = Math.max(sw / natural.w, sh / natural.h);
        const w = natural.w * scale;
        const h = natural.h * scale;
        word.querySelectorAll<HTMLElement>(".fe-poster-layer--photo .fe-poster-letter").forEach((el) => {
          let x = 0;
          let y = 0;
          for (let node: HTMLElement | null = el; node && node !== stage; node = node.offsetParent as HTMLElement | null) {
            x += node.offsetLeft;
            y += node.offsetTop;
          }
          el.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
          el.style.backgroundSize = `${w}px ${h}px`;
          el.style.backgroundPosition = `${(sw - w) / 2 - x}px ${(sh - h) / 2 - y}px`;
        });
        word.querySelector(".fe-poster-layer--photo")?.classList.add("has-photo");
      }
      ScrollTrigger.refresh();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    if (image) {
      const img = new Image();
      img.onload = () => {
        natural = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
        schedule();
      };
      img.src = image;
    }
    schedule();
    void document.fonts?.ready.then(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [signature, image]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion() || !letters.length) return;
    gsap.registerPlugin(ScrollTrigger);
    const section = (root.closest("section") as HTMLElement | null) ?? root;
    const stage = root.querySelector<HTMLElement>(".fe-poster-stage")!;
    const wordEl = root.querySelector<HTMLElement>(".fe-poster-word")!;
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
      tl.set(wordEl, { transformOrigin: origin }, dive);
      if (asides.length) tl.to(asides, { opacity: 0, duration: 0.4, ease: "none" }, dive);
      if (fillRow) {
        gsap.set(fillRow, { color: fill, opacity: 0 });
        tl.to(fillRow, { opacity: 1, duration: 0.7, ease: "none" }, dive);
      }
      tl.fromTo(wordEl, { scale: 1 }, { scale, duration: 2.2, ease: "power3.in", immediateRender: false }, dive + 0.15);
      if (photo) tl.fromTo(photo, { filter: "brightness(1)" }, { filter: "brightness(0.8)", duration: 2.2, ease: "power1.in" }, dive + 0.15);
      // Fully covered: hand the colour to the stage so the release is seamless.
      tl.set(stage, { backgroundColor: fill }, dive + 2.3);
      tl.set([wordEl, photo].filter(Boolean), { autoAlpha: 0 }, dive + 2.35);
      tl.to({}, { duration: 0.3 });
    }, root);
    return () => {
      ctx.revert();
      root.classList.remove("is-scrolly");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const glyphRow = (cls: string, hidden: boolean) => (
    <span className={`fe-poster-word-inner ${cls}`} aria-hidden={hidden || undefined}>
      {letters.map((letter, index) => (
        <span key={index} className="fe-poster-letter">
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
    </span>
  );
  const style = { "--poster-len": Math.max(letters.length, 3) } as CSSProperties;
  return (
    <div ref={rootRef} className="fe-poster" style={style}>
      <div className="fe-poster-stage">
        {image ? (
          <div className="fe-poster-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin images can be any Cloudinary or site URL */}
            <img src={image} alt={alt} loading="lazy" decoding="async" />
          </div>
        ) : null}
        {kicker.length ? (
          <p className="fe-poster-top fe-poster-aside">
            {kicker.map((part, index) => (
              <span key={`${part}-${index}`}>{part}</span>
            ))}
          </p>
        ) : null}
        {line ? <p className="fe-poster-line fe-poster-aside">{line}</p> : null}
        {letters.length ? (
          <h2 className="fe-poster-word" aria-label={letters.join("")}>
            {/* On white: the photo shows through the letters. Over the photo: white letters. */}
            {glyphRow(image ? "fe-poster-layer--photo" : "fe-poster-layer--ink", true)}
            {image ? glyphRow("fe-poster-layer--white", true) : null}
            {glyphRow("fe-poster-layer--fill", true)}
          </h2>
        ) : null}
        {note ? <p className="fe-poster-note fe-poster-aside">{note}</p> : null}
      </div>
    </div>
  );
}
