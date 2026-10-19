"use client";

import { BRAND_LIMITS_LINE } from "@/lib/brand";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { RichText } from "@/app/components/frontend/section-editor/RichText";
import { EditablePart } from "@/app/components/frontend/section-editor/EditablePart";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";

export function SupportPageView() {
  const copy = useSectionConfig("support-page");
  const body = useSectionConfig("support-sections");
  return (
    <article className="frontend-legal frontend-legal--long" data-section="support-page">
      <EditablePart id="support-page" lift>
        <h1>{sectionText(copy, "title")}</h1>
        <p>{sectionText(copy, "lead")}</p>
      </EditablePart>

      <EditablePart id="support-sections">
      {sectionList(body, "sections").map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.heading === "Also useful" ? (
            <ul>
              {(section.body ?? "").split("\n").filter(Boolean).map((line) => (
                <li key={line}>
                  <RichText text={line} />
                </li>
              ))}
            </ul>
          ) : (
            <RichText text={section.body ?? ""} />
          )}
        </section>
      ))}
      </EditablePart>

      <p className="frontend-legal-note">
        <strong>If you are in danger right now, do not wait on email.</strong> In the US, call
        or text <a href="tel:988">988</a> (Suicide &amp; Crisis Lifeline). Anywhere, call your
        local emergency number.
      </p>

      <p className="frontend-legal-note">{BRAND_LIMITS_LINE}</p>
    </article>
  );
}
