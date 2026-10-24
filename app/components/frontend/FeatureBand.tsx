"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sectionText } from "@/lib/marketing-sections";
import { EditablePart } from "./section-editor/EditablePart";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./feature-band.css";

/**
 * Home: feature band — an announcement strip with two photos and a card in
 * the middle. Ships switched off; all copy and both images are editable in
 * the section panel, and the layout editor decides where it sits.
 */
export function FeatureBand() {
  const copy = useSectionConfig("home-feature-band");
  const left = sectionText(copy, "imageLeft");
  const right = sectionText(copy, "imageRight");
  const badge = sectionText(copy, "badge");
  const title = sectionText(copy, "title");
  const body = sectionText(copy, "body");
  const note = sectionText(copy, "note");
  const cta = sectionText(copy, "cta");
  const ctaHref = sectionText(copy, "ctaHref") || "/learn";

  return (
    <EditablePart id="home-feature-band" backdrop={false}>
      <section
        className="v2-section v2-feature-band"
        id="feature-band"
        aria-labelledby="v2-feature-band-title"
      >
        <div className="v2-container v2-fb-grid">
          <figure className="v2-fb-media">
            {left ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={left} alt={sectionText(copy, "imageLeftAlt")} loading="lazy" decoding="async" />
            ) : (
              <span className="v2-fb-media-empty" aria-hidden />
            )}
          </figure>

          <div className="v2-fb-card">
            {badge ? <span className="v2-fb-badge">{badge}</span> : null}
            <h2 className="v2-fb-title" id="v2-feature-band-title">
              {title}
            </h2>
            {body ? <p className="v2-fb-body">{body}</p> : null}
            {note ? <p className="v2-fb-note">{note}</p> : null}
            {cta ? (
              <Link href={ctaHref} className="v2-fb-cta">
                {cta}
                <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
              </Link>
            ) : null}
          </div>

          <figure className="v2-fb-media">
            {right ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={right} alt={sectionText(copy, "imageRightAlt")} loading="lazy" decoding="async" />
            ) : (
              <span className="v2-fb-media-empty" aria-hidden />
            )}
          </figure>
        </div>
      </section>
    </EditablePart>
  );
}
