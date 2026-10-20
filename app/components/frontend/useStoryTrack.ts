"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";

/** Desktop only; phones keep the native horizontal swipe. */
const SCROLL_QUERY = "(min-width: 901px) and (prefers-reduced-motion: no-preference)";

/** Viewport width minus the container's max width, used for the track alignment. */
const trackOverflow = (track: HTMLElement) =>
  Math.max(0, track.scrollWidth - window.innerWidth);

/**
 * Stories strip, ported from the SoulSpace testimonial section: the section
 * gains one pixel of scroll runway per pixel the track overflows, its stage
 * sticks to the viewport and the row slides left 1:1 with the scroll. Every
 * card stays at full opacity; there is no active/prev/next state.
 *
 * Below 901px (or with reduced motion) nothing is pinned and the strip stays a
 * normal horizontally scrollable row.
 */
export function useStoryTrack(
  sectionRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLElement | null>,
  layoutKey: string
) {
  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track || isA11yReduceMotionPreferred()) return;

    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(SCROLL_QUERY, () => {
      const setRunway = () => {
        const distance = trackOverflow(track);
        section.style.setProperty("--story-runway", `${distance}px`);
        section.classList.toggle("is-story-scroll", distance > 0);
      };

      setRunway();

      const tween = gsap.fromTo(
        track,
        { x: 0 },
        {
          x: () => -trackOverflow(track),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${Math.max(1, trackOverflow(track))}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );

      // Re-measure before every refresh (resize, section hand-offs, editor
      // reorders) so the runway always matches the current card widths.
      ScrollTrigger.addEventListener("refreshInit", setRunway);
      ScrollTrigger.refresh();

      // Web fonts change the card widths after mount.
      document.fonts?.ready.then(() => ScrollTrigger.refresh());

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", setRunway);
        tween.scrollTrigger?.kill();
        tween.kill();
        section.style.removeProperty("--story-runway");
        section.classList.remove("is-story-scroll");
        gsap.set(track, { clearProps: "transform" });
      };
    });

    return () => mm.revert();
  }, [sectionRef, trackRef, layoutKey]);
}
