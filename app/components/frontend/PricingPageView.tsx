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
import { appPath, LOGIN_PATH } from "@/lib/app-base";
import { BILLING_PLANS, TRIAL_DAYS } from "@/lib/billing-constants";
import { KNOWLEDGE_HERO } from "@/lib/knowledge-clips";
import { PRICING_FAQ_ITEMS } from "@/lib/pricing-faq";
import { MARKETING_PRICING_CARDS } from "@/app/components/frontend/marketingPricingCards";
import { LetterRevealHeading } from "./LetterRevealHeading";
import "lenis/dist/lenis.css";
import "./landing-motion.css";
import "./pricing-page.css";

const FEATURES = [
  {
    id: "guided",
    title: "AI agent-guided sessions",
    label: "Phases + check-ins",
    icon: MessageSquare,
    wide: true,
  },
  {
    id: "free",
    title: "Self-guided visual sets",
    label: "Run sets yourself",
    icon: Sparkles,
    wide: false,
  },
  {
    id: "voice",
    title: "Optional voice",
    label: "Hands-free replies",
    icon: Headphones,
    wide: false,
  },
  {
    id: "controls",
    title: "Session controls",
    label: "Speed, sound, repeats",
    icon: SlidersHorizontal,
    wide: false,
  },
  {
    id: "library",
    title: "Resources library",
    label: "Guides in the app",
    icon: Library,
    wide: false,
  },
  {
    id: "limits",
    title: "Honest limits",
    label: "Not therapy or crisis care",
    icon: Shield,
    wide: true,
  },
] as const;

export function PricingPageView() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="fe-pricing-page">
      <section
        className="fe-pricing-section fe-pricing-section--page"
        id="plans"
        aria-labelledby="fe-pricing-page-title"
      >
        <div className="fe-container">
          <div className="fe-pricing-head">
            <h1 id="fe-pricing-page-title" className="fe-pricing-title">
              Plans tailored to your pace
            </h1>
            <p className="fe-pricing-sub">
              {TRIAL_DAYS}-day trial. Same full app on every plan — pick how
              often you pay.
            </p>
          </div>

          <div className="fe-pricing-grid">
            {MARKETING_PRICING_CARDS.map((card) => {
              const plan = BILLING_PLANS[card.id];
              const featured = Boolean(card.featured);
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
                    Get started
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                  <p className="fe-price-card-features-label">Includes</p>
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
        </div>
      </section>

      <section
        className="fe-pricing-features"
        aria-labelledby="fe-pricing-features-title"
      >
        <div className="fe-container">
          <header className="fe-pricing-features-head">
            <p className="fe-section-kicker">Included</p>
            <h2
              id="fe-pricing-features-title"
              className="fe-pricing-features-title"
            >
              Same product. Every plan.
            </h2>
          </header>

          <div className="fe-pricing-bento">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.id}
                  className={`fe-pricing-bento-card${feature.wide ? " fe-pricing-bento-card--wide" : ""}`}
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

      <section
        className="fe-faq fe-pricing-faq"
        id="pricing-faq"
        aria-labelledby="fe-pricing-faq-title"
      >
        <div className="fe-container">
          <div className="fe-faq-head">
            <p className="fe-section-kicker">FAQ</p>
            <h2 id="fe-pricing-faq-title" className="fe-faq-title">
              Billing questions
            </h2>
            <p className="fe-faq-sub">
              Trial, plans, and cancel — short answers.
            </p>
          </div>
          <div className="fe-faq-list">
            {PRICING_FAQ_ITEMS.map((item, i) => {
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

      <section className="fe-pricing-cta" aria-label="Get started">
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
                Your healing starts here.
              </LetterRevealHeading>
              <div className="fe-pricing-cta-actions">
                <Link
                  href={appPath("/create-account")}
                  className="fe-pricing-cta-btn"
                >
                  Get started
                </Link>
              </div>
              <p className="fe-pricing-cta-note">
                {TRIAL_DAYS}-day trial.{" "}
                <Link href={LOGIN_PATH}>Sign in</Link>
                {" · "}
                <Link href="/limits">Read the limits</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
