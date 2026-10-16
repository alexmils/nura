"use client";

import Link from "next/link";
import { BRAND_LIMITS_LINE } from "@/lib/brand";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import "./public-cluster.css";

export function EditorialView() {
  const copy = useSectionConfig("editorial-page");
  return (
    <article className="fe-cluster fe-has-edit" data-section="editorial-page">
      <SectionEdit id="editorial-page" lift />
      <div className="fe-cluster-inner">
        <p className="fe-cluster-kicker">{sectionText(copy, "kicker")}</p>
        <h1>{sectionText(copy, "title")}</h1>
        <p className="fe-cluster-dek">{sectionText(copy, "dek")}</p>

        <div className="fe-cluster-body">
          {sectionList(copy, "sections").map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <RichText text={section.body ?? ""} />
            </section>
          ))}
        </div>

        <p className="fe-cluster-note">
          {BRAND_LIMITS_LINE} <Link href="/limits">Read the limits</Link>.
        </p>
      </div>
    </article>
  );
}
