"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { MOTION_STAGGER } from "@/lib/motion";
import { arrive, handoff, scrub, useChoreography, type ChoreoContext } from "@/app/components/motion/choreography";
import { following, pinnedHandoff } from "@/app/components/motion/pinned-handoffs";

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => [...root.querySelectorAll<T>(sel)];

/**
 * Home (HomeLandingV2) scroll choreography, one named move per boundary so
 * neighbours differ. The topics ring, plans spread, footer wordmark, CTA
 * marquee and the sticky "How it works" path keep their own motion.
 *
 * Desktop: every boundary is a different pinned hand-off (pinned-handoffs.ts),
 * each a port of an alexandermils mechanism (D:\Python\alexandermils):
 *
 * hero -> next section     zoom     hero photo pushes in to 145% and darkens while How rises over the held hero (SectionHandoff "zoom")
 * how it works -> modes    rise     SectionRise: inset rounded card opens to full bleed (HomeJournalSection rounded rise)
 * modes -> session         iris     session opens through a growing circle over the held board (SectionHandoff "iris")
 * session -> topics        bloom    once session is mostly past, one viewport-fixed disc in topics' colour grows from the play button, floods the screen and dissolves into topics (ScrollBloom)
 * topics -> stories        morph    the backdrop morphs to the stories colour, its content rises out of it (colour hand-off)
 * stories -> pricing       slide    stories drifts left and dims, pricing sweeps in behind a lime edge (HomeProcessAbout slide)
 * pricing -> faq           curtain  a rising edge with a lime rule cuts pricing away, FAQ pinned underneath (CurtainPin)
 * faq -> blog              (none)   plain hand-off; the old mint wave band was removed
 * blog -> close            lens     the closing CTA emerges out of the nearest visible blog card (its rect and aspect) and grows to full screen, copy fades in last (Aperture / lens)
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
  const trustWrap = one(".v2-trust-wrap");
  if (trustWrap) gsap.set(trustWrap, { position: "relative", zIndex: 3 });
  if (mobile) {
    // Phones: the light stack/curve hand-offs (no virtual pins on a moving toolbar).
    handoff(one(".v2-hero"), following(one(".v2-hero")), "stack", true);
    handoff(one(".v2-modes"), one(".v2-session"), "curve", true);
    handoff(one(".fe-topics"), one(".v2-stories"), "curve", true);
    handoff(one(".v2-stories"), one(".v2-pricing"), "stack", true);
    handoff(one(".v2-pricing"), one(".fe-faq"), "curve", true);
  } else {
    // Whatever follows the hero (How it works, or an inserted section such as the poster).
    pinnedHandoff(one(".v2-hero"), following(one(".v2-hero")), "zoom", { image: one(".v2-hero-photo"), content: one(".v2-hero-inner") });
    pinnedHandoff(one(".v2-modes"), one(".v2-session"), "iris");
    pinnedHandoff(one(".fe-topics"), one(".v2-stories"), "morph", { content: one(".v2-stories > .v2-container") });
    pinnedHandoff(one(".v2-stories"), one(".v2-pricing"), "slide");
    pinnedHandoff(one(".v2-pricing"), one(".fe-faq"), "curtain");
  }
  // Session -> topics on every screen: one viewport-fixed disc, no seam.
  pinnedHandoff(one(".v2-session"), one(".fe-topics"), "bloom", { origin: () => one(".v2-video-play") ?? one(".v2-video-frame") });
  // Blog -> close on every screen: the CTA comes out of a real post card.
  pinnedHandoff(one(".fe-blog"), one(".v2-close"), "lens", {
    image: one(".v2-close-img"),
    content: one(".v2-close-inner"),
    from: () => q<HTMLElement>(root, ".fe-blog .fe-blog-masonry-card"),
  });

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