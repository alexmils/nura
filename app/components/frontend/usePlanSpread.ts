"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import "./plan-spread.css";

/** Side-by-side cards only; phones keep the stacked list and its usual reveal. */
const SPREAD_QUERY = "(min-width: 901px) and (prefers-reduced-motion: no-preference)";
/** How far a side card starts tucked toward the middle (1 = fully behind it). */
const TUCK = 0.82;
/** Tilt of the outermost card at the start, in degrees. */
const TILT = 10;

/**
 * Plan cards "spread out" as the grid scrolls in, after Mindix's pricing band:
 * side cards start tucked behind the middle one, tilted about 10deg, and slide
 * out to their places. Scroll-scrubbed, x/rotation only, so it composes with the
 * landing reveal that owns y/opacity on the same cards. Offsets are measured
 * from the real layout (offsetLeft ignores transforms), so any number of shown
 * cards, in any order, fans from the centre.
 *
 * `layoutKey` changes when the admin hides or reorders cards, so it re-measures.
 */
export function usePlanSpread(ref: RefObject<HTMLElement | null>, layoutKey: string) {
  useEffect(() => {
    const grid = ref.current;
    if (!grid || isA11yReduceMotionPreferred()) return;

    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(SPREAD_QUERY, () => {
      const cards = Array.from(grid.children) as HTMLElement[];
      if (cards.length < 2) return;
      const mid = (cards.length - 1) / 2;
      const offset = (index: number) => {
        const centre = grid.offsetLeft + grid.offsetWidth / 2;
        const card = cards[index]!;
        return Math.round((centre - (card.offsetLeft + card.offsetWidth / 2)) * TUCK);
      };
      cards.forEach((card, index) => {
        card.style.zIndex = String(10 - Math.round(Math.abs(index - mid) * 2));
      });
      gsap.fromTo(
        cards,
        { x: (index: number) => offset(index), rotation: (index: number) => ((index - mid) / mid) * TILT },
        {
          x: 0,
          rotation: 0,
          ease: "none",
          scrollTrigger: {
            trigger: grid,
            start: "top 88%",
            end: "top 38%",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        }
      );
      return () => {
        cards.forEach((card) => {
          card.style.zIndex = "";
        });
      };
    });
    ScrollTrigger.refresh();
    return () => mm.revert();
  }, [ref, layoutKey]);
}
