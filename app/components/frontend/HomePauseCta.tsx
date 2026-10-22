"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { sectionText } from "@/lib/marketing-sections";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./home-pause-cta.css";

export function HomePauseCta() {
  const copy = useSectionConfig("home-pause");
  return (
    <section className="fe-pause fe-has-edit" data-section="home-pause" aria-labelledby="fe-pause-title">
      <SectionEdit id="home-pause" />
      <div className="fe-container fe-pause-frame">
        <LetterRevealHeading id="fe-pause-title" className="fe-pause-title">
          {sectionText(copy, "title")}
        </LetterRevealHeading>
        <Link
          href={sectionText(copy, "ctaHref")}
          className="fe-pause-cta fe-animate"
        >
          {sectionText(copy, "cta")}
          <Plus size={16} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
