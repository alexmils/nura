"use client";
import { frameKey, storedFrameStyle } from "@/lib/image-position";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Headphones,
  Leaf,
  Lock,
  MessageCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Volume2,
} from "lucide-react";
import { appPath } from "@/lib/app-base";
import {
  BILLING_PLANS,
  type BillingPlanId,
} from "@/lib/billing-constants";
import type { LandingBlogPost } from "@/lib/landing-blog";
import { SectionRise } from "@/app/components/motion/SectionRise";
import { useHomeChoreography } from "./useHomeChoreography";
import {
  linesOf,
  sectionBackground,
  sectionList,
  sectionText,
  type SectionBackground,
  sectionGradient,
  gradientIsOverlay,
  sectionDecor,
  heroInk,
  heroTemplate,
} from "@/lib/marketing-sections";
import { HeroTemplateBody, heroInkStyle, useReducedMotion, type HeroParts } from "./HeroTemplates";
import { EditablePart, GradientLayer } from "./section-editor/EditablePart";
import { useSectionConfig, usePageLayout } from "./section-editor/MarketingCopy";
import { useIsPlatformAdmin } from "./section-editor/useIsPlatformAdmin";
import { PageSections } from "./section-editor/PageSections";
import { AccentText } from "./AccentText";
import { BlogSection, FaqSection } from "./HomeLanding";
import { SessionPathSticky } from "./SessionPathSticky";
import { HowIntroSection } from "./HowIntroSection";
import { BetweenSessionsSection } from "./BetweenSessionsSection";
import { LanguagesSection } from "./LanguagesSection";
import { SessionTopicsGrid } from "./SessionTopicsGrid";
import { useLandingMotion } from "./useLandingMotion";
import { usePlanSpread } from "./usePlanSpread";
import { useStoryTrack } from "./useStoryTrack";
import "lenis/dist/lenis.css";
import "./landing-motion.css";
import "./landing-v2.css";
import "./hero-templates.css";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type PlanCard = {
  id: BillingPlanId;
  name: string;
  badge?: string;
  details: string;
  note?: string;
  features: string[];
  featured?: boolean;
};

type ModeCard = {
  id: string;
  label: string;
  hint: string;
  kicker: string;
  title: string;
  accent: string;
  body: string;
  image: string;
  alt: string;
  chips: string[];
};

type Story = { quote: string; name: string; role: string };

/** next/image only optimises local files and the allowed remote hosts. */
function needsUnoptimized(src: string): boolean {
  return !src.startsWith("/") && !src.includes("res.cloudinary.com");
}

/** Admin-chosen background in place of a band's built-in photo. */
function BandBackground({ bg, className, frame }: { bg: SectionBackground; className: string; frame?: string }) {
  const fill = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as const;
  return (
    <>
      {bg.kind === "video" ? (
        <video className={className} src={bg.video} poster={bg.poster || undefined} autoPlay muted loop playsInline style={fill} />
      ) : bg.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={className} src={bg.image} alt="" data-frame-key={frame} style={{ ...fill, ...storedFrameStyle(bg.imagePos) }} />
      ) : (
        <span className={className} style={{ ...fill, background: bg.color }} />
      )}
      {bg.kind !== "color" && bg.overlay > 0 ? (
        <span aria-hidden style={{ ...fill, background: bg.tone === "dark" ? "#0b1220" : "#ffffff", opacity: bg.overlay / 100 }} />
      ) : null}
    </>
  );
}

function Accent({ text, accent, className = "v2-em" }: { text: string; accent: string; className?: string }) {
  const at = accent ? text.indexOf(accent) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <em className={className}>{accent}</em>
      {text.slice(at + accent.length)}
    </>
  );
}

function sessionEmbedUrl(url: string): string {
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

function StarRow({ className }: { className?: string }) {
  return (
    <span
      className={`v2-stars${className ? ` ${className}` : ""}`}
      aria-label="5 out of 5 stars"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} fill="currentColor" strokeWidth={0} aria-hidden />
      ))}
    </span>
  );
}

