"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  Play,
  Star,
} from "lucide-react";
import { appPath } from "@/lib/app-base";
import {
  BRAND_SPOKEN,
  SESSION_MODE_GUIDED_SHORT,
  SESSION_MODE_SELF_SHORT,
} from "@/lib/brand";
import {
  BILLING_PLANS,
  TRIAL_DAYS,
} from "@/lib/billing-constants";
import {
  formatBlogDate,
  type LandingBlogPost,
} from "@/lib/landing-blog";
import { LANDING_FAQ_ITEMS } from "@/lib/landing-faq";
import { scheduleScrollToLandingHash } from "@/lib/landing-scroll";
import { MARKETING_PRICING_CARDS } from "./marketingPricingCards";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SessionPathSticky } from "./SessionPathSticky";
import { SessionTopicsGrid } from "./SessionTopicsGrid";
import { HomePauseCta } from "./HomePauseCta";
import { HomeMemorySets } from "./HomeMemorySets";
import { SessionModesPair } from "./SessionModesPair";
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

const TESTIMONIALS = [
  {
    quote:
      "The interface feels calm enough to actually stay with a difficult memory. Self-guided sessions let me practice without an agent.",
    name: "Maya L.",
    role: "Trial member",
    image: IMG.avatarMaya,
  },
  {
    quote:
      "The session agent walks me through phases instead of dumping me into a blank screen.",
    name: "James R.",
    role: "Monthly plan",
    image: IMG.avatarJames,
  },
  {
    quote:
      "Resources are short and clear — finally something that explains EMDR without overwhelming me.",
    name: "Sophie T.",
    role: "Resources reader",
    image: IMG.avatarSophie,
  },
  {
    quote:
      "I use it between sessions. The steps feel structured but never rushed.",
    name: "Daniel K.",
    role: "Yearly plan",
    image: IMG.avatarDaniel,
  },
  {
    quote:
      "I open Self-guided when I need a quiet set — no agent, no pressure, just the controls I need.",
    name: "Elena P.",
    role: "Weekly plan",
    image: IMG.avatarMaya,
  },
  {
    quote:
      "Nura stays out of the way. I get enough structure to feel held, without clinical noise.",
    name: "Chris W.",
    role: "Trial member",
    image: IMG.avatarJames,
  },
];

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

  const loop = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="fe-stories" aria-labelledby="fe-stories-title">
      <div className="fe-container">
        <div className="fe-stories-intro">
          <LetterRevealHeading
            id="fe-stories-title"
            className="fe-stories-title"
          >
            Their experience, your confidence
          </LetterRevealHeading>
          <p className="fe-stories-sub">
            Voices from people using {BRAND_SPOKEN} between sessions — calm
            enough to stay with the work.
          </p>
        </div>

        <div className="fe-stories-toolbar">
          <div className="fe-stories-rating">
            <div className="fe-stories-avatars" aria-hidden>
              {TESTIMONIALS.slice(0, 4).map((t) => (
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
                <strong>4.9</strong>
              </div>
              <p>From early members exploring {BRAND_SPOKEN}</p>
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

const HERO_IMAGE = IMG.supportTalk;
const HERO_PREVIEW_IMAGE = IMG.calmRest;

/** Nexsas home/blog stagger — fixed crop heights across 3 columns. */
const HOME_BLOG_HEIGHTS = [420, 320, 520] as const;
const HOME_BLOG_PAGE_SIZE = 5;

function BlogSection({ posts }: { posts: LandingBlogPost[] }) {
  const [visibleCount, setVisibleCount] = useState(HOME_BLOG_PAGE_SIZE);

  if (posts.length === 0) return null;

  const visible = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  const columns: LandingBlogPost[][] = [[], [], []];
  visible.forEach((post, i) => {
    columns[i % 3]!.push(post);
  });

  return (
    <section className="fe-blog" id="blog" aria-labelledby="fe-blog-title">
      <div className="fe-container fe-blog-inner">
        <div className="fe-blog-head">
          <p className="fe-section-kicker fe-animate">Blog</p>
          <LetterRevealHeading id="fe-blog-title" className="fe-blog-title">
            Guides for practice between sessions
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
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState(0);

  return (
    <section className="fe-faq" id="faq" aria-labelledby="fe-faq-title">
      <div className="fe-container">
        <div className="fe-faq-head">
          <p className="fe-section-kicker fe-animate">FAQ</p>
          <LetterRevealHeading id="fe-faq-title" className="fe-faq-title">
            Questions, answered calmly
          </LetterRevealHeading>
          <p className="fe-faq-sub fe-animate">
            Short answers about how Nura works — before you start a trial or open a
            session.
          </p>
        </div>
        <div className="fe-faq-list">
          {LANDING_FAQ_ITEMS.map((item, i) => {
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
      <section className="fe-hero" id="home">
        <div className="fe-hero-image-wrap">
          <div className="fe-hero-image">
            <Image
              src={HERO_IMAGE}
              alt="Person in a calm, supportive setting"
              fill
              priority
              sizes="100vw"
              className="fe-hero-image-bg"
            />
            <div className="fe-hero-image-overlay" aria-hidden />
            <div className="fe-hero-content-wrap">
              <div className="fe-container">
                <div className="fe-hero-info-inner">
                  <div className="fe-hero-left">
                    <p className="fe-hero-kicker">The time is right for</p>
                    <h1 className="fe-hero-title">
                      <span className="fe-hero-title-line">
                        {["EMDR", "therapy", "online"].map((word, i, arr) => (
                          <span key={word} className="fe-split-line">
                            <span className="fe-split-word">
                              {word}
                              {i < arr.length - 1 ? "\u00A0" : ""}
                            </span>
                          </span>
                        ))}
                      </span>{" "}
                      <span className="fe-hero-title-line fe-hero-title-line--accent">
                        <em>
                          {["in", "a", "calm", "app."].map((word, i, arr) => (
                            <span key={word} className="fe-split-line">
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
                      Visual sets, optional voice, and readable resources —
                      structured support on your schedule. Self-help, not a
                      licensed therapist.
                    </p>
                    <div className="fe-hero-card-row">
                      <div className="fe-hero-inner-card">
                        <span className="fe-hero-inner-icon" aria-hidden>
                          <HeartHandshake size={22} strokeWidth={1.5} />
                        </span>
                        <div className="fe-hero-inner-text">
                          <p className="fe-hero-inner-label">
                            Support you can trust
                          </p>
                          <Link href="/learn" className="fe-hero-inner-link">
                            Learn
                          </Link>
                        </div>
                      </div>
                      <Link
                        href="/learn"
                        className="fe-hero-video-thumb"
                        aria-label="Learn where to start"
                      >
                        <DecorativeImg
                          src={HERO_PREVIEW_IMAGE}
                          width={160}
                          height={112}
                          className="fe-hero-video-image"
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

      <SessionPathSticky />

      <SessionTopicsGrid />

      <SessionModesPair />

      <HomePauseCta />

      <HomeMemorySets />

      <section className="fe-pricing-section" id="prices">
        <div className="fe-container">
          <div className="fe-pricing-head">
            <LetterRevealHeading className="fe-pricing-title">
              Plans tailored to your pace
            </LetterRevealHeading>
            <p className="fe-pricing-sub fe-animate">
              Start with a {TRIAL_DAYS}-day trial. Every paid plan unlocks the same{" "}
              {SESSION_MODE_GUIDED_SHORT} sessions and {SESSION_MODE_SELF_SHORT}{" "}
              sessions — pick how often you want to be billed.
            </p>
          </div>

          <div className="fe-pricing-grid">
            {MARKETING_PRICING_CARDS.map((card) => {
              const plan = BILLING_PLANS[card.id];
              const featured = Boolean(card.featured);
              const Icon = card.icon;
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
                    Get started
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                  <p className="fe-price-card-features-label">Features</p>
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

      <StoriesSection />

      <BlogSection posts={blogPosts} />

      <FaqSection />
    </div>
  );
}
