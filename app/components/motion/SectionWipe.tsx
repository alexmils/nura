"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import "./handoffs.css";

/**
 * Scroll hand-off: a mint veil edged with the Nura wave sits over the top of the
 * section and lifts away as it scrolls in, revealing the content underneath.
 * Decorative overlay only — absolutely positioned, clipped to the wrapper, no
 * pin, no layout shift, no click blocking.
 *
 * Distinct from `SectionRise` (which clips the section itself) so the two can
 * sit on neighbouring boundaries. Do not wrap a section with sticky children.
 *
 * Reduced motion: plain block, no veil.
 */
export function SectionWipe({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const veil = veilRef.current;
    if (!el || !veil) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      isA11yReduceMotionPreferred();
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        veil,
        { yPercent: 0, opacity: 1 },
        {
          yPercent: -105,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 96%",
            end: "top 52%",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        }
      );
    }, el);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={`mo-swipe${className ? ` ${className}` : ""}`}>
      <div ref={veilRef} className="mo-swipe-veil" aria-hidden>
        <div className="mo-swipe-wave" />
      </div>
      {children}
    </div>
  );
}