function SectionHead({
  kicker,
  title,
  accent,
  sub,
  id,
}: {
  kicker: string;
  title: string;
  accent?: string;
  sub?: string;
  id?: string;
}) {
  const at = accent ? title.indexOf(accent) : -1;
  return (
    <div className="v2-section-head fe-animate">
      <p className="v2-kicker">{kicker}</p>
      <h2 className="v2-h2" id={id}>
        {at >= 0 && accent ? (
          <>
            {title.slice(0, at)}
            <em className="v2-em">{accent}</em>
            {title.slice(at + accent.length)}
          </>
        ) : (
          title
        )}
      </h2>
      {sub ? <p className="v2-section-sub">{sub}</p> : null}
    </div>
  );
}

function PricingCard({ plan, cta, featuresLabel }: { plan: PlanCard; cta: string; featuresLabel: string }) {
  const meta = BILLING_PLANS[plan.id];
  return (
    <article className={`v2-price v2-glass v2-glass--strong fe-animate${plan.featured ? " is-featured" : ""}`}>
      <div className="v2-price-top">
        <div>
          <h3 className="v2-price-name">{plan.name}</h3>
          {plan.badge ? <span className="v2-price-badge">{plan.badge}</span> : null}
        </div>
      </div>
      <p className="v2-price-details">{plan.details}</p>
      <div className="v2-price-cost">
        <span className="v2-price-amount">{meta.displayPrice}</span>
        <span className="v2-price-period">per {meta.interval}</span>
        {plan.note ? <span className="v2-price-note">{plan.note}</span> : null}
      </div>
      <Link
        href={appPath("/create-account")}
        className={`v2-btn${plan.featured ? " v2-btn--primary" : " v2-btn--outline"}`}
      >
        {cta}
        <ArrowRight size={18} aria-hidden />
      </Link>
      <p className="v2-price-features-label">{featuresLabel}</p>
      <ul className="v2-price-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check size={18} strokeWidth={2.4} aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing                                                            */
/* ------------------------------------------------------------------ */

export function HomeLandingV2({
  blogPosts = [],
}: {
  blogPosts?: LandingBlogPost[];
}) {
  const landingRef = useRef<HTMLDivElement | null>(null);
  useLandingMotion(landingRef);
  useHomeChoreography(landingRef);

  const hero = useSectionConfig("home-hero");
  const trust = useSectionConfig("home-trust");
  const modesCopy = useSectionConfig("home-modes");
  const session = useSectionConfig("home-session");
  const storiesCopy = useSectionConfig("home-stories");
  const pricing = useSectionConfig("home-pricing");
  const close = useSectionConfig("home-close");
  const heroBg = sectionBackground(hero);
  // Optional gradient (off by default): over the photo, or replacing it as the background.
  const heroGrad = sectionGradient(hero);
  const heroGradOver = heroGrad ? gradientIsOverlay(heroGrad, heroBg, true) : false;
  // Hero layout template ("default" = the original centred hero).
  const heroTpl = heroTemplate(hero);
  const heroStyle = heroInkStyle(heroInk(hero));
  // Templates show a background video's poster under reduced motion.
  const reduceMotion = useReducedMotion();
  const heroBgShown =
    heroTpl !== "default" && reduceMotion && heroBg?.kind === "video" && heroBg.poster
      ? { ...heroBg, kind: "image" as const, image: heroBg.poster, imagePos: "" }
      : heroBg;
  // Sky, sun and haze belong to the Default template on the Default background only (and can be switched off).
  const heroDecor = heroTpl === "default" && sectionDecor(hero);
  // Hero + trust strip are one unit (strip inside the hero, in the first
  // viewport) whenever the strip is the next shown section after the hero.
  const homeLayout = usePageLayout("home");
  const shownIds = homeLayout.sections.filter((entry) => !entry.hidden).map((entry) => entry.id);
  const trustInHero = shownIds[shownIds.indexOf("home-hero") + 1] === "home-trust" && shownIds.includes("home-hero");
  // A function: stripIcons is declared further down.
  const trustStrip = () => (
      <div className="v2-trust-wrap">
        <div className="v2-glass v2-glass--strong v2-trust">
          <p className="v2-trust-line">{sectionText(trust, "line")}</p>
          <ul className="v2-trust-chips">
            {sectionList(trust, "chips").map((chip, index) => {
              const Icon = stripIcons[chip.id ?? ""] ?? Check;
              return (
                <li key={chip.id || index}><Icon size={14} aria-hidden /> {chip.label}</li>
              );
            })}
          </ul>
        </div>
      </div>
  );
  const closeBg = sectionBackground(close);
  const MODES: ModeCard[] = sectionList(modesCopy, "modes").map((mode) => ({
    id: mode.id || "guided",
    label: mode.label ?? "",
    hint: mode.hint ?? "",
    kicker: mode.kicker ?? "",
    title: mode.title ?? "",
    accent: mode.accent ?? "",
    body: mode.body ?? "",
    image: mode.image || "/marketing/landing/support-talk.jpg",
    alt: mode.alt ?? "",
    chips: linesOf(mode.chips ?? ""),
  }));
  const STORIES: Story[] = sectionList(storiesCopy, "stories").map((story) => ({
    quote: story.quote ?? "",
    name: story.name ?? "",
    role: story.role ?? "",
  }));
  const PLANS: PlanCard[] = sectionList(pricing, "plans")
    .filter((plan) => Boolean(plan.id && BILLING_PLANS[plan.id as BillingPlanId]))
    .map((plan) => ({
      id: plan.id as BillingPlanId,
      name: plan.name ?? "",
      badge: plan.badge || undefined,
      details: plan.details ?? "",
      note: plan.note || undefined,
      features: linesOf(plan.features ?? ""),
      featured: plan.id === "yearly",
    }));
  // Keep the best-value plan (Yearly) centred in the row.
  if (PLANS.length >= 3) {
    const featuredIdx = PLANS.findIndex((plan) => plan.featured);
    if (featuredIdx !== -1) {
      const [featured] = PLANS.splice(featuredIdx, 1);
      PLANS.splice(Math.floor(PLANS.length / 2), 0, featured);
    }
  }
  const SESSION_VIDEO_URL = sectionText(session, "videoUrl").trim();
  // EditablePart adds a wrapper for admins, so the section nodes are rebuilt
  // when the role resolves; the motion hooks must re-attach to the new nodes.
  const isAdmin = useIsPlatformAdmin();
  const planGridRef = useRef<HTMLDivElement | null>(null);
  usePlanSpread(planGridRef, `${PLANS.map((plan) => plan.id).join(",")}|${isAdmin}`);
  const storiesRef = useRef<HTMLElement | null>(null);
  const storyTrackRef = useRef<HTMLDivElement | null>(null);
  useStoryTrack(
    storiesRef,
    storyTrackRef,
    `${STORIES.map((story) => story.name).join("|")}|${isAdmin}`
  );
  const trustIcons = [Check, Check, ShieldCheck];
  const stripIcons: Record<string, typeof Check> = { trial: Check, cancel: Check, private: Lock, between: Sparkles };
  const featureIcons: Record<string, typeof Check> = { sets: Sun, voice: Headphones, ground: Leaf, notes: Lock };

  const [activeMode, setActiveMode] = useState<string>("guided");
  const activeModeData = MODES.find((mode) => mode.id === activeMode) ?? MODES[0];

  // One set of hero copy elements; every template arranges these (the load reveal targets their classes).
  const heroParts: HeroParts = {
    kicker: (
      <p className="v2-hero-kicker">
        <span className="v2-hero-kicker-dot" aria-hidden />
        {sectionText(hero, "kicker")}
      </p>
    ),
    title: (
      <h1 className="v2-hero-title" id="v2-hero-title">
        <span className="v2-hero-title-line">{sectionText(hero, "title1")}</span>
        <span className="v2-hero-title-line">
          <Accent text={sectionText(hero, "title2")} accent={sectionText(hero, "accent")} className="v2-em v2-hero-em" />
        </span>
      </h1>
    ),
    sub: <p className="v2-hero-sub">{sectionText(hero, "sub")}</p>,
    actions: (
      <div className="v2-hero-actions">
        <Link href={sectionText(hero, "primaryHref")} className="v2-btn v2-btn--lime">
          {sectionText(hero, "primary")}
          <ArrowRight size={17} aria-hidden />
        </Link>
        {sectionText(hero, "secondary") ? (
          <a href={sectionText(hero, "secondaryHref") || "#how-it-works"} className="v2-btn v2-btn--ghost">
            <Play size={15} aria-hidden />
            {sectionText(hero, "secondary")}
          </a>
        ) : null}
      </div>
    ),
    checks: (
      <ul className="v2-hero-trust">
        {sectionList(hero, "trust").map((item, index) => {
          const Icon = trustIcons[index] ?? Check;
          return (
            <li key={item.id || index}>
              <Icon size={15} aria-hidden /> {item.label}
            </li>
          );
        })}
      </ul>
    ),
  };

  return (
    <div ref={landingRef} className="fe-v2">
      <PageSections
        page="home"
        slots={{
      "home-hero": (
      <EditablePart id="home-hero" lift backdrop={false}>
      <section
        className={`v2-hero${heroDecor ? "" : " v2-hero--plain"}${heroTpl === "default" ? "" : ` v2-hero--tpl v2-hero--tpl-${heroTpl}`}${trustInHero ? " v2-hero--trust" : ""}`}
        id="home"
        aria-labelledby="v2-hero-title"
        style={heroStyle}
      >
        {heroDecor ? <div className="v2-hero-sky" aria-hidden /> : null}
        {heroDecor ? <div className="v2-hero-sun" aria-hidden /> : null}
        {heroGrad && !heroGradOver ? <GradientLayer gradient={heroGrad} className="v2-hero-grad v2-hero-grad--bg" /> : null}
        <div className="v2-hero-photo" aria-hidden hidden={Boolean(heroGrad && !heroGradOver)}>
          {heroBg ? (
            <BandBackground bg={heroBgShown ?? heroBg} className="v2-hero-photo-img" frame={frameKey("home-hero", "bgImage")} />
          ) : (
            <Image
              src="/marketing/landing/green-landscape.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="v2-hero-photo-img"
            />
          )}
          {heroGrad && heroGradOver ? <GradientLayer gradient={heroGrad} className="v2-hero-grad" /> : null}
        </div>

        {heroTpl !== "default" && !heroBg && !heroGrad ? <div className="v2-tpl-scrim" aria-hidden /> : null}
        {heroTpl === "default" ? (
          <div className="v2-hero-inner">
            <div className="v2-hero-copy">
              {heroParts.kicker}
              {heroParts.title}
              {heroParts.sub}
              {heroParts.actions}
              {heroParts.checks}
            </div>
          </div>
        ) : (
          <HeroTemplateBody hero={hero} template={heroTpl} parts={heroParts} />
        )}
        {trustInHero ? (
          <div className="v2-hero-trust-slot">
            <EditablePart id="home-trust" backdrop={false}>
              {trustStrip()}
            </EditablePart>
          </div>
        ) : null}
      </section>
      </EditablePart>
      ),

      // With the trust strip straight after the hero it renders inside the hero (one unit).
      "home-trust": trustInHero ? null : (
      <EditablePart id="home-trust" backdrop={false}>
        {trustStrip()}
      </EditablePart>
      ),

      "home-how-intro": <HowIntroSection />,
      "home-how": <SessionPathSticky />,
      "home-how-between": <BetweenSessionsSection />,
      "home-how-languages": <LanguagesSection />,

      "home-modes": (
      <EditablePart id="home-modes" backdrop={false}>
      {/* Languages -> modes is the choreography's "tilt" (one effect per boundary). */}
      <SectionRise from={4} radius={40} still>
      <section className="v2-section v2-modes" id="modes" aria-labelledby="v2-modes-title">
        <div className="v2-container">
          <SectionHead
            kicker={sectionText(modesCopy, "kicker")}
            title={sectionText(modesCopy, "title")}
            accent={sectionText(modesCopy, "accent")}
            sub={sectionText(modesCopy, "sub")}
            id="v2-modes-title"
          />
          {activeModeData ? (
          <div className="v2-modes-board v2-glass v2-glass--strong">
            <div className="v2-modes-tabs" role="tablist" aria-label="Session modes">
              {MODES.map((mode, index) => {
                const active = activeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    id={`v2-mode-tab-${mode.id}`}
                    aria-selected={active}
                    aria-controls="v2-mode-panel"
                    tabIndex={active ? 0 : -1}
                    className={`v2-modes-tab${active ? " is-active" : ""}`}
                    onClick={() => setActiveMode(mode.id)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "ArrowDown" &&
                        event.key !== "ArrowUp" &&
                        event.key !== "ArrowRight" &&
                        event.key !== "ArrowLeft"
                      ) {
                        return;
                      }
                      event.preventDefault();
                      const direction =
                        event.key === "ArrowDown" || event.key === "ArrowRight"
                          ? 1
                          : -1;
                      const next =
                        MODES[(index + direction + MODES.length) % MODES.length]!;
                      setActiveMode(next.id);
                      requestAnimationFrame(() => {
                        document.getElementById(`v2-mode-tab-${next.id}`)?.focus();
                      });
                    }}
                  >
                    <span className="v2-modes-tab-icon" aria-hidden>
                      {mode.id === "guided" ? (
                        <MessageCircle size={18} />
                      ) : (
                        <Play size={18} />
                      )}
                    </span>
                    <span className="v2-modes-tab-copy">
                      <strong>{mode.label}</strong>
                      <small>{mode.hint}</small>
                    </span>
                    <ArrowRight size={16} aria-hidden className="v2-modes-tab-arrow" />
                  </button>
                );
              })}
            </div>

            <div
              className={`v2-modes-stage is-${activeMode}`}
              id="v2-mode-panel"
              role="tabpanel"
              aria-labelledby={`v2-mode-tab-${activeMode}`}
            >
              <Image
                src={activeModeData.image}
                alt={activeModeData.alt}
                fill
                sizes="(max-width: 1100px) 100vw, 55vw"
                className="v2-modes-stage-img"
                unoptimized={needsUnoptimized(activeModeData.image)}
              />
              <span className="v2-modes-stage-tint" aria-hidden />
              <div className="v2-modes-stage-content" key={activeMode}>
                {activeMode === "guided" ? (
                  <div className="v2-chat v2-glass v2-glass--dark" aria-hidden>
                    <div className="v2-chat-head">
                      <span className="v2-chat-mark">n</span>
                      <strong>Session agent</strong>
                      <span className="v2-chat-live"><span />Live</span>
                    </div>
                    <div className="v2-chat-body">
                      <p className="v2-chat-msg is-agent">
                        What are you noticing now?
                      </p>
                      <p className="v2-chat-msg is-user">
                        My chest is a little tighter.
                      </p>
                      <p className="v2-chat-msg is-agent">
                        Stay with it. We can pause after this set.
                      </p>
                      <span className="v2-chat-typing">
                        <span /><span /><span />
                      </span>
                    </div>
                    <div className="v2-chat-composer">
                      Write a note…
                      <span><ArrowRight size={14} /></span>
                    </div>
                  </div>
                ) : (
                  <div className="v2-set v2-glass v2-glass--strong" aria-hidden>
                    <div className="v2-set-head">
                      <span>Set running</span>
                      <span>12 min</span>
                    </div>
                    <div className="v2-set-orbit">
                      <span className="v2-set-ring" />
                      <span className="v2-set-dot" />
                    </div>
                    <div className="v2-set-foot">
                      <span className="v2-set-chip"><Play size={14} /> Play</span>
                      <span className="v2-set-chip"><Headphones size={14} /> Sound</span>
                      <span className="v2-set-chip"><Volume2 size={14} /> 1.0×</span>
                    </div>
                  </div>
                )}
              </div>
              <span className="v2-modes-stage-badge">{activeModeData.label}</span>
            </div>

            <div className="v2-modes-info" key={`info-${activeMode}`}>
              <p className="v2-modes-info-kicker">{activeModeData.kicker}</p>
              <h3>
                <AccentText text={activeModeData.title} accent={activeModeData.accent} />
              </h3>
              <p>{activeModeData.body}</p>
              <ul className="v2-modes-chips">
                {activeModeData.chips.map((chip) => (
                  <li key={chip}>{chip}</li>
                ))}
              </ul>
              <Link href={sectionText(modesCopy, "linkHref")} className="v2-link">
                {sectionText(modesCopy, "link")}
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
          ) : null}
        </div>
      </section>
      </SectionRise>
      </EditablePart>
      ),

      "home-session": (
      <EditablePart id="home-session" backdrop={false}>
      <section
        className="v2-section v2-session"
        id="session"
        aria-labelledby="v2-session-title"
      >
        <div className="v2-container">
          <SectionHead
            kicker={sectionText(session, "kicker")}
            title={sectionText(session, "title")}
            accent={sectionText(session, "accent")}
            sub={sectionText(session, "sub")}
            id="v2-session-title"
          />

          <div className="v2-app-wrap">
            <div className="v2-app-glow" aria-hidden />
            <div className={`v2-video-frame fe-animate${SESSION_VIDEO_URL ? " is-video" : ""}`}>
              {SESSION_VIDEO_URL ? (
                SESSION_VIDEO_URL.endsWith(".mp4") ? (
                  <video
                    className="v2-video-iframe"
                    src={SESSION_VIDEO_URL}
                    controls
                    playsInline
                  />
                ) : (
                  <iframe
                    src={sessionEmbedUrl(SESSION_VIDEO_URL)}
                    title="Nura session walkthrough"
                    className="v2-video-iframe"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                )
              ) : (
                <>
                  <div className="v2-app" aria-hidden>
                    <div className="v2-app-bar">
                      <span className="v2-app-dots">
                        <span /><span /><span />
                      </span>
                      <span className="v2-app-title">Nura · Session</span>
                      <span className="v2-app-live"><span />Live</span>
                    </div>
                    <div className="v2-app-body">
                      <aside className="v2-app-rail">
                        <span className="v2-app-mark">n</span>
                        <span className="v2-app-rail-item is-active">
                          <Leaf size={15} /> Ground
                        </span>
                        <span className="v2-app-rail-item">
                          <Play size={15} /> Set
                        </span>
                        <span className="v2-app-rail-item">
                          <MessageCircle size={15} /> Check in
                        </span>
                        <span className="v2-app-rail-item">
                          <ShieldCheck size={15} /> Close
                        </span>
                      </aside>
                      <div className="v2-app-stage">
                        <div className="v2-app-stage-head">
                          <span className="v2-app-chip"><Leaf size={13} /> Grounded</span>
                          <span className="v2-app-clock">12:04</span>
                        </div>
                        <div className="v2-app-orb">
                          <span className="v2-app-orb-glow" />
                          <span className="v2-app-orb-ring" />
                          <span className="v2-app-dot" />
                        </div>
                        <p className="v2-app-prompt">Follow the light. Pause whenever you need.</p>
                        <div className="v2-app-controls">
                          <span className="v2-app-control"><Play size={15} /></span>
                          <span className="v2-app-track"><span /></span>
                          <span className="v2-app-control"><Volume2 size={15} /></span>
                        </div>
                      </div>
                      <aside className="v2-app-chat">
                        <p className="v2-app-chat-label">Session agent</p>
                        <p className="v2-app-msg v2-app-msg--agent">
                          What are you noticing now?
                        </p>
                        <p className="v2-app-msg v2-app-msg--user">
                          My chest is a little tighter.
                        </p>
                        <p className="v2-app-msg v2-app-msg--agent">
                          Stay with it. We can pause after this set.
                        </p>
                        <span className="v2-app-composer">Write a note…</span>
                      </aside>
                    </div>
                  </div>
                  <div className="v2-video-shade" aria-hidden />
                  <div className="v2-video-cover">
                    <span className="v2-video-play" aria-hidden>
                      <Play size={22} />
                    </span>
                    <p>{sectionText(session, "coverTitle")}</p>
                    <span>{sectionText(session, "coverNote")}</span>
                  </div>
                </>
              )}
            </div>

            <ul className="v2-app-features fe-animate">
              {sectionList(session, "features").map((feature, index) => {
                const Icon = featureIcons[feature.id ?? ""] ?? Sun;
                return (
                  <li key={feature.id || index}><Icon size={16} aria-hidden /> {feature.label}</li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
      </EditablePart>
      ),

      "home-topics": <SessionTopicsGrid id="topics" className="v2-section v2-topics" />,

      "home-stories": (
      <EditablePart id="home-stories" backdrop={false}>
      <section
        ref={storiesRef}
        className="v2-section v2-stories"
        id="stories"
        aria-labelledby="v2-stories-title"
      >
        <div className="v2-stories-stage">
          <div className="v2-container">
            <div className="v2-stories-head">
              <SectionHead
                kicker={sectionText(storiesCopy, "kicker")}
                title={sectionText(storiesCopy, "title")}
                accent={sectionText(storiesCopy, "accent")}
                sub={sectionText(storiesCopy, "sub")}
                id="v2-stories-title"
              />
              <div className="v2-stories-rating">
                <StarRow />
                <p><strong>{sectionText(storiesCopy, "rating")}</strong> {sectionText(storiesCopy, "ratingLine")}</p>
              </div>
            </div>
          </div>
          <div
            className="v2-story-viewport"
            role="region"
            aria-label="Stories from Nura members"
            tabIndex={0}
          >
            <div className="v2-story-track" ref={storyTrackRef}>
              {STORIES.map((story, index) => (
                <article
                  key={`${story.name}-${index}`}
                  className="v2-glass v2-glass--strong v2-story v2-story-card"
                >
                  <span className="v2-story-quote" aria-hidden>“</span>
                  <p>{story.quote}</p>
                  <StarRow className="v2-story-stars" />
                  <footer>
                    <span>
                      <strong>{story.name}</strong>
                      <span>{story.role}</span>
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      </EditablePart>
      ),

      "home-pricing": (
      <EditablePart id="home-pricing" backdrop={false}>
      <section className="v2-section v2-pricing" id="prices" aria-labelledby="v2-pricing-title">
        <div className="v2-container">
          <SectionHead
            kicker={sectionText(pricing, "kicker")}
            title={sectionText(pricing, "title")}
            accent={sectionText(pricing, "accent")}
            sub={sectionText(pricing, "sub")}
            id="v2-pricing-title"
          />
          <div
            className="v2-price-grid"
            ref={planGridRef}
            style={{ ["--plans-n" as string]: PLANS.length }}
          >
            {PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                cta={sectionText(pricing, "cta")}
                featuresLabel={sectionText(pricing, "featuresLabel")}
              />
            ))}
          </div>
          <p className="v2-pricing-note">{sectionText(pricing, "note")}</p>
        </div>
      </section>
      </EditablePart>
      ),

      "home-faq": <FaqSection />,
      "home-blog": (
      <BlogSection posts={blogPosts} />
      ),

      "home-close": (
      <EditablePart id="home-close" backdrop={false}>
      <section className="v2-close" id="start" aria-labelledby="v2-close-title">
        {closeBg ? (
          <BandBackground bg={closeBg} className="v2-close-img" frame={frameKey("home-close", "bgImage")} />
        ) : (
          <Image
            src="/marketing/landing/green-meadow.jpg"
            alt=""
            fill
            sizes="100vw"
            className="v2-close-img"
          />
        )}
        {/* Built-in tint only over the default photo; a custom background uses the editor overlay. */}
        {closeBg ? null : <span className="v2-close-tint" aria-hidden />}
        <div className="v2-close-inner">
          <div className="v2-glass v2-glass--dark v2-close-card fe-animate">
            <p className="v2-kicker">{sectionText(close, "kicker")}</p>
            <h2 id="v2-close-title">
              <Accent text={sectionText(close, "title")} accent={sectionText(close, "accent")} />
            </h2>
            <p>{sectionText(close, "body")}</p>
            <div className="v2-close-actions">
              <Link href={sectionText(close, "primaryHref")} className="v2-btn v2-btn--primary">
                {sectionText(close, "primary")}
                <ArrowRight size={16} aria-hidden />
              </Link>
              {sectionText(close, "secondary") ? (
                <Link href={sectionText(close, "secondaryHref") || "/safety"} className="v2-btn v2-btn--ghost">
                  {sectionText(close, "secondary")}
                </Link>
              ) : null}
            </div>
            <p className="v2-close-note">{sectionText(close, "note")}</p>
          </div>
        </div>
      </section>
      </EditablePart>
      ),
        }}
      />
    </div>
  );
}
