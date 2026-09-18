"use client";

import { useEffect, useRef, type ElementType } from "react";
import "./letter-reveal-heading.css";

type RevealTag = "h2" | "h3" | "h4" | "p" | "span";

/**
 * Aiero-style scroll heading: letters rise from below with staggered delay
 * (clip-path mask + translateY 120% → 0).
 */
export function LetterRevealHeading({
  className,
  id,
  as = "h2",
  eager = false,
  children,
}: {
  className?: string;
  id?: string;
  as?: RevealTag;
  /** Play as soon as mounted (sticky stage leads already in view). */
  eager?: boolean;
  children: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as as ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }

    const play = () => el.classList.add("is-in");

    if (eager) {
      const t = window.setTimeout(play, 40);
      return () => window.clearTimeout(t);
    }

    const enter = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) play();
      },
      { threshold: 0.28, rootMargin: "0px 0px -10% 0px" }
    );
    const leave = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio === 0) {
          el.classList.remove("is-in");
        }
      },
      { threshold: 0 }
    );
    enter.observe(el);
    leave.observe(el);
    return () => {
      enter.disconnect();
      leave.disconnect();
    };
  }, [eager]);

  const words = children.trim().split(/\s+/);
  let letterIndex = 0;

  return (
    <Tag
      ref={ref}
      id={id}
      className={`fe-letter-reveal${className ? ` ${className}` : ""}`}
      aria-label={children}
    >
      <span aria-hidden="true" className="fe-letter-reveal-inner">
        {words.map((word, wi) => (
          <span key={`w-${wi}`} className="fe-letter-word">
            {Array.from(word).map((ch) => {
              const delay = letterIndex / 50;
              const key = `l-${letterIndex}`;
              letterIndex += 1;
              return (
                <span
                  key={key}
                  className="fe-letter"
                  style={{ animationDelay: `${delay}s` }}
                >
                  {ch}
                </span>
              );
            })}
            {wi < words.length - 1 ? (
              <span className="fe-letter-space">{"\u00A0"}</span>
            ) : null}
          </span>
        ))}
      </span>
    </Tag>
  );
}
