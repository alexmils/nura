"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { MOTION_STAGGER } from "@/lib/motion";
import { arrive, handoff, scrub, useChoreography, type ChoreoContext } from "@/app/components/motion/choreography";

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => [...root.querySelectorAll<T>(sel)];

/**
 * Home (HomeLandingV2) scroll choreography, one named move per boundary so
 * neighbours differ. The topics ring, plans spread, footer wordmark, CTA
 * marquee and the sticky "How it works" path keep their own motion.
 *
 * Every boundary is a whole-section hand-off (see `handoff` in choreography.ts,
 * adapted from alexandermils' SectionHandoff "rise"):
 *
 * hero -> how it works     stack   how slides over; hero sinks, shrinks, dims (copy also recedes)
 * how it works -> modes    rise    SectionRise: inset rounded card opens to full bleed
 * modes -> session         curve   session's domed top flattens; modes sinks and dims
 * session -> topics        stack   topics slides over with rounded top; session shrinks and dims
 * topics -> stories        curve   stories' domed top flattens (topics stays still: it is pinned)
 * stories -> pricing       stack   pricing slides over; stories shrinks and dims
 * pricing -> faq           curve   faq's domed top flattens; pricing sinks and dims
 * faq -> blog              wipe    SectionWipe: mint wave veil lifts off (unchanged)
 * blog -> close            stack   close slides over; blog shrinks and dims
 *
 * Inside the sections: trust chips tick in, the modes board scales up, the
 * session frame settles, features alternate in, the story reel glides, FAQ
 * questions tick in, and the closing photo settles from 120%.
 */
export function buildHomeChoreography(ctx: ChoreoContext) {
  const { root, mobile } = ctx;
  const one = (sel: string) => root.querySelector<HTMLElement>(sel);
  one(".mo-section-rise")?.setAttribute("data-mo-handoff", "rise");
  one(".mo-swipe")?.setAttribute("data-mo-handoff", "wipe");
  const trustWrap = one(".v2-trust-wrap");
  if (trustWrap) gsap.set(trustWrap, { position: "relative", zIndex: 3 });
  handoff(one(".v2-hero"), one(".fe-spath"), "stack", mobile);
  handoff(one(".v2-modes"), one(".v2-session"), "curve", mobile);
  handoff(one(".v2-session"), one(".fe-topics"), "stack", mobile);
  handoff(one(".fe-topics"), one(".v2-stories"), "curve", mobile);
  handoff(one(".v2-stories"), one(".v2-pricing"), "stack", mobile);
  handoff(one(".v2-pricing"), one(".fe-faq"), "curve", mobile);
  handoff(one(".mo-swipe"), one(".v2-close"), "stack", mobile);

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