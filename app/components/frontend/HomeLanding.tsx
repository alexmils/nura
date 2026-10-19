"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import { appPath } from "@/lib/app-base";
import {
  BILLING_PLANS,
  type BillingPlanId,
} from "@/lib/billing-constants";
import {
  formatBlogDate,
  type LandingBlogPost,
} from "@/lib/landing-blog";
import { scheduleScrollToLandingHash } from "@/lib/landing-scroll";
import {
  linesOf,
  sectionList,
  sectionText,
  type SectionConfig,
  type SectionItem,
} from "@/lib/marketing-sections";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { PageSections } from "./section-editor/PageSections";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import { SessionPathSticky } from "./SessionPathSticky";
import { SessionTopicsGrid } from "./SessionTopicsGrid";
import { HomePauseCta } from "./HomePauseCta";
import { HomeMemorySets } from "./HomeMemorySets";
import { SessionModesPair } from "./SessionModesPair";
import { SectionMedia } from "./SectionMedia";
import { useLandingMotion } from "./useLandingMotion";
import "lenis/dist/lenis.css";
import "./landing-motion.css";

/** Local marketing photos (self-hosted — Unsplash remote was flaky). */
const IMG = {
  calmRest: "/marketing/landing/calm-rest.jpg",
  supportTalk: "/marketing/landing/support-talk.jpg",
  reading: "/marketing/landing/reading.jpg",
  avatarMaya: "/marketing/landing/avatar-maya.jpg",
  avatarJames: "/marketing/landing/avatar-james.jpg",
  avatarSophie: "/marketing/landing/avatar-sophie.jpg",
  avatarDaniel: "/marketing/landing/avatar-daniel.jpg",
} as const;

