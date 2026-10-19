"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import "./section-rise.css";

type SectionRiseProps = {
  children: ReactNode;
  className?: string;
  /** Side inset at the start of the rise, in vw. */
  from?: number;
  /** Top-corner radius at the start of the rise, in px. */
  radius?: number;
};

/**
 * Scroll hand-off: as the wrapped section scrolls in, it opens from an inset
 * card with rounded top corners to full bleed. Mirrors the alexandermils
 * "rounded rise" without a pin — pure scroll-linked clip, so no layout shift,
 * no spacer, no negative margins, no click blockers.
 *
 * Do not wrap a section that contains `position: sticky` / `fixed` children:
 * clip-path creates a containing block and would break them.
 *
 * Reduced motion: the section stays a plain block (no clip, no tween).
 */
export function SectionRise({
  children,
  className,
  from = 5,
  radius = 48,
}: SectionRiseProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      isA11yReduceMotionPreferred();
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        {
          clipPath: `inset(0 ${from}vw 0 ${from}vw round ${radius}px ${radius}px 0 0)`,
          yPercent: 3,
        },
        {
          clipPath: "inset(0 0vw 0 0vw round 0px 0px 0 0)",
          yPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 92%",
            end: "top 45%",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        }
      );
    }, el);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [from, radius]);

  return (
    <div ref={ref} className={`mo-section-rise${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
