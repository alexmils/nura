"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import "./review-spotlight.css";

export type ReviewStory = {
  quote: string;
  name: string;
  role: string;
  image: string;
};

export type ReviewSpotlightProps = {
  titleId: string;
  kicker: string;
  title: string;
  accent?: string;
  sub?: string;
  rating: string;
  ratingLine: string;
  sourceLabel: string;
  reviewsLabel: string;
  reviewsHref: string;
  stories: ReviewStory[];
};

/** Google's four-colour "G", drawn small for the review badge. */
function GoogleMark() {
  return (
    <svg className="v2-review-g" viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3.1h3.9c2.3-2.1 3.5-5.2 3.5-9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3.1c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.2A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.5H1.4a12 12 0 0 0 0 11z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.2C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}

/** A small outlined leaf sprout, so the card reads as Nura, not a plant shop. */
function LeafMark() {
  return (
    <svg className="v2-review-illustration" viewBox="0 0 92 64" aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M46 60c0-14 0-26 2-38" />
        <path d="M47 42c-9-1-17-6-20-14 9-1 17 3 20 10" />
        <path d="M48 30c8-2 15-8 16-16-9 0-16 5-18 12" />
        <path d="M46 52c-8 1-16-2-21-9 8-3 17-1 21 5" />
        <path d="M46 52c8 1 16-2 21-9-8-3-17-1-21 5" />
      </g>
    </svg>
  );
}

/**
 * "Review spotlight" template for Home: stories. A three-column editorial
 * block: headline and a reviews link, an arched photo card carrying the
 * rating, and one quote at a time with arrows. All strings come from the
 * section config; the stories list drives the rotation.
 */
export function ReviewSpotlight(props: ReviewSpotlightProps) {
  const {
    titleId,
    kicker,
    title,
    accent,
    sub,
    rating,
    ratingLine,
    sourceLabel,
    reviewsLabel,
    reviewsHref,
    stories,
  } = props;
  const [index, setIndex] = useState(0);
  const count = stories.length;
  const story = stories[index] ?? stories[0] ?? null;

  // A shorter stories list (edited in place) must not leave a stale index.
  useEffect(() => {
    setIndex((current) => (stories.length ? Math.min(current, stories.length - 1) : 0));
  }, [stories.length]);

  const step = (delta: number) => {
    if (!count) return;
    setIndex((current) => (current + delta + count) % count);
  };

  const at = accent ? title.indexOf(accent) : -1;
  const quoteId = `${titleId}-quote`;

  return (
    <div className="v2-container v2-review">
      <div className="v2-review-copy">
        {kicker ? <p className="v2-kicker">{kicker}</p> : null}
        <h2 className="v2-h2" id={titleId}>
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
        {reviewsLabel ? (
          <Link href={reviewsHref || "/reviews"} className="v2-btn v2-btn--primary v2-review-all">
            {reviewsLabel}
            <ArrowRight size={16} aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="v2-review-card">
        <div className="v2-review-card-top">
          <LeafMark />
          <div className="v2-review-badge">
            <GoogleMark />
            <span className="v2-review-score">{rating}</span>
            <span className="v2-stars" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }, (_, star) => (
                <Star key={star} size={13} fill="currentColor" strokeWidth={0} aria-hidden />
              ))}
            </span>
            <span className="v2-review-source">{sourceLabel}</span>
          </div>
          {ratingLine ? <p className="v2-review-line">{ratingLine}</p> : null}
        </div>
        {story?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={story.image}
            className="v2-review-photo"
            src={story.image}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="v2-review-photo v2-review-photo--empty" aria-hidden />
        )}
      </div>

      <div className="v2-review-quote">
        <span className="v2-review-mark" aria-hidden>
          &ldquo;
        </span>
        {story ? (
          <blockquote key={index} id={quoteId} className="v2-review-blockquote" aria-live="polite" aria-atomic="true">
            <p>{story.quote}</p>
          </blockquote>
        ) : null}
        <div className="v2-review-foot">
          <span className="v2-review-name">{story?.name}</span>
          <div className="v2-review-nav">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous testimonial"
              aria-controls={quoteId}
            >
              <ArrowLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next testimonial"
              aria-controls={quoteId}
            >
              <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
