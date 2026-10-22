"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import Lenis from "lenis";
import { setLandingLenis } from "@/lib/landing-scroll";

/** Curevo + Scalient-style motion: Lenis smooth scroll, GSAP hero + scroll reveals. */
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      isA11yReduceMotionPreferred();
    if (reduced) {
      root.querySelectorAll(".fe-split-word, .fe-animate, .fe-display-word, .fe-about-word, .fe-spath-pair-card, .fe-topics-orbit, .v2-hero-kicker, .v2-hero-title-line, .v2-hero-sub, .v2-hero-actions, .v2-hero-trust").forEach((el) => {
        gsap.set(el, { clearProps: "all", opacity: 1, y: 0, x: 0, color: "" });
        el.classList.add("is-in");
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    let lenis: Lenis | null = null;
    let rafId = 0;
    /** Normal wheel speed. The edge catch drops it to zero, then restores it. */
    const WHEEL_MULTIPLIER = 0.9;

    lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: WHEEL_MULTIPLIER,
      // Nested panels (Need help chat) must keep their own wheel scroll.
      prevent: (node) =>
        Boolean(
          node instanceof Element &&
            node.closest(
              "[data-lenis-prevent], .help-drawer, .help-contact-modal, .help-drawer-body"
            )
        ),
    });
    setLandingLenis(lenis);

    lenis.on("scroll", ScrollTrigger.update);

    /* —— Section-edge catch ——
       Crossing into a new section stops taking wheel input for a beat
       (about 0.3s) before it lets go, so each boundary reads as an edge you
       push through. Freezing Lenis itself (stop/start) snapped the scroll
       mid-gesture and made the page judder; letting the wheel multiplier
       drop to zero lets the current glide settle smoothly instead. */
    const viewport = () => window.innerHeight;
    const layoutTop = (el: HTMLElement) => {
      let y = 0;
      let node: HTMLElement | null = el;
      while (node) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return y;
    };
    type Edge = { y: number; ms: number };
    /** A longer beat where the next boundary is a plain gradient seam. */
    const edgeHoldMs = (el: HTMLElement) =>
      el.matches(".fe-faq, .fe-blog") ? 620 : 300;
    let edges: Edge[] = [];
    const measureEdges = () => {
      edges = Array.from(
        document.querySelectorAll<HTMLElement>(".frontend-main section")
      )
        .filter((el) => el.offsetHeight > viewport() * 0.45)
        .map((el) => ({ y: layoutTop(el), ms: edgeHoldMs(el) }))
        .filter((e) => e.y > 0)
        .sort((a, b) => a.y - b.y)
        .filter((e, i, arr) => i === 0 || Math.abs(e.y - arr[i - 1]!.y) > 24);
    };
    measureEdges();
    let edgeTimer = 0;
    const scheduleEdges = () => {
      window.clearTimeout(edgeTimer);
      edgeTimer = window.setTimeout(measureEdges, 600);
    };
    const edgeMutations = new MutationObserver(scheduleEdges);
    edgeMutations.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleEdges);
    // Hand-offs add their hold runway as margins after the first measurement.
    ScrollTrigger.addEventListener("refresh", scheduleEdges);

    let previousScroll = lenis.scroll;
    let lastEdgeAt = 0;
    let catchUntil = 0;
    let lastWheelInput = 0;

    const releaseEdge = () => {
      if (!catchUntil) return;
      catchUntil = 0;
      if (lenis) lenis.options.wheelMultiplier = WHEEL_MULTIPLIER;
    };
    const onWheelBump = () => {
      lastWheelInput = performance.now();
    };
    const onScrollBump = () => {
      const y = lenis?.scroll ?? window.scrollY;
      if (y === previousScroll) return;
      const down = y > previousScroll;
      const lo = Math.min(previousScroll, y);
      const hi = Math.max(previousScroll, y);
      const edge = down
        ? edges.find((value) => value.y > lo && value.y <= hi)
        : [...edges].reverse().find((value) => value.y < hi && value.y >= lo);
      const now = performance.now();
      // One catch per 0.9s: a fast fling must not machine-gun the brake
      // through several sections in a row.
      if (
        edge !== undefined &&
        now - lastWheelInput < 700 &&
        now - lastEdgeAt > 900
      ) {
        lastEdgeAt = now;
        catchUntil = now + edge.ms;
        if (lenis) lenis.options.wheelMultiplier = 0;
      }
      previousScroll = y;
    };
    window.addEventListener("wheel", onWheelBump, { passive: true });
    lenis.on("scroll", onScrollBump);

    const raf = (time: number) => {
      if (catchUntil && time >= catchUntil) releaseEdge();
      lenis?.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    const ctx = gsap.context(() => {
      /* —— Hero load (SplitText-style word rise) —— */
      const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });
      heroTl
        .from(".fe-hero-kicker", { y: 20, opacity: 0, duration: 0.7 })
        .from(
          ".fe-hero .fe-split-word",
          { yPercent: 115, opacity: 0, stagger: 0.045, duration: 1.05 },
          "-=0.35"
        )
        .from(".fe-hero-description", { y: 28, opacity: 0, duration: 0.85 }, "-=0.55")
        .from(
          ".fe-hero-card-row > *",
          { y: 22, opacity: 0, stagger: 0.09, duration: 0.65 },
          "-=0.45"
        );

      gsap.to(".fe-hero-image-bg", {
        yPercent: 12,
        ease: "none",
        scrollTrigger: {
          trigger: ".fe-hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.2,
        },
      });

      /* —— Landing v2 hero: centered load + scroll parallax —— */
      const v2Hero = root.querySelector<HTMLElement>(".v2-hero");
      if (v2Hero) {
        const v2Tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        v2Tl
          .from(".v2-hero-kicker", { y: 20, opacity: 0, duration: 0.7 })
          .from(
            ".v2-hero-title-line",
            { y: 38, opacity: 0, stagger: 0.14, duration: 1.05 },
            "-=0.35"
          )
          .from(".v2-hero-sub", { y: 28, opacity: 0, duration: 0.85 }, "-=0.55")
          .from(".v2-hero-actions", { y: 22, opacity: 0, duration: 0.7 }, "-=0.45")
          .from(".v2-hero-trust", { y: 18, opacity: 0, duration: 0.6 }, "-=0.4");

        gsap.fromTo(
          ".v2-hero-photo-img",
          { yPercent: -4, scale: 1.08 },
          {
            yPercent: 4,
            scale: 1.08,
            ease: "none",
            scrollTrigger: {
              trigger: v2Hero,
              start: "top top",
              end: "bottom top",
              scrub: 1.2,
            },
          }
        );

        // The sun is a Default-background decoration only (absent with a custom background).
        const sun = v2Hero.querySelector(".v2-hero-sun");
        if (sun) gsap.to(sun, {
          yPercent: 16,
          ease: "none",
          scrollTrigger: {
            trigger: v2Hero,
            start: "top top",
            end: "bottom top",
            scrub: 1.6,
          },
        });
      }

      /* Keep overlay pinned to hero — do not translate (that strips the bottom filter). */
      /* —— Section stagger reveals —— */
      root.querySelectorAll<HTMLElement>(
        ".fe-section-block, .fe-pricing-section, .fe-spath, .fe-spath-kit, .fe-topics, .fe-pause, .fe-modes, .fe-memory, .fe-faq, .fe-blog, .v2-section, .v2-close"
      ).forEach((section) => {
        const items = [
          ...section.querySelectorAll<HTMLElement>(":scope .fe-animate"),
        ].filter((el) => {
          /* Plan cards are owned by usePlanSpread (Mindix stack -> spread). */
          if (el.closest(".v2-price-grid")) return false;
          /* Kit sits inside .fe-spath — do not play its copy at How it works start. */
          if (section.classList.contains("fe-spath") && el.closest(".fe-spath-kit")) {
            return false;
          }
          return true;
        });
        if (!items.length) return;
        gsap.from(items, {
          y: 56,
          opacity: 0,
          duration: 0.95,
          stagger: 0.11,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      });

      /* —— About title: scroll-scrub word color (Curevo) —— */
      const aboutTitle = root.querySelector<HTMLElement>(".fe-about-title");
      const aboutWords = root.querySelectorAll<HTMLElement>(".fe-about-word");
      if (aboutTitle && aboutWords.length) {
        gsap.set(aboutWords, { color: "rgba(42, 48, 32, 0.18)" });
        gsap.to(aboutWords, {
          color: "#2a3020",
          ease: "none",
          stagger: {
            each: 0.05,
            from: "start",
          },
          scrollTrigger: {
            trigger: aboutTitle,
            start: "top 80%",
            end: "bottom 42%",
            scrub: 0.65,
            invalidateOnRefresh: true,
          },
        });
      }

      /* —— Intro image clip reveal —— */
      gsap.from(".fe-intro-image-wrap", {
        clipPath: "inset(100% 0 0 0)",
        duration: 1.2,
        ease: "power4.inOut",
        scrollTrigger: { trigger: ".fe-intro", start: "top 75%" },
      });

      /* —— Scalient-style display words —— */
      gsap.from(".fe-display-word", {
        xPercent: (i) => (i === 0 ? -40 : 40),
        opacity: 0,
        duration: 1.35,
        stagger: 0.18,
        ease: "power4.out",
        scrollTrigger: { trigger: ".fe-display", start: "top 78%" },
      });

      /* —— Offer cards image scale —— */
      root.querySelectorAll<HTMLElement>(".fe-offer-card").forEach((card) => {
        gsap.from(card, {
          y: 40,
          opacity: 0,
          duration: 0.85,
          ease: "power2.out",
          scrollTrigger: { trigger: card, start: "top 88%" },
        });
      });

      /* —— Closing band (CTA inside footer) —— */
      gsap.from(".fe-site-footer-cta-sub, .fe-site-footer-cta-actions", {
        y: 28,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".fe-site-footer", start: "top 85%" },
      });

      const topicsOrbit = root.querySelector<HTMLElement>(".fe-topics-orbit");
      if (topicsOrbit) {
        // Fade only: scaling the ring read as a circle growing after the join.
        gsap.from(topicsOrbit, {
          y: 20,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".fe-topics-stage",
            start: "top 82%",
            toggleActions: "play none none none",
          },
          onComplete: () => {
            gsap.set(topicsOrbit, { clearProps: "transform" });
          },
        });
      }

      /* Session path duo is driven in SessionPathSticky (stage-local flip). */

      /* The finale's entrance now belongs to the stages -> "Between sessions" hand-off in useHomeChoreography (rounded rise on desktop, stack on phones). */

    }, root);

    return () => {
      cancelAnimationFrame(rafId);
      ctx.revert();
      setLandingLenis(null);
      window.removeEventListener("wheel", onWheelBump);
      window.removeEventListener("resize", scheduleEdges);
      edgeMutations.disconnect();
      ScrollTrigger.removeEventListener("refresh", scheduleEdges);
      window.clearTimeout(edgeTimer);
      releaseEdge();
      lenis?.destroy();
    };
  }, [rootRef]);
}
