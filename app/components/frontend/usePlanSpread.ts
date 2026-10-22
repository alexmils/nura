"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import "./plan-spread.css";

/** Side-by-side cards only; phones keep the stacked list. */
const SPREAD_QUERY = "(min-width: 901px) and (prefers-reduced-motion: no-preference)";

/**
 * Mindix's pricing interaction, read from its Webflow IX3 data
 * (mindix-template.webflow.io, interaction i-5092b1fd -> timeline t-a73152fe):
 *   trigger  .price-section, start "top 50%", enter: play (once, no reverse)
 *   .price-widget.one    x 250px -> 0, y 20px -> 0, rotation -10deg -> 0
 *   .price-widget.three  x -250px -> 0, y 20px -> 0, rotation 10deg -> 0
 *   middle card static; duration 0.4s; ease index 0 = "none" (linear)
 */
export const MINDIX_SPREAD = { x: 250, y: 20, rotation: 10, duration: 0.4, ease: "none", start: 0.5 } as const;

/** Document top of an element from layout (offsets ignore transforms such as section hand-offs). */
function layoutTop(el: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
}

/**
 * Plan cards come out of one another: the side cards start stacked on the
 * centre card (shifted toward it by up to 250px, 20px lower, tilted 10deg
 * outward) and spread to their places with Mindix's exact values when the grid
 * reaches the middle of the screen. Plays once, x/y/rotation only. The start
 * point is measured from layout, so the pricing section's own hand-off (which
 * holds it with transforms while it is swept in) cannot fire it while hidden.
 * Any number of shown cards, in any order, fans from the centre.
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
      const reach = Math.max(1, mid);
      const centre = () => grid.offsetLeft + grid.offsetWidth / 2;
      const gap = (index: number) => {
        const card = cards[index]!;
        return centre() - (card.offsetLeft + card.offsetWidth / 2);
      };
      const fromX = (index: number) => {
        const d = gap(index);
        return Math.sign(d) * Math.min(Math.abs(d), MINDIX_SPREAD.x * Math.abs(index - mid));
      };
      cards.forEach((card, index) => {
        card.style.zIndex = String(10 - Math.round(Math.abs(index - mid) * 2));
      });
      const tween = gsap.fromTo(
        cards,
        {
          x: (index: number) => fromX(index),
          y: (index: number) => (Math.abs(index - mid) < 0.01 ? 0 : MINDIX_SPREAD.y),
          rotation: (index: number) => ((index - mid) / reach) * MINDIX_SPREAD.rotation,
        },
        { x: 0, y: 0, rotation: 0, duration: MINDIX_SPREAD.duration, ease: MINDIX_SPREAD.ease, paused: true }
      );
      ScrollTrigger.create({
        trigger: grid,
        start: () => layoutTop(grid) - window.innerHeight * MINDIX_SPREAD.start,
        end: "max",
        once: true,
        onEnter: () => tween.play(),
      });
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