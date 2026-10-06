"use client";

import Link from "next/link";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";
import { LetterRevealHeading } from "./LetterRevealHeading";
import "./session-topics-grid.css";

const CORE_LOGO = "/brand/nura-circle-variants/O-mint-on-ink.png";

export function SessionTopicsGrid() {
  const count = BLOG_CATEGORIES.length;

  return (
    <section className="fe-topics" aria-labelledby="fe-topics-title">
      <div className="fe-container fe-topics-frame">
        <div className="fe-topics-head">
          <LetterRevealHeading id="fe-topics-title" className="fe-topics-title">
            People start with.
          </LetterRevealHeading>
          <p className="fe-section-kicker fe-topics-kicker fe-animate">Guides</p>
        </div>

        <div className="fe-topics-stage">
          <div className="fe-topics-orbit">
            <div className="fe-topics-glow" aria-hidden />
            <div className="fe-topics-ring fe-topics-ring--outer" aria-hidden />
            <div className="fe-topics-ring fe-topics-ring--mid" aria-hidden />

            <div className="fe-topics-core" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element -- circle lockup asset; avoid srcset bloat */}
              <img
                className="fe-topics-core-logo"
                src={CORE_LOGO}
                alt=""
                width={512}
                height={512}
                decoding="async"
                loading="lazy"
              />
            </div>

            <ul
              className="fe-topics-spin"
              style={{ ["--topics-n" as string]: count }}
            >
              {BLOG_CATEGORIES.map((category, index) => (
                <li
                  key={category.slug}
                  className="fe-topics-item"
                  style={{ ["--topics-i" as string]: index }}
                >
                  <span className="fe-topics-counter">
                    <Link
                      href={`/blog/category/${category.slug}`}
                      className="fe-topics-link"
                    >
                      {category.name}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/blog" className="fe-topics-more fe-animate">
            Read the guides
            <span className="fe-topics-more-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
