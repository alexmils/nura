"use client";

import { BRAND_LIMITS_LINE } from "@/lib/brand";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichInline, RichText } from "@/app/components/frontend/section-editor/RichText";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";

export function SupportPageView() {
  const copy = useSectionConfig("support-page");
  return (
    <article className="frontend-legal frontend-legal--long fe-has-edit" data-section="support-page">
      <SectionEdit id="support-page" lift />
      <h1>{sectionText(copy, "title")}</h1>
      <p>{sectionText(copy, "lead")}</p>

      {sectionList(copy, "sections").map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.heading === "Also useful" ? (
            <ul>
              {(section.body ?? "").split("\n").filter(Boolean).map((line) => (
                <li key={line}>
                  <RichInline text={line} />
                </li>
              ))}
            </ul>
          ) : (
            <RichText text={section.body ?? ""} />
          )}
        </section>
      ))}

      <p className="frontend-legal-note">
        <strong>If you are in danger right now, do not wait on email.</strong> In the US, call
        or text <a href="tel:988">988</a> (Suicide &amp; Crisis Lifeline). Anywhere, call your
        local emergency number.
      </p>

      <p className="frontend-legal-note">{BRAND_LIMITS_LINE}</p>
    </article>
  );
}
