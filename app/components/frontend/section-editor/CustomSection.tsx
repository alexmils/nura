"use client";

import Link from "next/link";
import {
  customSectionType,
  sectionList,
  sectionText,
  type SectionConfig,
  type CustomSectionType,
} from "@/lib/marketing-sections";
import { Marquee } from "@/app/components/motion/Marquee";
import { SectionMedia } from "../SectionMedia";
import { PosterStage } from "./PosterSection";
import { useSectionConfig } from "./MarketingCopy";
import { RichArticle, RichInline } from "./RichText";
import { SectionEdit } from "./SectionEdit";
import "./custom-sections.css";

function Cta({
  label,
  href,
  ghost = false,
}: {
  label: string;
  href: string;
  ghost?: boolean;
}) {
  if (!label.trim() || !href) return null;
  const className = ghost ? "fe-custom-btn fe-custom-btn--ghost" : "fe-custom-btn";
  if (href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return (
      <a className={className} href={href}>
        {label}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {label}
    </Link>
  );
}

function Head({ copy }: { copy: SectionConfig }) {
  const kicker = sectionText(copy, "kicker");
  const title = sectionText(copy, "title");
  return (
    <>
      {kicker ? <p className="fe-custom-kicker">{kicker}</p> : null}
      {title ? <h2 className="fe-custom-title">{title}</h2> : null}
    </>
  );
}

/** Enough tiles that one copy of the strip is wider than a wide screen. */
const MARQUEE_MIN_TILES = 12;

function ImageMarquee({ copy }: { copy: SectionConfig }) {
  const images = sectionList(copy, "images").filter((item) => (item.image ?? "").trim());
  if (!images.length) return null;
  const reps = Math.ceil(MARQUEE_MIN_TILES / images.length);
  const tiles = Array.from({ length: reps }, () => images).flat();
  return (
    <div className="fe-custom-marquee">
      <Marquee duration={Math.max(30, tiles.length * 4)} pauseOnHover={false}>
        {tiles.map((item, index) => (
          <div key={index} className={`fe-custom-marquee-tile${index % 2 ? " is-short" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin images can be any Cloudinary or site URL */}
            <img src={item.image} alt={item.alt ?? ""} loading="lazy" decoding="async" />
          </div>
        ))}
      </Marquee>
      <div className="fe-custom-marquee-fade" aria-hidden />
    </div>
  );
}

/** Renders an admin-added section (`custom-<type>-<suffix>`). */
export function CustomSection({ id, type: forced }: { id: string; type?: CustomSectionType }) {
  const type = forced ?? customSectionType(id);
  const copy = useSectionConfig(id);
  if (!type) return null;
  if (type === "poster") {
    return (
      <section className="fe-custom fe-custom--poster fe-has-edit" data-section={id}>
        <SectionEdit id={id} />
        <PosterStage copy={copy} />
      </section>
    );
  }
  return (
    <section className={`fe-custom fe-custom--${type} fe-has-edit`} data-section={id}>
      <SectionEdit id={id} />
      <div className="fe-custom-inner">
        {type === "text" ? (
          <>
            <Head copy={copy} />
            <div className="fe-custom-body">
              <RichArticle text={sectionText(copy, "body")} />
            </div>
            <div className="fe-custom-actions">
              <Cta label={sectionText(copy, "ctaLabel")} href={sectionText(copy, "ctaHref")} />
            </div>
          </>
        ) : null}
        {type === "media" ? (
          <div
            className={`fe-custom-split${
              sectionText(copy, "side").trim().toLowerCase() === "right" ? " is-right" : ""
            }`}
          >
            <div className="fe-custom-media">
              <SectionMedia
                className="fe-custom-media-el"
                kind={sectionText(copy, "mediaKind")}
                image={sectionText(copy, "mediaImage")}
                video={sectionText(copy, "mediaVideo")}
                poster={sectionText(copy, "mediaPoster")}
                alt={sectionText(copy, "mediaAlt")}
              />
            </div>
            <div className="fe-custom-split-text">
              <Head copy={copy} />
              <div className="fe-custom-body">
                <RichArticle text={sectionText(copy, "body")} />
              </div>
              <div className="fe-custom-actions">
                <Cta label={sectionText(copy, "ctaLabel")} href={sectionText(copy, "ctaHref")} />
              </div>
            </div>
          </div>
        ) : null}
        {type === "cta" ? (
          <div className="fe-custom-band">
            {sectionText(copy, "kicker") ? <p className="fe-custom-kicker">{sectionText(copy, "kicker")}</p> : null}
            <h2 className="fe-custom-title">{sectionText(copy, "title")}</h2>
            {sectionText(copy, "body") ? (
              <p className="fe-custom-lead">
                <RichInline text={sectionText(copy, "body")} />
              </p>
            ) : null}
            <div className="fe-custom-actions">
              <Cta label={sectionText(copy, "ctaLabel")} href={sectionText(copy, "ctaHref")} />
              <Cta
                ghost
                label={sectionText(copy, "secondaryLabel")}
                href={sectionText(copy, "secondaryHref")}
              />
            </div>
          </div>
        ) : null}
        {type === "marquee" ? (
          <div className="fe-custom-band">
            {sectionText(copy, "kicker") ? <p className="fe-custom-kicker">{sectionText(copy, "kicker")}</p> : null}
            <h2 className="fe-custom-title">{sectionText(copy, "title")}</h2>
            {sectionText(copy, "body") ? (
              <p className="fe-custom-lead">
                <RichInline text={sectionText(copy, "body")} />
              </p>
            ) : null}
            <div className="fe-custom-actions">
              <Cta label={sectionText(copy, "ctaLabel")} href={sectionText(copy, "ctaHref")} />
              <Cta
                ghost
                label={sectionText(copy, "secondaryLabel")}
                href={sectionText(copy, "secondaryHref")}
              />
            </div>
          </div>
        ) : null}
        {type === "faq" ? (
          <>
            <Head copy={copy} />
            <div className="fe-custom-faq">
              {sectionList(copy, "items").map((item, index) => (
                <details key={`${item.q}-${index}`}>
                  <summary>{item.q}</summary>
                  <p>
                    <RichInline text={item.a ?? ""} />
                  </p>
                </details>
              ))}
            </div>
          </>
        ) : null}
        {type === "cards" ? (
          <>
            <Head copy={copy} />
            <div className="fe-custom-cards">
              {sectionList(copy, "items").map((item, index) => {
                const body = (
                  <>
                    {item.mediaImage || item.mediaVideo ? (
                      <div className="fe-custom-card-media">
                        <SectionMedia
                          className="fe-custom-media-el"
                          kind={item.mediaKind ?? "image"}
                          image={item.mediaImage ?? ""}
                          video={item.mediaVideo ?? ""}
                          poster={item.mediaPoster ?? ""}
                          alt={item.mediaAlt ?? ""}
                        />
                      </div>
                    ) : null}
                    {item.title ? <h3>{item.title}</h3> : null}
                    {item.body ? (
                      <p>
                        <RichInline text={item.body} />
                      </p>
                    ) : null}
                  </>
                );
                return item.href ? (
                  <Link key={index} href={item.href} className="fe-custom-card is-link">
                    {body}
                  </Link>
                ) : (
                  <article key={index} className="fe-custom-card">
                    {body}
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      {type === "marquee" ? <ImageMarquee copy={copy} /> : null}
    </section>
  );
}