/** Decorative photos — native img so next/image does not emit 10+ srcset variants each. */
function DecorativeImg({
  src,
  width,
  height,
  className,
}: {
  src: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative; avoid srcset HTML bloat
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

const STORY_IMAGES = [
  IMG.avatarMaya,
  IMG.avatarJames,
  IMG.avatarSophie,
  IMG.avatarDaniel,
] as const;

const PLAN_ICONS = {
  weekly: Calendar,
  yearly: HeartHandshake,
  monthly: Sparkles,
} as const;

function planCards(config: SectionConfig) {
  return sectionList(config, "cards").flatMap((card) => {
    const id = card.id as BillingPlanId;
    if (!BILLING_PLANS[id]) return [];
    return [
      {
        id,
        title: card.title,
        badge: card.badge,
        details: card.details,
        periodNote: card.periodNote,
        features: linesOf(card.features ?? ""),
        featured: id === "yearly",
      },
    ];
  });
}

function StoriesStars({ className }: { className?: string }) {
  return (
    <span className={className ?? "fe-stories-stars"} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

function StoriesSection() {
  const copy = useSectionConfig("home-stories");
  const stories = sectionList(copy, "stories").map((story, index): SectionItem => ({
    ...story,
    image: story.image || STORY_IMAGES[index % STORY_IMAGES.length] || IMG.avatarMaya,
  }));
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const hoverPaused = useRef(false);
  const manualPaused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    let last = performance.now();
    const speed = 36;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!hoverPaused.current && !manualPaused.current) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  function pauseBriefly() {
    manualPaused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      manualPaused.current = false;
    }, 4500);
  }

  function scrollByDir(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    pauseBriefly();
    const card = el.querySelector(".fe-stories-card");
    const step =
      (card instanceof HTMLElement ? card.offsetWidth : 320) + 16;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const loop = [...stories, ...stories];

  return (
    <section className="fe-stories fe-has-edit" data-section="home-stories" aria-labelledby="fe-stories-title">
      <SectionEdit id="home-stories" />
      <div className="fe-container">
        <div className="fe-stories-intro">
          <LetterRevealHeading
            id="fe-stories-title"
            className="fe-stories-title"
          >
            {sectionText(copy, "title")}
          </LetterRevealHeading>
          <p className="fe-stories-sub">
            {sectionText(copy, "sub")}
          </p>
        </div>

        <div className="fe-stories-toolbar">
          <div className="fe-stories-rating">
            <div className="fe-stories-avatars" aria-hidden>
              {stories.slice(0, 4).map((t) => (
                <DecorativeImg
                  key={t.name}
                  src={t.image}
                  width={40}
                  height={40}
                  className="fe-stories-avatar-stack"
                />
              ))}
            </div>
            <div className="fe-stories-rating-copy">
              <div className="fe-stories-rating-row">
                <StoriesStars />
                <strong>{sectionText(copy, "rating")}</strong>
              </div>
              <p>{sectionText(copy, "ratingLine")}</p>
            </div>
          </div>
          <div className="fe-stories-nav">
            <button
              type="button"
              className="fe-stories-nav-btn"
              aria-label="Previous stories"
              onClick={() => scrollByDir(-1)}
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              className="fe-stories-nav-btn fe-stories-nav-btn--accent"
              aria-label="Next stories"
              onClick={() => scrollByDir(1)}
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div
        className="fe-stories-scroller"
        ref={scrollerRef}
        onMouseEnter={() => {
          hoverPaused.current = true;
        }}
        onMouseLeave={() => {
          hoverPaused.current = false;
        }}
        onFocusCapture={() => {
          hoverPaused.current = true;
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            hoverPaused.current = false;
          }
        }}
      >
        <div className="fe-stories-track">
          {loop.map((t, i) => (
            <blockquote
              key={`${t.name}-${i}`}
              className="fe-stories-card"
            >
              <span className="fe-stories-quote" aria-hidden>
                &ldquo;
              </span>
              <p>{t.quote}</p>
              <StoriesStars className="fe-stories-card-stars" />
              <footer>
                <DecorativeImg
                  src={t.image}
                  width={48}
                  height={48}
                  className="fe-stories-card-avatar"
                />
                <span className="fe-stories-card-meta">
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Nexsas home/blog stagger — fixed crop heights across 3 columns. */
const HOME_BLOG_HEIGHTS = [420, 320, 520] as const;
const HOME_BLOG_PAGE_SIZE = 5;

function BlogSection({ posts }: { posts: LandingBlogPost[] }) {
  const copy = useSectionConfig("home-blog");
  const [visibleCount, setVisibleCount] = useState(HOME_BLOG_PAGE_SIZE);

  if (posts.length === 0) return null;

  const visible = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  const columns: LandingBlogPost[][] = [[], [], []];
  visible.forEach((post, i) => {
    columns[i % 3]!.push(post);
  });

  return (
    <section className="fe-blog fe-has-edit" id="blog" data-section="home-blog" aria-labelledby="fe-blog-title">
      <SectionEdit id="home-blog" />
      <div className="fe-container fe-blog-inner">
        <div className="fe-blog-head">
          <p className="fe-section-kicker fe-animate">{sectionText(copy, "kicker")}</p>
          <LetterRevealHeading id="fe-blog-title" className="fe-blog-title">
            {sectionText(copy, "title")}
          </LetterRevealHeading>
        </div>

        <div className="fe-blog-masonry" role="list">
          {columns.map((colPosts, col) => (
            <div key={col} className="fe-blog-masonry-col" role="presentation">
              {colPosts.map((post, row) => {
                const date = formatBlogDate(post.createdAt);
                const mins = post.readMinutes ?? 2;
                const height =
                  HOME_BLOG_HEIGHTS[(col + row) % HOME_BLOG_HEIGHTS.length]!;
                return (
                  <article
                    key={post.slug}
                    className="fe-blog-masonry-item"
                    role="listitem"
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="fe-blog-masonry-card"
                    >
                      <span
                        className="fe-blog-masonry-media"
                        style={{ height }}
                      >
                        <Image
                          src={post.coverUrl || IMG.reading}
                          alt=""
                          fill
                          priority={false}
                          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
                          className="fe-blog-masonry-image"
                        />
                      </span>
                      <span className="fe-blog-masonry-body">
                        <span className="fe-blog-masonry-meta">
                          {date ? <span>{date}</span> : null}
                          <span>{mins} min read</span>
                        </span>
                        <span className="fe-blog-masonry-title">{post.title}</span>
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>
          ))}
        </div>

        {hasMore ? (
          <div className="fe-blog-more">
            <button
              type="button"
              className="fe-blog-load-more"
              onClick={() =>
                setVisibleCount((n) =>
                  Math.min(n + HOME_BLOG_PAGE_SIZE, posts.length)
                )
              }
            >
              {sectionText(copy, "more")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FaqSection() {
  const copy = useSectionConfig("home-faq");
  const items = sectionList(copy, "items");
  const [open, setOpen] = useState(0);

  return (
    <section className="fe-faq fe-has-edit" id="faq" data-section="home-faq" aria-labelledby="fe-faq-title">
      <SectionEdit id="home-faq" />
      <div className="fe-container">
        <div className="fe-faq-head">
          <p className="fe-section-kicker fe-animate">{sectionText(copy, "kicker")}</p>
          <LetterRevealHeading id="fe-faq-title" className="fe-faq-title">
            {sectionText(copy, "title")}
          </LetterRevealHeading>
          <p className="fe-faq-sub fe-animate">
            {sectionText(copy, "sub")}
          </p>
        </div>
        <div className="fe-faq-list">
          {items.map((item, i) => {
            const isOpen = open === i;
            const answerId = `fe-faq-a-${i}`;
            return (
              <div
                key={item.q}
                className={`fe-faq-item fe-animate${isOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="fe-faq-q"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <span className="fe-faq-icon" aria-hidden>
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <p id={answerId} className="fe-faq-a" hidden={!isOpen}>
                  {item.a}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomeLanding({
  blogPosts = [],
}: {
  blogPosts?: LandingBlogPost[];
}) {
  const hero = useSectionConfig("home-hero");
  const pricing = useSectionConfig("home-pricing");
  const cardCopy = useSectionConfig("pricing-cards");
  const cards = planCards(cardCopy);
  const landingRef = useRef<HTMLDivElement | null>(null);
  useLandingMotion(landingRef);

  useEffect(() => {
    let stop = scheduleScrollToLandingHash({ consumePending: true });
    const onHashChange = () => {
      stop();
      stop = scheduleScrollToLandingHash({ consumePending: true });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      stop();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return (
    <div ref={landingRef} className="fe-landing">
      <PageSections
        page="home"
        slots={{
      "home-hero": (
      <section className="fe-hero fe-has-edit" id="home" data-section="home-hero">
        <SectionEdit id="home-hero" lift />
        <div className="fe-hero-image-wrap">
          <div className="fe-hero-image">
            <SectionMedia
              className="fe-hero-image-bg"
              kind={sectionText(hero, "heroKind")}
              image={sectionText(hero, "heroImage")}
              video={sectionText(hero, "heroVideo")}
              poster={sectionText(hero, "heroPoster")}
              alt={sectionText(hero, "heroAlt")}
            />
            <div className="fe-hero-image-overlay" aria-hidden />
            <div className="fe-hero-content-wrap">
              <div className="fe-container">
                <div className="fe-hero-info-inner">
                  <div className="fe-hero-left">
                    <p className="fe-hero-kicker">{sectionText(hero, "kicker")}</p>
                    <h1 className="fe-hero-title">
                      <span className="fe-hero-title-line">
                        {sectionText(hero, "title").split(/\s+/).filter(Boolean).map((word, i, arr) => (
                          <span key={`${word}-${i}`} className="fe-split-line">
                            <span className="fe-split-word">
                              {word}
                              {i < arr.length - 1 ? "\u00A0" : ""}
                            </span>
                          </span>
                        ))}
                      </span>{" "}
                      <span className="fe-hero-title-line fe-hero-title-line--accent">
                        <em>
                          {sectionText(hero, "accent").split(/\s+/).filter(Boolean).map((word, i, arr) => (
                            <span key={`${word}-${i}`} className="fe-split-line">
                              <span className="fe-split-word">
                                {word}
                                {i < arr.length - 1 ? "\u00A0" : ""}
                              </span>
                            </span>
                          ))}
                        </em>
                      </span>
                    </h1>
                  </div>
                  <div className="fe-hero-right">
                    <p className="fe-hero-description">
                      {sectionText(hero, "description")}
                    </p>
                    <div className="fe-hero-card-row">
                      <div className="fe-hero-inner-card">
                        <span className="fe-hero-inner-icon" aria-hidden>
                          <HeartHandshake size={22} strokeWidth={1.5} />
                        </span>
                        <div className="fe-hero-inner-text">
                          <p className="fe-hero-inner-label">
                            {sectionText(hero, "cardLabel")}
                          </p>
                          <Link href={sectionText(hero, "cardHref")} className="fe-hero-inner-link">
                            {sectionText(hero, "cardLink")}
                          </Link>
                        </div>
                      </div>
                      <Link
                        href="/learn"
                        className="fe-hero-video-thumb"
                        aria-label="Learn where to start"
                      >
                        <SectionMedia
                          className="fe-hero-video-image"
                          kind={sectionText(hero, "thumbKind")}
                          image={sectionText(hero, "thumbImage")}
                          video={sectionText(hero, "thumbVideo")}
                          poster={sectionText(hero, "thumbPoster")}
                          alt={sectionText(hero, "thumbAlt")}
                        />
                        <span className="fe-hero-video-play" aria-hidden>
                          <Play size={18} fill="currentColor" />
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      ),
      "home-how": <SessionPathSticky />,
      "home-topics": <SessionTopicsGrid />,
      "home-modes": <SessionModesPair />,
      "home-pause": <HomePauseCta />,
      "home-memory": <HomeMemorySets />,
      "home-pricing": (
      <section className="fe-pricing-section fe-has-edit" id="prices" data-section="home-pricing">
        <SectionEdit id="home-pricing" />
        <div className="fe-container">
          <div className="fe-pricing-head">
            <LetterRevealHeading className="fe-pricing-title">
              {sectionText(pricing, "title")}
            </LetterRevealHeading>
            <p className="fe-pricing-sub fe-animate">
              {sectionText(pricing, "sub")}
            </p>
          </div>

          <div className="fe-pricing-grid">
            {cards.map((card) => {
              const plan = BILLING_PLANS[card.id];
              const featured = card.featured;
              const Icon = PLAN_ICONS[card.id] ?? Sparkles;
              return (
                <article
                  key={card.id}
                  className={`fe-price-card fe-animate${featured ? " fe-price-card--featured" : ""}`}
                >
                  <div className="fe-price-card-top">
                    <span className="fe-price-card-icon" aria-hidden>
                      <Icon size={22} strokeWidth={1.5} />
                    </span>
                    <div className="fe-price-card-cost">
                      <span className="fe-price-card-amount">
                        {plan.displayPrice}
                      </span>
                      <span className="fe-price-card-period">
                        {plan.displayPeriod.replace("/", "/per ")}
                      </span>
                      {card.periodNote ? (
                        <span className="fe-price-card-period-note">
                          {card.periodNote}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="fe-price-card-name">{card.title}</h3>
                  {card.badge ? (
                    <p className="fe-price-card-hint">{card.badge}</p>
                  ) : null}
                  <p className="fe-price-card-details">{card.details}</p>
                  <Link
                    href={appPath("/create-account")}
                    className={`fe-price-card-cta${featured ? " fe-price-card-cta--accent" : ""}`}
                  >
                    {sectionText(cardCopy, "cta")}
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                  <p className="fe-price-card-features-label">{sectionText(pricing, "featuresLabel")}</p>
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
      ),
      "home-stories": <StoriesSection />,
      "home-blog": <BlogSection posts={blogPosts} />,
      "home-faq": <FaqSection />,
        }}
      />
    </div>
  );
}
