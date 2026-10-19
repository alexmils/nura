"use client";

import Link from "next/link";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { EditablePart } from "@/app/components/frontend/section-editor/EditablePart";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";

export function FaqPageView() {
  const copy = useSectionConfig("faq-page");
  const questions = useSectionConfig("faq-questions");
  return (
    <article className="frontend-legal frontend-legal--long" data-section="faq-page">
      <EditablePart id="faq-page" lift>
        <h1>{sectionText(copy, "title")}</h1>
        <RichText text={sectionText(copy, "lead")} />
      </EditablePart>

      <EditablePart id="faq-questions">
      <dl className="frontend-legal-faq">
        {sectionList(questions, "items").map((item) => (
          <div key={item.q}>
            <h2>{item.q}</h2>
            <RichText text={item.a ?? ""} />
          </div>
        ))}
      </dl>
      </EditablePart>

      <p className="frontend-legal-note">
        If a session feels unsafe, stop and read <Link href="/safety">Safety</Link>. Crisis
        lines are listed there.
      </p>
    </article>
  );
}