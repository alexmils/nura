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
      root.querySelectorAll(".fe-split-word, .fe-animate, .fe-display-word, .fe-about-word, .fe-spath-pair-card, .fe-topics-card, .fe-topics-cta").forEach((el) => {
        gsap.set(el, { clearProps: "all", opacity: 1, y: 0, x: 0, color: "" });
        el.classList.add("is-in");
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    let lenis: Lenis | null = null;
    let rafId = 0;

    lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 0.9,
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

    const raf = (time: number) => {
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

      /* Keep overlay pinned to hero — do not translate (that strips the bottom filter). */
      /* —— Section stagger reveals —— */
      root.querySelectorAll<HTMLElement>(
        ".fe-section-block, .fe-pricing-section, .fe-spath, .fe-spath-kit, .fe-topics, .fe-pause, .fe-modes, .fe-memory, .fe-faq, .fe-blog"
      ).forEach((section) => {
        const items = [
          ...section.querySelectorAll<HTMLElement>(":scope .fe-animate"),
        ].filter((el) => {
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

      const topicTiles = root.querySelectorAll<HTMLElement>(
        ".fe-topics-card, .fe-topics-cta"
      );
      if (topicTiles.length) {
        gsap.from(topicTiles, {
          y: 28,
          opacity: 0,
          duration: 0.7,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".fe-topics-grid",
            start: "top 82%",
            toggleActions: "play none none none",
          },
          onComplete: () => {
            gsap.set(topicTiles, { clearProps: "transform" });
          },
        });
      }

      /* Session path duo is driven in SessionPathSticky (stage-local flip). */

      /* —— Self-guided finale: far → zoom in on scroll —— */
      const finaleZoom = root.querySelector<HTMLElement>(".fe-spath-finale-zoom");
      const finale = root.querySelector<HTMLElement>(".fe-spath-finale");
      if (finale && finaleZoom) {
        gsap.fromTo(
          finaleZoom,
          {
            scale: 0.62,
            y: 96,
            rotateX: 9,
            opacity: 0.38,
            filter: "blur(10px)",
          },
          {
            scale: 1,
            y: 0,
            rotateX: 0,
            opacity: 1,
            filter: "blur(0px)",
            ease: "none",
            scrollTrigger: {
              trigger: finale,
              start: "top 92%",
              end: "top 28%",
              scrub: 0.85,
              invalidateOnRefresh: true,
            },
          }
        );
      }

    }, root);

    return () => {
      cancelAnimationFrame(rafId);
      ctx.revert();
      setLandingLenis(null);
      lenis?.destroy();
    };
  }, [rootRef]);
}
