"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  CTA_SHOWCASE_PHOTO,
  type BackdropPlan,
  type CtaShowcaseTemplate,
} from "@/lib/marketing-sections";
import { useReducedMotion } from "./HeroTemplates";
import "./cta-showcase.css";

/** Light templates use ink copy; the rest sit on a dark surface. */
const LIGHT: ReadonlySet<CtaShowcaseTemplate> = new Set(["pulse", "quote", "minidemo", "horizon", "stacked"]);

export function ctaShowcaseTone(template: CtaShowcaseTemplate): "light" | "dark" {
  return LIGHT.has(template) ? "light" : "dark";
}

export type CtaShowcaseProps = {
  template: CtaShowcaseTemplate;
  /** "close" = the closing band; "between" = the Between sessions block. */
  variant: "close" | "between";
  titleId: string;
  titleTag?: "h2" | "h3";
  kicker: string;
  title: string;
  accent: string;
  body?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
  note?: string;
  quote?: string;
  quoteBy?: string;
  words: string[];
  /** The section's Background / Gradient settings. */
  plan: BackdropPlan;
  /**
   * Paint the built-in photo (Full-bleed) here. False when the host section
   * already paints its media layer (the closing band does).
   */
  paintMedia: boolean;
};

function Accent({ text, accent }: { text: string; accent: string }) {
  const at = accent ? text.indexOf(accent) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <em className="cta-em">{accent}</em>
      {text.slice(at + accent.length)}
    </>
  );
}

