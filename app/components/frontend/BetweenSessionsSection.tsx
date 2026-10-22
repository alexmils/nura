"use client";

import Link from "next/link";
import { appPath } from "@/lib/app-base";
import { betweenTemplate, sectionText } from "@/lib/marketing-sections";
import { AccentText } from "./AccentText";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./session-path-sticky.css";

/**
 * "Between sessions" closing frame, a section of its own in the page layout
 * (it used to be the tail of the how-it-works component). Keeps the
 * `fe-spath-finale` classes so the stages -> between rounded rise and the
 * between -> languages curve hand-offs still target the same box.
 */
export function BetweenSessionsSection() {
  const between = useSectionConfig("home-how-between");
  const tpl = betweenTemplate(between);

  return (
    // The shell carries the stage's pale sheet so the section's wipe slit
    // reveals that colour, not the page canvas, while it opens.
    <div className="fe-between-shell">
      <section
        className={`fe-spath-finale fe-has-edit fe-between--tpl-${tpl}`}
        data-section="home-how-between"
        aria-labelledby="fe-between-title"
      >
        <SectionEdit id="home-how-between" />
        <div className="fe-spath-finale-zoom">
          <div className="fe-container fe-spath-finale-inner">
            <p className="fe-spath-finale-kicker">{sectionText(between, "betweenKicker")}</p>
            <h3 id="fe-between-title" className="fe-spath-finale-title">
              <AccentText
                text={sectionText(between, "betweenTitle")}
                accent={sectionText(between, "betweenAccent")}
              />
            </h3>
            <p className="fe-spath-finale-line">
              {sectionText(between, "betweenLine")}
            </p>
            <Link
              href={sectionText(between, "betweenCtaHref") || appPath("/create-account")}
              className="fe-spath-cta frontend-btn-ghost"
            >
              {sectionText(between, "betweenCta")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
