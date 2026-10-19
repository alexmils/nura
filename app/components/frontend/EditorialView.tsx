"use client";

import Link from "next/link";
import { BRAND_LIMITS_LINE } from "@/lib/brand";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { EditablePart } from "@/app/components/frontend/section-editor/EditablePart";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import "./public-cluster.css";

export function EditorialView() {
  const copy = useSectionConfig("editorial-page");
  const body = useSectionConfig("editorial-sections");
  return (
    <article className="fe-cluster" data-section="editorial-page">
      <div className="fe-cluster-inner">
        <EditablePart id="editorial-page" lift>
          <p className="fe-cluster-kicker">{sectionText(copy, "kicker")}</p>
          <h1>{sectionText(copy, "title")}</h1>
          <p className="fe-cluster-dek">{sectionText(copy, "dek")}</p>
        </EditablePart>

        <EditablePart id="editorial-sections">
        <div className="fe-cluster-body">
          {sectionList(body, "sections").map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <RichText text={section.body ?? ""} />
            </section>
          ))}
        </div>
        </EditablePart>

        <p className="fe-cluster-note">
          {BRAND_LIMITS_LINE} <Link href="/limits">Read the limits</Link>.
        </p>
      </div>
    </article>
  );
}
