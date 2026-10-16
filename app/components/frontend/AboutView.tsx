"use client";

import Link from "next/link";
import { BRAND_LIMITS_LINE } from "@/lib/brand";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import "./public-cluster.css";

export function AboutView() {
  const copy = useSectionConfig("about-page");
  const sections = sectionList(copy, "sections");

  return (
    <article className="fe-cluster fe-has-edit" data-section="about-page">
      <SectionEdit id="about-page" lift />
      <div className="fe-cluster-inner">
        <p className="fe-cluster-kicker">{sectionText(copy, "kicker")}</p>
        <h1>{sectionText(copy, "title")}</h1>
        <p className="fe-cluster-dek">{sectionText(copy, "dek")}</p>

        <div className="fe-cluster-body">
          {sections.map((section, index) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <RichText text={section.body ?? ""} />
              {index === 0 ? <p>{BRAND_LIMITS_LINE}</p> : null}
            </section>
          ))}
        </div>

        <div className="fe-cluster-actions frontend-hero-actions">
          <Link href={sectionText(copy, "primaryHref")} className="frontend-btn-primary">
            {sectionText(copy, "primary")}
          </Link>
          <Link href={sectionText(copy, "secondaryHref")} className="frontend-btn-ghost">
            {sectionText(copy, "secondary")}
          </Link>
          <Link href={sectionText(copy, "tertiaryHref")} className="frontend-btn-ghost">
            {sectionText(copy, "tertiary")}
          </Link>
        </div>
      </div>
    </article>
  );
}
