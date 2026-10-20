"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
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
} from "@/lib/marketing-sections";
import { EditablePart, GradientLayer } from "./section-editor/EditablePart";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import { PageSections } from "./section-editor/PageSections";
import { AccentText } from "./AccentText";
import { BlogSection, FaqSection } from "./HomeLanding";
import { SessionPathSticky } from "./SessionPathSticky";
import { SessionTopicsGrid } from "./SessionTopicsGrid";
import { useLandingMotion } from "./useLandingMotion";
import { usePlanSpread } from "./usePlanSpread";
import "lenis/dist/lenis.css";
import "./landing-motion.css";
import "./landing-v2.css";

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
function BandBackground({ bg, className }: { bg: SectionBackground; className: string }) {
  const fill = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as const;
  return (
    <>
      {bg.kind === "video" ? (
        <video className={className} src={bg.video} poster={bg.poster || undefined} autoPlay muted loop playsInline style={fill} />
      ) : bg.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={className} src={bg.image} alt="" style={fill} />
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
      {plan.featured ? <span className="v2-price-glow" aria-hidden /> : null}
      <div className="v2-price-top">
        <div>
          <h3 className="v2-price-name">{plan.name}</h3>
          {plan.badge ? <span className="v2-price-badge">{plan.badge}</span> : null}
        </div>
        <div className="v2-price-cost">
          <span className="v2-price-amount">{meta.displayPrice}</span>
          <span className="v2-price-period">per {meta.interval}</span>
          {plan.note ? <span className="v2-price-note">{plan.note}</span> : null}
        </div>
      </div>
      <p className="v2-price-details">{plan.details}</p>
      <Link
        href={appPath("/create-account")}
        className={`v2-btn${plan.featured ? " v2-btn--primary" : " v2-btn--outline"}`}
      >
        {cta}
        <ArrowRight size={16} aria-hidden />
      </Link>
      <p className="v2-price-features-label">{featuresLabel}</p>
      <ul className="v2-price-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check size={16} strokeWidth={2.4} aria-hidden />
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
  // Sky, sun and haze belong to the Default background only (and can be switched off).
  const heroDecor = sectionDecor(hero);
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
  const SESSION_VIDEO_URL = sectionText(session, "videoUrl").trim();
  const planGridRef = useRef<HTMLDivElement | null>(null);
  usePlanSpread(planGridRef, PLANS.map((plan) => plan.id).join(","));
  const trustIcons = [Check, Check, ShieldCheck];
  const stripIcons: Record<string, typeof Check> = { trial: Check, cancel: Check, private: Lock, between: Sparkles };
  const featureIcons: Record<string, typeof Check> = { sets: Sun, voice: Headphones, ground: Leaf, notes: Lock };

  const [activeStory, setActiveStory] = useState(0);
  const [storiesPaused, setStoriesPaused] = useState(false);
  const [activeMode, setActiveMode] = useState<string>("guided");
  const activeModeData = MODES.find((mode) => mode.id === activeMode) ?? MODES[0];

  useEffect(() => {
    if (storiesPaused || STORIES.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => {
      setActiveStory((i) => (i + 1) % STORIES.length);
    }, 5500);
    return () => window.clearTimeout(id);
  }, [activeStory, storiesPaused, STORIES.length]);

  const goStory = (dir: -1 | 1) => {
    if (!STORIES.length) return;
    setActiveStory((i) => (i + dir + STORIES.length) % STORIES.length);
  };

  const storyAt = Math.min(activeStory, Math.max(0, STORIES.length - 1));
  const visibleStories = !STORIES.length ? [] : [
    {
      story: STORIES[(storyAt - 1 + STORIES.length) % STORIES.length]!,
      position: "prev" as const,
    },
    {
      story: STORIES[storyAt]!,
      position: "active" as const,
    },
    {
      story: STORIES[(storyAt + 1) % STORIES.length]!,
      position: "next" as const,
    },
  ];

  return (
    <div ref={landingRef} className="fe-v2">
      <PageSections
        page="home"
        slots={{
      "home-hero": (
      <EditablePart id="home-hero" lift backdrop={false}>
      <section className={heroDecor ? "v2-hero" : "v2-hero v2-hero--plain"} id="home" aria-labelledby="v2-hero-title">
        {heroDecor ? <div className="v2-hero-sky" aria-hidden /> : null}
        {heroDecor ? <div className="v2-hero-sun" aria-hidden /> : null}
        {heroGrad && !heroGradOver ? <GradientLayer gradient={heroGrad} className="v2-hero-grad v2-hero-grad--bg" /> : null}
        <div className="v2-hero-photo" aria-hidden hidden={Boolean(heroGrad && !heroGradOver)}>
          {heroBg ? (
            <BandBackground bg={heroBg} className="v2-hero-photo-img" />
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

        <div className="v2-hero-inner">
          <div className="v2-hero-copy">
            <p className="v2-hero-kicker">
              <span className="v2-hero-kicker-dot" aria-hidden />
              {sectionText(hero, "kicker")}
            </p>
            <h1 className="v2-hero-title" id="v2-hero-title">
              <span className="v2-hero-title-line">{sectionText(hero, "title1")}</span>
              <span className="v2-hero-title-line">
                <Accent text={sectionText(hero, "title2")} accent={sectionText(hero, "accent")} className="v2-em v2-hero-em" />
              </span>
            </h1>
            <p className="v2-hero-sub">{sectionText(hero, "sub")}</p>
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
          </div>
        </div>
      </section>
      </EditablePart>
      ),

      "home-trust": (
      <EditablePart id="home-trust" backdrop={false}>
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
      </EditablePart>
      ),

      "home-how": <SessionPathSticky />,

      "home-modes": (
      <EditablePart id="home-modes" backdrop={false}>
      <SectionRise from={4} radius={40}>
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
      <section className="v2-section v2-stories" id="stories" aria-labelledby="v2-stories-title">
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
          <div
            className="v2-story-slider"
            role="region"
            aria-roledescription="carousel"
            aria-label="Stories from Nura members"
            onMouseEnter={() => setStoriesPaused(true)}
            onMouseLeave={() => setStoriesPaused(false)}
            onFocusCapture={() => setStoriesPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setStoriesPaused(false);
              }
            }}
          >
            <div className="v2-story-focus" aria-live="polite">
              {visibleStories.map(({ story, position }) => (
                <article
                  key={`${position}-${story.name}`}
                  className={`v2-glass v2-glass--strong v2-story v2-story-card is-${position}`}
                  aria-hidden={position !== "active"}
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

            <div className="v2-story-controls">
              <button
                type="button"
                className="v2-story-nav"
                aria-label="Previous story"
                onClick={() => goStory(-1)}
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
              <div className="v2-story-dots">
                {STORIES.map((story, index) => (
                  <button
                    key={story.name}
                    type="button"
                    className={`v2-story-dot${index === storyAt ? " is-active" : ""}`}
                    aria-label={`Show story ${index + 1}`}
                    aria-current={index === storyAt ? "true" : undefined}
                    onClick={() => setActiveStory(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="v2-story-nav"
                aria-label="Next story"
                onClick={() => goStory(1)}
              >
                <ChevronRight size={18} aria-hidden />
              </button>
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
          <BandBackground bg={closeBg} className="v2-close-img" />
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
