"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Headphones,
  Library,
  MessageSquare,
  Minus,
  Plus,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { appPath } from "@/lib/app-base";
import { BILLING_PLANS, type BillingPlanId } from "@/lib/billing-constants";
import { KNOWLEDGE_HERO } from "@/lib/knowledge-clips";
import {
  linesOf,
  sectionList,
  sectionText,
} from "@/lib/marketing-sections";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { RichInline } from "./section-editor/RichText";
import { PageSections } from "./section-editor/PageSections";
import { SectionEdit } from "./section-editor/SectionEdit";
import { EditablePart } from "./section-editor/EditablePart";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "lenis/dist/lenis.css";
import "./landing-motion.css";
import "./pricing-page.css";

const FEATURE_ICONS = {
  guided: MessageSquare,
  free: Sparkles,
  voice: Headphones,
  controls: SlidersHorizontal,
  library: Library,
  limits: Shield,
} as const;

const FEATURE_WIDE = new Set(["guided", "limits"]);

export function PricingPageView() {
  const plans = useSectionConfig("pricing-plans");
  const cardCopy = useSectionConfig("pricing-cards");
  const included = useSectionConfig("pricing-included");
  const faq = useSectionConfig("pricing-faq");
  const close = useSectionConfig("pricing-cta");
  const cards = sectionList(cardCopy, "cards").flatMap((card) => {
    const id = card.id as BillingPlanId;
    if (!BILLING_PLANS[id]) return [];
    return [
      {
        id,
        title: card.title ?? "",
        badge: card.badge ?? "",
        details: card.details ?? "",
        periodNote: card.periodNote ?? "",
        features: linesOf(card.features ?? ""),
        featured: id === "yearly",
      },
    ];
  });
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="fe-pricing-page">
      <PageSections
        page="pricing"
        slots={{
      "pricing-plans": (
      <section
        className="fe-pricing-section fe-pricing-section--page fe-has-edit"
        id="plans"
        data-section="pricing-plans"
        aria-labelledby="fe-pricing-page-title"
      >
        <SectionEdit id="pricing-plans" lift />
        <div className="fe-container">
          <div className="fe-pricing-head">
            <h1 id="fe-pricing-page-title" className="fe-pricing-title">
              {sectionText(plans, "title")}
            </h1>
            <p className="fe-pricing-sub">
              {sectionText(plans, "sub")}
            </p>
          </div>

          <EditablePart id="pricing-cards">
          <div className="fe-pricing-grid">
            {cards.map((card) => {
              const plan = BILLING_PLANS[card.id];
              const featured = card.featured;
              return (
                <article
                  key={card.id}
                  className={`fe-price-card${featured ? " fe-price-card--featured" : ""}`}
                >
                  <header className="fe-price-card-head">
                    <div className="fe-price-card-head-row">
                      <h2 className="fe-price-card-name">{card.title}</h2>
                      {card.badge ? (
                        <p className="fe-price-card-hint">{card.badge}</p>
                      ) : null}
                    </div>
                    <div className="fe-price-card-cost">
                      <p className="fe-price-card-amount-row">
                        <span className="fe-price-card-amount">
                          {plan.displayPrice}
                        </span>
                        <span className="fe-price-card-period">
                          {plan.displayPeriod}
                        </span>
                      </p>
                      {card.periodNote ? (
                        <span className="fe-price-card-period-note">
                          {card.periodNote}
                        </span>
                      ) : null}
                    </div>
                  </header>
                  <p className="fe-price-card-details">{card.details}</p>
                  <Link
                    href={appPath("/create-account")}
                    className={`fe-price-card-cta${featured ? " fe-price-card-cta--accent" : ""}`}
                  >
                    {sectionText(cardCopy, "cta")}
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                  <p className="fe-price-card-features-label">{sectionText(plans, "featuresLabel")}</p>
                  <ul className="fe-price-card-features">
                    {card.features.map((f) => (
                      <li key={f}>
                        <Check
                          size={16}
                          strokeWidth={2.25}
                          className="fe-price-card-check"
                          aria-hidden
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          </EditablePart>
        </div>
      </section>
      ),
      "pricing-included": (
      <section
        className="fe-pricing-features fe-has-edit"
        data-section="pricing-included"
        aria-labelledby="fe-pricing-features-title"
      >
        <SectionEdit id="pricing-included" />
        <div className="fe-container">
          <header className="fe-pricing-features-head">
            <p className="fe-section-kicker">{sectionText(included, "kicker")}</p>
            <h2
              id="fe-pricing-features-title"
              className="fe-pricing-features-title"
            >
              {sectionText(included, "title")}
            </h2>
          </header>

          <div className="fe-pricing-bento">
            {sectionList(included, "items").map((feature) => {
              const Icon = FEATURE_ICONS[feature.id as keyof typeof FEATURE_ICONS] ?? Sparkles;
              const wide = FEATURE_WIDE.has(feature.id ?? "");
              return (
                <article
                  key={feature.id || feature.title}
                  className={`fe-pricing-bento-card${wide ? " fe-pricing-bento-card--wide" : ""}`}
                >
                  <span className="fe-pricing-bento-icon" aria-hidden>
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <h3 className="fe-pricing-bento-title">{feature.title}</h3>
                  <p className="fe-pricing-bento-label">{feature.label}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      ),
      "pricing-faq": (
      <section
        className="fe-faq fe-pricing-faq fe-has-edit"
        id="pricing-faq"
        data-section="pricing-faq"
        aria-labelledby="fe-pricing-faq-title"
      >
        <SectionEdit id="pricing-faq" />
        <div className="fe-container">
          <div className="fe-faq-head">
            <p className="fe-section-kicker">{sectionText(faq, "kicker")}</p>
            <h2 id="fe-pricing-faq-title" className="fe-faq-title">
              {sectionText(faq, "title")}
            </h2>
            <p className="fe-faq-sub">
              {sectionText(faq, "sub")}
            </p>
          </div>
          <div className="fe-faq-list">
            {sectionList(faq, "items").map((item, i) => {
              const isOpen = openFaq === i;
              const answerId = `fe-pricing-faq-a-${i}`;
              return (
                <div
                  key={item.q}
                  className={`fe-faq-item${isOpen ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="fe-faq-q"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <span className="fe-faq-icon" aria-hidden>
                      {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                    </span>
                  </button>
                  <div
                    id={answerId}
                    role="region"
                    hidden={!isOpen}
                    className="fe-faq-a"
                  >
                    <p>
                      {item.a}
                      {item.q.includes("therapy") ? (
                        <>
                          {" "}
                          <Link href="/limits">Read the limits</Link>.
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="fe-pricing-faq-more">
            More questions? See the full <Link href="/faq">FAQ</Link>.
          </p>
        </div>
      </section>
      ),
      "pricing-cta": (
      <section className="fe-pricing-cta fe-has-edit" data-section="pricing-cta" aria-label="Get started">
        <SectionEdit id="pricing-cta" />
        <div className="fe-container">
          <div className="fe-pricing-cta-stage">
            <video
              className="fe-pricing-cta-video"
              src={KNOWLEDGE_HERO.videoSrc}
              poster={KNOWLEDGE_HERO.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
            <div className="fe-pricing-cta-veil" aria-hidden />
            <div className="fe-pricing-cta-inner">
              <div className="fe-pricing-cta-mark">
                <BrandLockup tone="white" href={null} />
              </div>
              <LetterRevealHeading className="fe-pricing-cta-title">
                {sectionText(close, "title")}
              </LetterRevealHeading>
              <div className="fe-pricing-cta-actions">
                <Link
                  href={sectionText(close, "ctaHref")}
                  className="fe-pricing-cta-btn"
                >
                  {sectionText(close, "cta")}
                </Link>
              </div>
              <p className="fe-pricing-cta-note">
                <RichInline text={sectionText(close, "note")} />
              </p>
            </div>
          </div>
        </div>
      </section>
      ),
        }}
      />
    </div>
  );
}
