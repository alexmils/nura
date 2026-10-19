"use client";

import Link from "next/link";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { EditableSlot } from "./section-editor/EditableSlot";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import { RichArticle, RichInline } from "./section-editor/RichText";

/** A long-form text block inside a `.frontend-legal` article. */
export function ArticleSection({ id, field = "body" }: { id: string; field?: string }) {
  const copy = useSectionConfig(id);
  return (
    <EditableSlot id={id}>
      <RichArticle text={sectionText(copy, field)} />
    </EditableSlot>
  );
}

export type AdvisorInfo = {
  name: string;
  credentials: string | null;
  lastReviewedAt: string | null;
} | null;

export function ClinicalAdvisorSection({ advisor }: { advisor: AdvisorInfo }) {
  const copy = useSectionConfig("clinical-advisor");
  return (
    <EditableSlot id="clinical-advisor">
      <h2>{sectionText(copy, "title")}</h2>
      {advisor ? (
        <>
          <p>
            <strong>{advisor.name}</strong>
            {advisor.credentials ? ` \u2014 ${advisor.credentials}` : null}
          </p>
          {advisor.lastReviewedAt ? (
            <p>
              Last review of intake and safety materials: {advisor.lastReviewedAt}
            </p>
          ) : null}
        </>
      ) : (
        <p>
          <RichInline text={sectionText(copy, "fallback")} />
        </p>
      )}
    </EditableSlot>
  );
}

export function EmdrCompareSection() {
  const copy = useSectionConfig("emdr-compare");
  return (
    <EditableSlot id="emdr-compare">
      <h2>{sectionText(copy, "title")}</h2>
      <div className="frontend-legal-tablewrap">
        <table className="frontend-legal-table">
          <thead>
            <tr>
              <th scope="col">{"\u00a0"}</th>
              <th scope="col">{sectionText(copy, "colA")}</th>
              <th scope="col">{sectionText(copy, "colB")}</th>
            </tr>
          </thead>
          <tbody>
            {sectionList(copy, "rows").map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <th scope="row">{row.label}</th>
                <td>{row.a}</td>
                <td>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RichArticle text={sectionText(copy, "summary")} />
    </EditableSlot>
  );
}

export function EmdrFaqSection() {
  const copy = useSectionConfig("emdr-faq");
  return (
    <EditableSlot id="emdr-faq">
      <h2>{sectionText(copy, "title")}</h2>
      <dl className="frontend-legal-faq">
        {sectionList(copy, "items").map((item, index) => (
          <div key={`${item.q}-${index}`}>
            <h3>{item.q}</h3>
            <p>
              <RichInline text={item.a ?? ""} />
            </p>
          </div>
        ))}
      </dl>
    </EditableSlot>
  );
}

export function EmdrCloseSection() {
  const copy = useSectionConfig("emdr-close");
  const body = sectionText(copy, "body");
  const note = sectionText(copy, "note");
  return (
    <EditableSlot id="emdr-close">
      <h2>{sectionText(copy, "title")}</h2>
      {body ? (
        <p>
          <RichInline text={body} />
        </p>
      ) : null}
      <div className="frontend-legal-actions">
        {sectionList(copy, "actions").map((action, index) => {
          const href = action.href ?? "";
          if (!action.label || !href) return null;
          const className =
            (action.style ?? "").trim().toLowerCase() === "primary"
              ? "frontend-btn-primary"
              : "frontend-btn-ghost";
          return href.startsWith("/") ? (
            <Link key={index} href={href} className={className}>
              {action.label}
            </Link>
          ) : (
            <a key={index} href={href} className={className}>
              {action.label}
            </a>
          );
        })}
      </div>
      {note ? (
        <p className="frontend-legal-note">
          <RichInline text={note} />
        </p>
      ) : null}
    </EditableSlot>
  );
}