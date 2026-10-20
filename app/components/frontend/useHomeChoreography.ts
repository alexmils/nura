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
 * how stages -> between    wipe     "Between sessions" unfolds from its top edge while its copy lifts in (the sticky track above is never transformed). Phones: stack
 * between -> languages     morph    both blocks shift into the languages colour and the language content rises out of it (no panel over a panel)
 * languages -> modes       morph    the languages surface shifts into the modes colour while the modes board rises in (phones: stack)
 * One effect per boundary: the old finale zoom and modes' SectionRise clip do not run on top of these.
 * modes -> session         lift     the held board settles back while session rises over it as a soft sheet (no circle)
 * session -> topics        halo     topics rises over the held session and its nura core leads: the halo around the logo grows, the core settles
 * topics -> stories        morph    the backdrop morphs to the stories colour, its content rises out of it (colour hand-off)
 * stories -> pricing       settle   calm sheet rise: stories eases back under a soft pricing-coloured wash while pricing rises over it, corners flattening
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
  const trustWrap = one(".v2-trust-wrap");
  if (trustWrap) gsap.set(trustWrap, { position: "relative", zIndex: 3 });

  // Video -> How page slide (desktop). The How section overlaps two viewports
  // of the video in CSS, so over the first of them the video screen is still
  // sticky. The video image exits left while a full-screen pale sheet and the
  // first stage's inner copy enter from the right and move left — a straight
  // horizontal page slide, no vertical drift. The sticky nav/panels are never
  // transformed; only the inner copy and a zero-height background layer move.
  if (!mobile) {
    const howSection = one(".fe-spath");
    const video = howSection?.previousElementSibling as HTMLElement | null;
    if (howSection && video?.classList.contains("fe-custom--video")) {
      const screen = video.querySelector<HTMLElement>(".fe-video-screen");
      const sheet = howSection.querySelector<HTMLElement>(".fe-spath-slide-bg");
      const curtain = howSection.querySelector<HTMLElement>(".fe-spath-slide-curtain");
      const edge = howSection.querySelector<HTMLElement>(".fe-spath-slide-edge");
      const nav = howSection.querySelector<HTMLElement>(".fe-spath-nav");
      const inner = howSection.querySelector<HTMLElement>(".fe-spath-panel .fe-spath-panel-inner");
      const vw = () => window.innerWidth;
      if (screen) scrub(screen, { x: 0 }, { x: () => -vw() }, howSection, "top top", "+=100%");
      if (sheet) scrub(sheet, { x: vw }, { x: 0 }, howSection, "top top", "+=100%");
      if (curtain) {
        scrub(
          curtain,
          { x: vw },
          { x: () => -curtain.offsetWidth },
          howSection,
          "top top",
          "+=100%"
        );
      }
      if (inner) scrub(inner, { x: vw }, { x: 0 }, howSection, "top top", "+=100%");
      if (nav) scrub(nav, { opacity: 0 }, { opacity: 1 }, howSection, "top top", "+=100%");
      if (edge) scrub(edge, { opacity: 1 }, { opacity: 0 }, howSection, "top top", "+=100%");
    }
  }

  // "How it works" tail: the stage track -> "Between sessions" -> languages -> modes.
  // Each part may be hidden in the editor; a missing or empty block skips its boundary.
  const finale = one(".fe-spath-finale");
  // "Between sessions" is its own section (home-how-between); its predecessor
  // is the sticky stage track inside home-how.
  const track = one(".fe-spath-panels");
  const kitSection = one(".fe-spath-kit-section");
  const kit = kitSection && kitSection.offsetHeight > window.innerHeight * 0.25 ? kitSection : null;
  const modesBox = one(".mo-section-rise");
  const finaleZoom = finale?.querySelector<HTMLElement>(".fe-spath-finale-zoom");
  if (mobile) handoff(track, finale, "stack", true);
  else if (track && finale) {
    // Curtain drop: the finale unfolds from its top edge instead of shrinking
    // into a rounded window. The sticky track above is never transformed.
    finale.setAttribute("data-mo-handoff", "wipe");
    scrub(
      finale,
      { "--finale-wipe": 100 } as gsap.TweenVars,
      { "--finale-wipe": 0 } as gsap.TweenVars,
      finale,
      "top 92%",
      "top 32%"
    );
    if (finaleZoom) {
      scrub(
        finaleZoom,
        { y: 34, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1 },
        finale,
        "top 92%",
        "top 42%"
      );
    }
    const finaleEdge = finale.querySelector<HTMLElement>(".fe-spath-finale-edge");
    if (finaleEdge) {
      scrub(finaleEdge, { opacity: 1 }, { opacity: 0 }, finale, "top 45%", "top 32%");
    }
  }
  if (mobile) handoff(finale, kit, "curve", true);
  else pinnedHandoff(finale, kit, "morph", { content: one(".fe-spath-kit"), morphY: 48 });
  if (mobile) handoff(kit, modesBox, "stack", true);
  else pinnedHandoff(kit, modesBox, "morph", { content: one(".v2-modes"), morphY: 64 });

  if (mobile) {
    // Phones: the light stack/curve hand-offs (no virtual pins on a moving toolbar).
    handoff(one(".v2-hero"), following(one(".v2-hero")), "stack", true);
    handoff(one(".v2-modes"), one(".v2-session"), "curve", true);
    handoff(one(".fe-topics"), one(".v2-stories"), "curve", true);
    handoff(one(".v2-stories"), one(".v2-pricing"), "stack", true);
    handoff(one(".v2-pricing"), one(".fe-faq"), "curve", true);
  } else {
    // Whatever follows the hero (the how intro, or an inserted section such as the poster).
    const afterHero = following(one(".v2-hero"));
    pinnedHandoff(one(".v2-hero"), afterHero, "zoom", { image: one(".v2-hero-photo"), content: one(".v2-hero-inner") });
    // The held hero stays above plain siblings for one viewport; the block after
    // the incoming one (the Heal poster behind the how intro) must stack above
    // it or its photo/strip bleeds through the join. The video screen pulled up
    // under the poster is the exception: it must stay BELOW the poster.
    const afterNext = afterHero?.nextElementSibling as HTMLElement | null;
    if (afterNext && !afterNext.classList.contains("fe-custom--video-under")) {
      gsap.set(afterNext, { position: getComputedStyle(afterNext).position === "static" ? "relative" : undefined, zIndex: 3 });
    }
    pinnedHandoff(one(".v2-modes"), one(".v2-session"), "lift");
    pinnedHandoff(one(".fe-topics"), one(".v2-stories"), "morph", { content: one(".v2-stories > .v2-container") });
    pinnedHandoff(one(".v2-stories"), one(".v2-pricing"), "settle");
    pinnedHandoff(one(".v2-pricing"), one(".fe-faq"), "curtain");
  }
  // Session -> topics on every screen: no overlay disc, the topics nura mark leads.
  pinnedHandoff(one(".v2-session"), one(".fe-topics"), "halo");
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