/** Types each word, holds, deletes, moves on. Reduced motion: the first word, still. */
function useTypewriter(words: string[], enabled: boolean): string {
  const [text, setText] = useState(words[0] ?? "");
  const key = words.join("\u0000");
  useEffect(() => {
    if (!enabled || words.length === 0) {
      setText(words[0] ?? "");
      return;
    }
    let word = 0;
    let chars = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const target = words[word] ?? "";
      if (!deleting) {
        chars += 1;
        setText(target.slice(0, chars));
        if (chars >= target.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1800);
          return;
        }
        timer = window.setTimeout(tick, 70);
        return;
      }
      chars -= 1;
      setText(target.slice(0, Math.max(0, chars)));
      if (chars <= 0) {
        deleting = false;
        word = (word + 1) % words.length;
        timer = window.setTimeout(tick, 380);
        return;
      }
      timer = window.setTimeout(tick, 34);
    };
    setText("");
    timer = window.setTimeout(tick, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return text;
}

/**
 * Ten shared call-to-action looks (Calm: orb, pulse, quote, minidemo,
 * fullbleed; Creative: aurora, horizon, ripple, stacked, typewriter).
 *
 * Colours: the section's gradient (if switched on) drives `--cta-a`/`--cta-b`,
 * otherwise Nura's greens. A custom background or gradient replaces the
 * template's own surface (`data-surface="custom"`), so the editor's backdrop
 * shows through. Motion is CSS-only except the typewriter, and all of it stops
 * under prefers-reduced-motion.
 */
export function CtaShowcase(props: CtaShowcaseProps) {
  const {
    template,
    variant,
    titleId,
    titleTag: Title = "h2",
    kicker,
    title,
    accent,
    body,
    primary,
    secondary,
    note,
    quote,
    quoteBy,
    words,
    plan,
    paintMedia,
  } = props;
  const reduce = useReducedMotion();
  const typed = useTypewriter(words, template === "typewriter" && !reduce);
  const custom = Boolean(plan.bg) || Boolean(plan.gradient);
  const style = plan.gradient
    ? ({ "--cta-a": plan.gradient.from, "--cta-b": plan.gradient.to } as CSSProperties)
    : undefined;
  const photo = template === "fullbleed" && paintMedia && plan.showBuiltIn;

  const copy = (
    <div className="cta-show-copy">
      {template === "orb" ? (
        <span className="cta-orb" aria-hidden>
          <i className="cta-orb-halo cta-orb-halo--2" />
          <i className="cta-orb-halo" />
          <i className="cta-orb-core" />
        </span>
      ) : null}
      {kicker ? <p className="cta-kicker">{kicker}</p> : null}
      <Title id={titleId} className="cta-title">
        <Accent text={title} accent={accent} />
      </Title>
      {template === "typewriter" ? (
        <p className="cta-type">
          <span className="cta-sr">{words.join(", ")}</span>
          <span aria-hidden>
            {typed}
            <i className="cta-caret" />
          </span>
        </p>
      ) : null}
      {body ? <p className="cta-body">{body}</p> : null}
      <div className="cta-actions">
        <Link href={primary.href} className="cta-btn cta-btn--primary">
          {primary.label}
          <ArrowRight size={16} aria-hidden />
        </Link>
        {secondary?.label ? (
          <Link href={secondary.href} className="cta-btn cta-btn--ghost">
            {secondary.label}
          </Link>
        ) : null}
      </div>
      {template === "pulse" ? (
        <span className="cta-pulse" aria-hidden>
          <i className="cta-pulse-dot" />
        </span>
      ) : null}
      {note ? <p className="cta-note">{note}</p> : null}
    </div>
  );

  let aside: ReactNode = null;
  if (template === "quote") {
    aside = (
      <figure className="cta-quote">
        <span className="cta-quote-mark" aria-hidden>
          &ldquo;
        </span>
        <blockquote>{quote}</blockquote>
        {quoteBy ? <figcaption>{quoteBy}</figcaption> : null}
      </figure>
    );
  } else if (template === "minidemo") {
    aside = (
      <div className="cta-demo" aria-hidden>
        <div className="cta-demo-bar">
          <i />
          <i />
          <i />
          <span>Set 2 of 4</span>
        </div>
        <div className="cta-demo-track">
          <i className="cta-demo-ball" />
        </div>
        <div className="cta-demo-foot">
          <span>Eyes</span>
          <span className="cta-demo-progress">
            <i />
          </span>
        </div>
      </div>
    );
  } else if (template === "stacked") {
    aside = (
      <ol className="cta-stack" aria-label="Steps">
        {words.slice(0, 3).map((word, index) => (
          <li key={`${index}-${word}`} className={`cta-stack-card cta-stack-card--${index + 1}`}>
            <span className="cta-stack-num" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{word}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div
      className={`cta-show cta-show--${template} cta-show--${variant} cta-tone--${ctaShowcaseTone(template)}${aside ? " cta-show--aside" : ""}`}
      data-surface={custom ? "custom" : "own"}
      style={style}
    >
      <div className="cta-show-bg" aria-hidden>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="cta-photo" src={CTA_SHOWCASE_PHOTO} alt="" loading="lazy" decoding="async" />
        ) : null}
        {template === "fullbleed" ? <i className="cta-fade" /> : null}
        {template === "aurora" ? (
          <>
            <i className="cta-aurora cta-aurora--1" />
            <i className="cta-aurora cta-aurora--2" />
            <i className="cta-aurora cta-aurora--3" />
          </>
        ) : null}
        {template === "horizon" ? (
          <>
            <i className="cta-sun" />
            <i className="cta-sea" />
          </>
        ) : null}
        {template === "ripple" ? (
          <>
            <i className="cta-ring cta-ring--1" />
            <i className="cta-ring cta-ring--2" />
            <i className="cta-ring cta-ring--3" />
            <i className="cta-ring cta-ring--4" />
          </>
        ) : null}
      </div>
      <div className="cta-show-inner">
        {copy}
        {aside}
      </div>
      {template === "typewriter" ? (
        <div className="cta-marquee" aria-hidden>
          <div className="cta-marquee-track">
            {[0, 1].map((copyIndex) => (
              <span key={copyIndex} className="cta-marquee-set">
                {words.map((word, index) => (
                  <span key={`${copyIndex}-${index}`}>
                    {word}
                    <i className="cta-marquee-dot" />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
