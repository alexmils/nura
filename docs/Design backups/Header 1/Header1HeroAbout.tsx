/**
 * BACKUP — Header 1 (home hero + “Here when you need us”)
 * Captured 2026-09-13 from app/components/frontend/HomeLanding.tsx
 *
 * Not wired into the app. To restore:
 * 1. Copy this file into app/components/frontend/ (or paste the sections into HomeLanding).
 * 2. Import "./header-1.css" (or merge rules into landing-motion.css).
 * 3. Wrap the page in useLandingMotion / .fe-landing so .fe-split-word + .fe-about-word animate.
 * 4. Confirm images exist under public/marketing/landing/.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Play, Users } from "lucide-react";
import { BRAND_SPOKEN } from "@/lib/brand";

const IMG = {
  calmRest: "/marketing/landing/calm-rest.jpg",
  greenLandscape: "/marketing/landing/green-landscape.jpg",
  supportTalk: "/marketing/landing/support-talk.jpg",
  practiceSpace: "/marketing/landing/practice-space.jpg",
  reading: "/marketing/landing/reading.jpg",
  eveningLight: "/marketing/landing/evening-light.jpg",
  softWindow: "/marketing/landing/soft-window.jpg",
  quietHands: "/marketing/landing/quiet-hands.jpg",
} as const;

const HERO_IMAGE = IMG.supportTalk;
const HERO_PREVIEW_IMAGE = IMG.calmRest;

const ABOUT_IMAGES = [
  { src: IMG.calmRest, alt: "Calm moment of rest" },
  { src: IMG.greenLandscape, alt: "Soft green landscape" },
  { src: IMG.supportTalk, alt: "Supportive conversation" },
  { src: IMG.practiceSpace, alt: "Quiet practice space" },
  { src: IMG.reading, alt: "Reading and reflection" },
  { src: IMG.eveningLight, alt: "Gentle evening light" },
  { src: IMG.softWindow, alt: "Soft window light" },
  { src: IMG.quietHands, alt: "Quiet hands at rest" },
];

const ABOUT_COPY = `At ${BRAND_SPOKEN}, we believe therapy support is more than a blank screen — it’s a commitment to calmer sessions and clearer steps. Agent-guided EMDR when you want a session agent with you, Free sessions when you run the sets yourself, and readable resources — we keep the workspace quiet so you can stay with what matters.`;

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

function AboutRevealText({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  return (
    <h2 className="fe-about-title">
      {words.map((word, i) => (
        <span key={`w-${i}`}>
          <span className="fe-about-word">{word}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h2>
  );
}

/** Drop-in backup of the original home hero + about band. */
export function Header1HeroAbout() {
  return (
    <>
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

      <section className="fe-about">
        <div className="fe-container fe-about-inner">
          <div className="fe-about-kicker-wrap fe-animate">
            <Users size={16} strokeWidth={1.75} aria-hidden />
            <p className="fe-about-kicker">Here when you need us</p>
          </div>
          <AboutRevealText text={ABOUT_COPY} />
        </div>

        <div className="fe-about-marquee fe-animate" aria-hidden>
          <div className="fe-about-marquee-fade fe-about-marquee-fade--left" />
          <div className="fe-about-marquee-fade fe-about-marquee-fade--right" />
          <div className="fe-about-marquee-track">
            {[...ABOUT_IMAGES, ...ABOUT_IMAGES].map((img, i) => (
              <div key={`${img.src}-${i}`} className="fe-about-marquee-item">
                <DecorativeImg
                  src={img.src}
                  width={280}
                  height={280}
                  className="fe-about-marquee-image"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="fe-container fe-about-cta-wrap fe-animate">
          <Link href="/about" className="fe-about-cta">
            More about {BRAND_SPOKEN}
            <span className="fe-about-cta-icon" aria-hidden>
              <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}

export default Header1HeroAbout;
