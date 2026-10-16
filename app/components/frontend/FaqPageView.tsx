"use client";

import Link from "next/link";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";

export function FaqPageView() {
  const copy = useSectionConfig("faq-page");
  return (
    <article className="frontend-legal frontend-legal--long fe-has-edit" data-section="faq-page">
      <SectionEdit id="faq-page" lift />
      <h1>{sectionText(copy, "title")}</h1>
      <RichText text={sectionText(copy, "lead")} />

      <dl className="frontend-legal-faq">
        {sectionList(copy, "items").map((item) => (
          <div key={item.q}>
            <h2>{item.q}</h2>
            <RichText text={item.a ?? ""} />
          </div>
        ))}
      </dl>

      <p className="frontend-legal-note">
        If a session feels unsafe, stop and read <Link href="/safety">Safety</Link>. Crisis
        lines are listed there.
      </p>
    </article>
  );
}