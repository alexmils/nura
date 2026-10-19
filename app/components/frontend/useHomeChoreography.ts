"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { MOTION_STAGGER } from "@/lib/motion";
import { arrive, handoff, scrub, useChoreography, type ChoreoContext } from "@/app/components/motion/choreography";
import { pinnedHandoff } from "@/app/components/motion/pinned-handoffs";

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => [...root.querySelectorAll<T>(sel)];

/**
 * Home (HomeLandingV2) scroll choreography, one named move per boundary so
 * neighbours differ. The topics ring, plans spread, footer wordmark, CTA
 * marquee and the sticky "How it works" path keep their own motion.
 *
 * Desktop: every boundary is a different pinned hand-off (pinned-handoffs.ts),
 * each a port of an alexandermils mechanism (D:\Python\alexandermils):
 *
 * hero -> how it works     zoom     hero photo pushes in to 145% and darkens while How rises over the held hero (SectionHandoff "zoom")
 * how it works -> modes    rise     SectionRise: inset rounded card opens to full bleed (HomeJournalSection rounded rise)
 * modes -> session         iris     session opens through a growing circle over the held board (SectionHandoff "iris")
 * session -> topics        bloom    a disc in topics' colour grows from the play button and floods the frame (ScrollBloom)
 * topics -> stories        morph    the backdrop morphs to the stories colour, its content rises out of it (colour hand-off)
 * stories -> pricing       slide    stories drifts left and dims, pricing sweeps in behind a lime edge (HomeProcessAbout slide)
 * pricing -> faq           curtain  a rising edge with a lime rule cuts pricing away, FAQ pinned underneath (CurtainPin)
 * faq -> blog              wipe     SectionWipe: mint wave veil lifts off (unchanged)
 * blog -> close            lens     the closing photo opens from a small rounded window to full bleed (Aperture / lens)
 *
 * Phones: the lighter stack/curve hand-offs (choreography.ts `handoff`).
 * A pair only animates while its two sections are still neighbours, so editor
 * reorders, hides and inserted sections never produce a wrong hold.
 *
 * Inside the sections: trust chips tick in, the modes board scales up, the
 * session frame settles, features alternate in and FAQ questions tick in.
 */
export function buildHomeChoreography(ctx: ChoreoContext) {
  const { root, mobile } = ctx;
  const one = (sel: string) => root.querySelector<HTMLElement>(sel);
  one(".mo-section-rise")?.setAttribute("data-mo-handoff", "rise");
  one(".mo-swipe")?.setAttribute("data-mo-handoff", "wipe");
  const trustWrap = one(".v2-trust-wrap");
  if (trustWrap) gsap.set(trustWrap, { position: "relative", zIndex: 3 });
  if (mobile) {
    // Phones: the light stack/curve hand-offs (no virtual pins on a moving toolbar).
    handoff(one(".v2-hero"), one(".fe-spath"), "stack", true);
    handoff(one(".v2-modes"), one(".v2-session"), "curve", true);
    handoff(one(".v2-session"), one(".fe-topics"), "stack", true);
    handoff(one(".fe-topics"), one(".v2-stories"), "curve", true);
    handoff(one(".v2-stories"), one(".v2-pricing"), "stack", true);
    handoff(one(".v2-pricing"), one(".fe-faq"), "curve", true);
    handoff(one(".mo-swipe"), one(".v2-close"), "stack", true);
  } else {
    pinnedHandoff(one(".v2-hero"), one(".fe-spath"), "zoom", { image: one(".v2-hero-photo"), content: one(".v2-hero-inner") });
    pinnedHandoff(one(".v2-modes"), one(".v2-session"), "iris");
    pinnedHandoff(one(".v2-session"), one(".fe-topics"), "bloom", { origin: () => one(".v2-video-play") ?? one(".v2-video-frame") });
    pinnedHandoff(one(".fe-topics"), one(".v2-stories"), "morph", { content: one(".v2-stories > .v2-container") });
    pinnedHandoff(one(".v2-stories"), one(".v2-pricing"), "slide");
    pinnedHandoff(one(".v2-pricing"), one(".fe-faq"), "curtain");
    pinnedHandoff(one(".mo-swipe"), one(".v2-close"), "lens", { image: one(".v2-close-img") });
  }

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

  const modes = root.querySelector(".v2-modes");
  const board = root.querySelector(".v2-modes-board");
  if (modes && board) scrub(board, { y: 70, scale: 0.94 }, { y: 0, scale: 1 }, modes, "top 95%", "top 25%");

  const session = root.querySelector(".v2-session");
  const frame = root.querySelector(".v2-video-frame");
  if (session && frame) scrub(frame, { scale: 0.9 }, { scale: 1 }, frame, "top bottom", "top 40%");
  const glow = root.querySelector(".v2-app-glow");
  if (session && glow) scrub(glow, { yPercent: 18 }, { yPercent: -18 }, session, "top bottom", "bottom top");

}

export function useHomeChoreography(rootRef: RefObject<HTMLElement | null>) {
  useChoreography(() => rootRef.current, buildHomeChoreography, "home");
}