"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { blogCategoryBySlug } from "@/lib/blog-categories";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./session-topics-grid.css";

const CORE_LOGO = "/brand/nura-circle-variants/O-mint-on-ink.png";

/** Desktop ring: topics emerge from the centre and spread out as you scroll. */
const EMERGE_QUERY = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** Phone grid: a short staggered reveal instead of the ring. */
const STAGGER_QUERY = "(max-width: 860px) and (prefers-reduced-motion: no-preference)";

/**
 * Scroll-scrubbed "emerge" (after Insurily's key-features band): the section
 * is a tall track with a sticky frame; one CSS variable, --topics-emerge (0 to 1),
 * drives the radius, scale and fade of every topic on the ring, so only
 * transform and opacity change. Without JS, with reduced motion, or on phones
 * the variable stays at 1: the static final layout.
 */
function useTopicsEmerge(
  sectionRef: React.RefObject<HTMLElement | null>,
  orbitRef: React.RefObject<HTMLDivElement | null>,
  count: number
) {
  useEffect(() => {
    const section = sectionRef.current;
    const orbit = orbitRef.current;
    if (!section || !orbit || isA11yReduceMotionPreferred()) return;

    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(EMERGE_QUERY, () => {
      gsap.fromTo(
        orbit,
        { "--topics-emerge": 0 },
        {
          "--topics-emerge": 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 45%",
            end: "top -65%",
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        }
      );
    });
    mm.add(STAGGER_QUERY, () => {
      gsap.from(orbit.querySelectorAll(".fe-topics-link"), {
        opacity: 0,
        y: 24,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.06,
        scrollTrigger: { trigger: orbit, start: "top 85%", once: true },
      });
    });
    ScrollTrigger.refresh();
    return () => mm.revert();
  }, [sectionRef, orbitRef, count]);
}

export function SessionTopicsGrid({
  id,
  className,
}: {
  id?: string;
  className?: string;
} = {}) {
  const copy = useSectionConfig("home-topics");
  // Shown topics in the admin's order; hidden ones leave the ring and the rest re-space.
  const topics = sectionList(copy, "topics").flatMap((item) => {
    const category = item.id ? blogCategoryBySlug(item.id) : null;
    return category ? [{ slug: category.slug, name: item.label?.trim() || category.name }] : [];
  });
  const count = topics.length;
  const sectionRef = useRef<HTMLElement | null>(null);
  const orbitRef = useRef<HTMLDivElement | null>(null);
  useTopicsEmerge(sectionRef, orbitRef, count);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`fe-topics fe-topics--emerge fe-has-edit${className ? ` ${className}` : ""}`}
      data-section="home-topics"
      aria-labelledby="fe-topics-title"
    >
      <SectionEdit id="home-topics" />
      <div className="fe-container fe-topics-frame">
        <div className="fe-topics-head">
          <LetterRevealHeading id="fe-topics-title" className="fe-topics-title">
            {sectionText(copy, "title")}
          </LetterRevealHeading>
          <p className="fe-section-kicker fe-topics-kicker fe-animate">{sectionText(copy, "kicker")}</p>
        </div>

        <div className="fe-topics-stage">
          <div className="fe-topics-orbit" ref={orbitRef}>
            <div className="fe-topics-glow" aria-hidden />
            <div className="fe-topics-ring fe-topics-ring--outer" aria-hidden />
            <div className="fe-topics-ring fe-topics-ring--mid" aria-hidden />

            <div className="fe-topics-core" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element -- circle lockup asset; avoid srcset bloat */}
              <img
                className="fe-topics-core-logo"
                src={CORE_LOGO}
                alt=""
                width={512}
                height={512}
                decoding="async"
                loading="lazy"
              />
            </div>

            <ul
              className="fe-topics-spin"
              style={{ ["--topics-n" as string]: count }}
            >
              {topics.map((category, index) => (
                <li
                  key={category.slug}
                  className="fe-topics-item"
                  style={{ ["--topics-i" as string]: index }}
                >
                  <span className="fe-topics-counter">
                    <Link
                      href={`/blog/category/${category.slug}`}
                      className="fe-topics-link"
                    >
                      {category.name}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link href={sectionText(copy, "moreHref")} className="fe-topics-more fe-animate">
            {sectionText(copy, "more")}
            <span className="fe-topics-more-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
