"use client";

import Link from "next/link";
import { appPath } from "@/lib/app-base";
import {
  backdropPlan,
  betweenTemplate,
  ctaShowcaseWords,
  isCtaShowcase,
  sectionText,
} from "@/lib/marketing-sections";
import { CtaShowcase, ctaShowcaseTone } from "./CtaShowcase";
import { AccentText } from "./AccentText";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./session-path-sticky.css";

/**
 * "Between sessions" closing frame, a section of its own in the page layout
 * (it used to be the tail of the how-it-works component). Keeps the
 * `fe-spath-finale` classes so the stages -> between rounded rise and the
 * between -> languages curve hand-offs still target the same box.
 */
export function BetweenSessionsSection() {
  const between = useSectionConfig("home-how-between");
  const tpl = betweenTemplate(between);
  // The shared CTA looks (also on the closing CTA). The page's section
  // backdrop paints a custom background; Full-bleed paints its photo itself.
  const show = isCtaShowcase(tpl) ? tpl : null;
  const plan = backdropPlan(between, show === "fullbleed" || show === "contact");
  const href = sectionText(between, "betweenCtaHref") || appPath("/create-account");

  return (
    // The shell carries the stage's pale sheet so the section's wipe slit
    // reveals that colour, not the page canvas, while it opens.
    <div className="fe-between-shell">
      <section
        className={`fe-spath-finale fe-has-edit fe-between--tpl-${tpl}${
          show ? ` fe-between--showcase fe-between--${ctaShowcaseTone(show)}` : ""
        }`}
        data-section="home-how-between"
        aria-labelledby="fe-between-title"
      >
        <SectionEdit id="home-how-between" />
        <div className="fe-spath-finale-zoom">
          {show ? (
            <CtaShowcase
              template={show}
              variant="between"
              titleId="fe-between-title"
              titleTag="h3"
              kicker={sectionText(between, "betweenKicker")}
              title={sectionText(between, "betweenTitle")}
              accent={sectionText(between, "betweenAccent")}
              body={sectionText(between, "betweenLine")}
              primary={{ label: sectionText(between, "betweenCta"), href }}
              quote={sectionText(between, "betweenQuote")}
              quoteBy={sectionText(between, "betweenQuoteBy")}
              words={ctaShowcaseWords(sectionText(between, "betweenWords"))}
              bullets={sectionText(between, "betweenBullets")}
              formIntro={sectionText(between, "betweenFormIntro")}
              nameLabel={sectionText(between, "betweenLabelName")}
              emailLabel={sectionText(between, "betweenLabelEmail")}
              phoneLabel={sectionText(between, "betweenLabelPhone")}
              serviceLabel={sectionText(between, "betweenLabelService")}
              messageLabel={sectionText(between, "betweenLabelMessage")}
              services={sectionText(between, "betweenServices")}
              submitLabel={sectionText(between, "betweenSubmitLabel")}
              successMsg={sectionText(between, "betweenSuccessMsg")}
              contactLabel={sectionText(between, "betweenContactLabel")}
              contactValue={sectionText(between, "betweenContactValue")}
              contactHref={sectionText(between, "betweenContactHref")}
              plan={plan}
              paintMedia
            />
          ) : (
          <div className="fe-container fe-spath-finale-inner">
            <p className="fe-spath-finale-kicker">{sectionText(between, "betweenKicker")}</p>
            <h3 id="fe-between-title" className="fe-spath-finale-title">
              <AccentText
                text={sectionText(between, "betweenTitle")}
                accent={sectionText(between, "betweenAccent")}
              />
            </h3>
            <p className="fe-spath-finale-line">
              {sectionText(between, "betweenLine")}
            </p>
            <Link href={href} className="fe-spath-cta frontend-btn-ghost">
              {sectionText(between, "betweenCta")}
            </Link>
          </div>
          )}
        </div>
      </section>
    </div>
  );
}
