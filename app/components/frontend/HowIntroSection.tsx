"use client";

import { sectionText } from "@/lib/marketing-sections";
import { SectionEdit } from "./section-editor/SectionEdit";
import { SectionBackdrop } from "./section-editor/EditablePart";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./session-path-sticky.css";

/**
 * "How it works" intro, split out of the sticky how-it-works component so it
 * can sit above the Heal poster. It is a separate layout section but styled to
 * flow straight into the poster (no gap, same top tone), so the two read as
 * one block. Keeps reading `home-how` copy so saved edits survive.
 */
export function HowIntroSection() {
  const copy = useSectionConfig("home-how");

  return (
    <SectionBackdrop id="home-how">
      <section
        id="how-it-works"
        className="fe-spath-intro-section fe-has-edit"
        data-section="home-how-intro"
        aria-labelledby="fe-how-intro-title"
      >
        <SectionEdit id="home-how" />
        <div className="fe-container fe-spath-intro">
          <p className="fe-spath-badge">{sectionText(copy, "badge")}</p>
          <h2 id="fe-how-intro-title" className="fe-spath-intro-title">
            <span className="fe-spath-intro-fade fe-spath-intro-fade--1">
              {sectionText(copy, "intro1")}{" "}
            </span>
            <span className="fe-spath-intro-fade fe-spath-intro-fade--2">
              {sectionText(copy, "intro2")}{" "}
            </span>
            <span className="fe-spath-intro-fade fe-spath-intro-fade--3">
              {sectionText(copy, "intro3")}
            </span>
          </h2>
        </div>
      </section>
    </SectionBackdrop>
  );
}
