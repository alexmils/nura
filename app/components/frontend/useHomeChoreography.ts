"use client";

import type { RefObject } from "react";
import { MOTION_STAGGER } from "@/lib/motion";
import { arrive, scrub, useChoreography, type ChoreoContext } from "@/app/components/motion/choreography";

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => [...root.querySelectorAll<T>(sel)];

/**
 * Home (HomeLandingV2) scroll choreography, one named move per boundary so
 * neighbours differ. The topics ring, plans spread, footer wordmark, CTA
 * marquee and the sticky "How it works" path keep their own motion.
 *
 * hero        recede   copy lifts and fades as the hero scrolls away
 * trust       chips    glass bar settles, chips tick in one by one
 * modes       rise     (SectionRise in JSX) + the board scales up from 94%
 * session     settle   video frame grows from 90%, glow drifts, features alternate in
 * stories     glide    the story reel slides in from the right
 * faq         ticker   questions slide in from the left
 * blog        wipe     (SectionWipe in JSX, unchanged)
 * close       zoom     meadow photo settles from 120% while the card rises
 */
export function buildHomeChoreography(ctx: ChoreoContext) {
  const { root, mobile } = ctx;
  const tag = (sel: string, name: string) => root.querySelector(sel)?.setAttribute("data-mo-handoff", name);
  tag(".v2-hero", "recede");
  tag(".v2-trust", "chips");
  tag(".v2-modes", "rise");
  tag(".v2-session", "settle");
  tag(".v2-stories", "glide");
  tag(".fe-faq", "ticker");
  tag(".v2-close", "zoom");

  const trust = root.querySelector(".v2-trust");
  if (trust) {
    arrive([trust], { scale: 0.96, opacity: 0 }, ctx, { start: "top 95%" });
    arrive(q(trust, ".v2-trust-chips > li"), { y: 14, opacity: 0 }, ctx, { start: "top 95%", stagger: MOTION_STAGGER.base });
  }

  const features = q(root, ".v2-app-features > li");
  if (features.length) {
    arrive(features, { x: (i: number) => (i % 2 ? 28 : -28), opacity: 0 } as gsap.TweenVars, ctx, {
      start: "top 92%",
      stagger: MOTION_STAGGER.loose,
    });
  }

  const faqItems = q(root, ".fe-faq .fe-faq-item");
  if (faqItems.length) arrive(faqItems, { x: -32 }, ctx, { start: "top 90%", stagger: MOTION_STAGGER.base * 1.5 });

  if (mobile) return;

  const hero = root.querySelector(".v2-hero");
  const heroInner = root.querySelector(".v2-hero-inner");
  if (hero && heroInner) scrub(heroInner, { y: 0, opacity: 1 }, { y: -110, opacity: 0.15 }, hero, "top top", "bottom 15%");

  const modes = root.querySelector(".v2-modes");
  const board = root.querySelector(".v2-modes-board");
  if (modes && board) scrub(board, { y: 70, scale: 0.94 }, { y: 0, scale: 1 }, modes, "top 95%", "top 25%");

  const session = root.querySelector(".v2-session");
  const frame = root.querySelector(".v2-video-frame");
  if (session && frame) scrub(frame, { scale: 0.9 }, { scale: 1 }, frame, "top bottom", "top 40%");
  const glow = root.querySelector(".v2-app-glow");
  if (session && glow) scrub(glow, { yPercent: 18 }, { yPercent: -18 }, session, "top bottom", "bottom top");

  const reel = root.querySelector(".v2-story-slider");
  if (reel) scrub(reel, { xPercent: 9, opacity: 0.25 }, { xPercent: 0, opacity: 1 }, reel, "top bottom", "top 50%");

  const close = root.querySelector(".v2-close");
  const closeImg = root.querySelector(".v2-close-img");
  if (close && closeImg) scrub(closeImg, { scale: 1.2 }, { scale: 1 }, close, "top bottom", "top top");
}

export function useHomeChoreography(rootRef: RefObject<HTMLElement | null>) {
  useChoreography(() => rootRef.current, buildHomeChoreography, "home");
}