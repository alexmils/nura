"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { sectionText, type SectionConfig } from "@/lib/marketing-sections";
import "./footer-wordmark.css";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Footer-wide wordmark with a top-to-transparent fade, a thin divider under it
 * (after Helora's footer). When the footer scrolls in, the mark grows from 80%
 * and rises out of its clip, then the divider draws out from the middle.
 * Transform only; reduced motion shows it at rest.
 */
export function FooterWordmark({ config }: { config: SectionConfig }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const word = sectionText(config, "text").trim() || "nura";
  const rawColor = sectionText(config, "color").trim();
  const color = HEX.test(rawColor) ? rawColor : "#ffffff";
  const useLogo = word.toLowerCase() === "nura";

  useEffect(() => {
    const root = rootRef.current;
    if (!root || isA11yReduceMotionPreferred()) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const mark = root.querySelector(".fe-ft-wordmark-mark");
      const line = root.querySelector(".fe-ft-wordmark-line");
      const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 96%", once: true } });
      tl.fromTo(mark, { scale: 0.8, yPercent: 32 }, { scale: 1, yPercent: 0, duration: 1.15, ease: "power3.out" });
      tl.fromTo(line, { scaleX: 0.5, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.7, ease: "power2.out" }, 0.5);
    });
    return () => mm.revert();
  }, [useLogo]);

  return (
    <div
      ref={rootRef}
      className="fe-ft-wordmark"
      style={{ "--wm-color": color, "--wm-chars": Math.max(2, word.length) } as CSSProperties}
    >
      <div className="fe-ft-wordmark-clip">
        {useLogo ? (
          <span className="fe-ft-wordmark-mark fe-ft-wordmark-mark--logo" role="img" aria-label={word} />
        ) : (
          <span className="fe-ft-wordmark-mark fe-ft-wordmark-mark--text" aria-hidden>
            {word}
          </span>
        )}
      </div>
      <div className="fe-ft-wordmark-line" aria-hidden />
    </div>
  );
}
