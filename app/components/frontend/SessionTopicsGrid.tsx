"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isA11yReduceMotionPreferred } from "@/lib/a11y-preferences";
import { blogCategoryBySlug } from "@/lib/blog-categories";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./session-topics-grid.css";

const CORE_LOGO = "/brand/nura-circle-variants/O-mint-on-ink.png";

/** Desktop ring: topics emerge from the centre and spread out as you scroll. */
const EMERGE_QUERY = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** Phones: the same ring, scaled down; topics fly out once when it comes into view. */
const PHONE_QUERY = "(max-width: 860px) and (prefers-reduced-motion: no-preference)";

/**
 * Scroll-scrubbed "emerge" (after Insurily's key-features band): the section
 * is a tall track with a sticky frame; one CSS variable, --topics-emerge (0 to 1),
 * drives the radius, scale and fade of every topic on the ring, so only
 * transform and opacity change. Phones run the same ring at a smaller scale
 * with a one-off timed emerge. Without JS or with reduced motion the variable
 * stays at 1: the static final ring.
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
    mm.add(PHONE_QUERY, () => {
      gsap.fromTo(
        orbit,
        { "--topics-emerge": 0 },
        {
          "--topics-emerge": 1,
          duration: 1.4,
          ease: "power3.out",
          scrollTrigger: { trigger: orbit, start: "top 80%", once: true },
        }
      );
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
  const moreLabel = sectionText(copy, "more") || "Read the guides";
  const moreHref = sectionText(copy, "moreHref") || "/blog";
  // Same head treatment as the other home sections: kicker, title with the
  // green italic accent, then a subline.
  const title = sectionText(copy, "title");
  const accent = sectionText(copy, "accent");
  const sub = sectionText(copy, "sub");
  const accentAt = accent ? title.indexOf(accent) : -1;
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
        <div className="fe-topics-head fe-animate">
          <p className="fe-section-kicker fe-topics-kicker">{sectionText(copy, "kicker")}</p>
          <h2 id="fe-topics-title" className="fe-topics-title">
            {accentAt >= 0 ? (
              <>
                {title.slice(0, accentAt)}
                <em className="fe-topics-em">{accent}</em>
                {title.slice(accentAt + accent.length)}
              </>
            ) : (
              title
            )}
          </h2>
          {sub ? <p className="fe-topics-sub">{sub}</p> : null}
        </div>

        <div className="fe-topics-stage">
          <div className="fe-topics-orbit" ref={orbitRef}>
            <div className="fe-topics-glow" aria-hidden />
            <div className="fe-topics-ring fe-topics-ring--outer" aria-hidden />
            <div className="fe-topics-ring fe-topics-ring--mid" aria-hidden />

            <Link
              href={moreHref}
              className="fe-topics-core"
              aria-label={moreLabel}
            >
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
              <span className="fe-topics-core-label" aria-hidden>
                {moreLabel}
                <span className="fe-topics-core-arrow">→</span>
              </span>
            </Link>

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

        </div>
      </div>
    </section>
  );
}
