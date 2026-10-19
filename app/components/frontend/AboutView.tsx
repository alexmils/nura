"use client";

import Link from "next/link";
import { BRAND_LIMITS_LINE } from "@/lib/brand";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { EditablePart } from "@/app/components/frontend/section-editor/EditablePart";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import "./public-cluster.css";

export function AboutView() {
  const copy = useSectionConfig("about-page");
  const body = useSectionConfig("about-sections");
  const actions = useSectionConfig("about-actions");
  const sections = sectionList(body, "sections");

  return (
    <article className="fe-cluster" data-section="about-page">
      <div className="fe-cluster-inner">
        <EditablePart id="about-page" lift>
          <p className="fe-cluster-kicker">{sectionText(copy, "kicker")}</p>
          <h1>{sectionText(copy, "title")}</h1>
          <p className="fe-cluster-dek">{sectionText(copy, "dek")}</p>
        </EditablePart>

        <EditablePart id="about-sections">
        <div className="fe-cluster-body">
          {sections.map((section, index) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <RichText text={section.body ?? ""} />
              {index === 0 ? <p>{BRAND_LIMITS_LINE}</p> : null}
            </section>
          ))}
        </div>
        </EditablePart>

        <EditablePart id="about-actions">
        <div className="fe-cluster-actions frontend-hero-actions">
          <Link href={sectionText(actions, "primaryHref")} className="frontend-btn-primary">
            {sectionText(actions, "primary")}
          </Link>
          <Link href={sectionText(actions, "secondaryHref")} className="frontend-btn-ghost">
            {sectionText(actions, "secondary")}
          </Link>
          <Link href={sectionText(actions, "tertiaryHref")} className="frontend-btn-ghost">
            {sectionText(actions, "tertiary")}
          </Link>
        </div>
        </EditablePart>
      </div>
    </article>
  );
}
