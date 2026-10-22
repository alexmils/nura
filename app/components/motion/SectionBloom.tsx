"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import "./handoffs.css";

/**
 * Scroll hand-off: a soft pistachio disc grows from the top of the section and
 * dissolves as the section settles. A translucent wash, so the content always
 * reads through it — never a solid cover.
 *
 * Distinct from `SectionWipe` and `SectionRise`, so it can neighbour either.
 * Reduced motion: no disc.
 */
export function SectionBloom({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const layer = layerRef.current;
    if (!el || !layer) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      isA11yReduceMotionPreferred();
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        layer,
        { clipPath: "circle(0% at 50% 0%)", opacity: 1 },
        {
          clipPath: "circle(140% at 50% 0%)",
          opacity: 0,
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
  }, []);

  return (
    <div ref={ref} className={`mo-bloom${className ? ` ${className}` : ""}`}>
      <div ref={layerRef} className="mo-bloom-layer" aria-hidden />
      {children}
    </div>
  );
}
