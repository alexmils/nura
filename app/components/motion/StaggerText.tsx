"use client";

import { useEffect, useRef, type ElementType } from "react";
import { useMotion } from "./MotionProvider";
import "./motion.css";

type StaggerTextProps = {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  /** Seconds between words (defaults to the preset's stagger step). */
  step?: number;
  once?: boolean;
};

/**
 * Word-by-word rise, clipped per line — the mid-weight companion to
 * LetterRevealHeading (which is reserved for big section titles). Use for
 * lead paragraphs and hero-adjacent copy.
 */
export function StaggerText({
  text,
  className,
  as: Tag = "p",
  step,
  once = true,
}: StaggerTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const { config } = useMotion();
  const words = text.trim().split(/\s+/).filter(Boolean);
  const resolvedStep = step ?? config.staggerStep ?? 0.045;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!config.enabled) {
      el.classList.add("is-in");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const observer = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) {
          el.classList.add("is-in");
          if (once) observer.disconnect();
        } else if (!once) {
          el.classList.remove("is-in");
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [config.enabled, once]);

  const Tagged = Tag as ElementType;

  return (
    <Tagged
      ref={ref}
      className={`mo-stagger${className ? ` ${className}` : ""}`}
      style={{ ["--mo-step" as string]: `${resolvedStep}` }}
      aria-label={text}
    >
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="mo-word-mask">
            <span className="mo-word" style={{ ["--i" as string]: i }}>
              {word}
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </Tagged>
  );
}
