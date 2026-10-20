"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { sectionText, type SectionConfig } from "@/lib/marketing-sections";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * "Heal" poster: a full-bleed nature photo with one viewport-wide heavy serif
 * word. Scroll-scrubbed in three beats over a ~2.6-screen runway (the stage is
 * held in view by counter-translation, no pin spacer):
 *   1. letters rise, de-blur and fade in one by one (reverses on scroll up);
 *   2. the kicker, line and note settle in;
 *   3. "through the word": the camera dives into the first letter's stem; the
 *      letters fill with the NEXT section's colour while they grow until that
 *      colour covers the screen, so the next section arrives through the word.
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

  // Fit the word to the viewport width (as large as it can be).
  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector<HTMLElement>(".fe-poster-stage");
    const inner = root?.querySelector<HTMLElement>(".fe-poster-word-inner");
    if (!root || !stage || !inner) return;
    let frame = 0;
    const fit = () => {
      inner.style.fontSize = "100px";
      const natural = inner.scrollWidth || 1;
      const maxW = stage.clientWidth * 0.96;
      const maxH = stage.clientHeight * 0.78;
      const size = Math.min((100 * maxW) / natural, maxH / 0.8);
      inner.style.fontSize = `${Math.max(48, size)}px`;
      root.style.setProperty("--poster-fit", "1");
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
    const wordEl = root.querySelector<HTMLElement>(".fe-poster-word")!;
    const glyphs = [...root.querySelectorAll<HTMLElement>(".fe-poster-letter")];
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

      // The reveal starts while the poster scrolls in, so the first letters rise as it arrives.
      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { ...range, start: () => layoutTop(root) - vh() * 0.55, scrub: 0.5 },
      });
      const step = 0.32;
      glyphs.forEach((glyph, i) => {
        tl.fromTo(glyph, { yPercent: 62, opacity: 0, filter: "blur(18px)" }, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1 }, i * step);
      });
      const revealEnd = (glyphs.length - 1) * step + 1;
      if (asides.length) tl.fromTo(asides, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, revealEnd * 0.6);
      // A short beat to read it.
      const dive = revealEnd + 0.7;
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
      tl.to(glyphs, { color: fill, textShadow: "0 0 0 rgba(0,0,0,0)", duration: 0.7, ease: "none" }, dive);
      tl.fromTo(wordEl, { scale: 1 }, { scale, duration: 2.2, ease: "power3.in", immediateRender: false }, dive + 0.15);
      if (photo) tl.fromTo(photo, { scale: 1, filter: "brightness(1)" }, { scale: 1.12, filter: "brightness(0.82)", duration: 2.2, ease: "power1.in", immediateRender: false }, dive + 0.15);
      // Fully covered: hand the colour to the stage so the release is seamless.
      tl.set(stage, { backgroundColor: fill }, dive + 2.3);
      tl.set([wordEl, photo].filter(Boolean), { autoAlpha: 0 }, dive + 2.35);
    }, root);
    return () => {
      ctx.revert();
      root.classList.remove("is-scrolly");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

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
            <span className="fe-poster-word-inner" aria-hidden>
              {letters.map((letter, index) => (
                <span key={index} className="fe-poster-letter">
                  {letter === " " ? "\u00a0" : letter}
                </span>
              ))}
            </span>
          </h2>
        ) : null}
        {note ? <p className="fe-poster-note fe-poster-aside">{note}</p> : null}
      </div>
    </div>
  );
}
