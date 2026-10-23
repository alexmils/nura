"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LifeBuoy, Sparkles } from "lucide-react";
import { appPath } from "@/lib/app-base";
import { saveSignupPrefill } from "@/lib/auth/create-account-ui";
import { BILLING_PLANS, BILLING_PLAN_ORDER, type BillingPlanId } from "@/lib/billing-constants";
import {
  CTA_CONSULT_PHOTO,
  CTA_SHOWCASE_PHOTO,
  ctaConsultBullets,
  type BackdropPlan,
  type CtaShowcaseTemplate,
} from "@/lib/marketing-sections";
import { useReducedMotion } from "./HeroTemplates";
import "./cta-showcase.css";

/** Light templates use ink copy; the rest sit on a dark surface. */
const LIGHT: ReadonlySet<CtaShowcaseTemplate> = new Set(["pulse", "quote", "minidemo", "horizon", "stacked", "consult"]);

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
  /** Consultation form: bullet lines, form intro, and the three field labels. */
  bullets?: string;
  formIntro?: string;
  nameLabel?: string;
  emailLabel?: string;
  planLabel?: string;
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
 * Eleven shared call-to-action looks (Calm: orb, pulse, quote, minidemo,
 * fullbleed; Creative: aurora, horizon, ripple, stacked, typewriter;
 * Forms: consult).
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
    bullets,
    formIntro,
    nameLabel,
    emailLabel,
    planLabel,
    plan,
    paintMedia,
  } = props;
  const reduce = useReducedMotion();
  const typed = useTypewriter(words, template === "typewriter" && !reduce);
  const custom = Boolean(plan.bg) || Boolean(plan.gradient);
  const style = plan.gradient
    ? ({ "--cta-a": plan.gradient.from, "--cta-b": plan.gradient.to } as CSSProperties)
    : undefined;
  const photo = (template === "fullbleed" || template === "consult") && paintMedia && plan.showBuiltIn;
  const router = useRouter();
  const [consultName, setConsultName] = useState("");
  const [consultEmail, setConsultEmail] = useState("");
  const [consultPlan, setConsultPlan] = useState<BillingPlanId>("monthly");
  const [consultError, setConsultError] = useState("");

  // The form carries the two values into create-account; the plan rides in the
  // `next` path so onboarding opens with it already chosen.
  const submitConsult = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = consultName.trim();
    const email = consultEmail.trim();
    if (!name) {
      setConsultError("Add your name so we know who to greet.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setConsultError("Check the email address — that is where your trial opens.");
      return;
    }
    setConsultError("");
    saveSignupPrefill({ name, email });
    const next = `${appPath("/onboarding")}?plan=${consultPlan}`;
    router.push(`${appPath("/create-account")}?next=${encodeURIComponent(next)}`);
  };

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

  // The Consultation form is a pair of cards on a photo: a dark intro on the
  // left, a light sign-up card on the right. Every string comes from the
  // section config, so the whole block stays editable.
  const consultBody =
    template === "consult" ? (
      <div className="cta-consult">
        <div className="cta-consult-card cta-consult-card--info">
          <span className="cta-consult-spark" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {kicker ? <p className="cta-kicker">{kicker}</p> : null}
          <Title id={titleId} className="cta-title">
            <Accent text={title} accent={accent} />
          </Title>
          {body ? <p className="cta-body">{body}</p> : null}
          <ul className="cta-consult-list">
            {ctaConsultBullets(bullets).map((line) => (
              <li key={line}>
                <span className="cta-consult-dot" aria-hidden>
                  <Sparkles size={13} strokeWidth={2.2} />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {secondary?.label ? (
            <div className="cta-consult-foot">
              <Link href={secondary.href} className="cta-consult-contact">
                <LifeBuoy size={17} strokeWidth={1.9} aria-hidden />
                {secondary.label}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="cta-consult-card cta-consult-card--form">
          <svg className="cta-consult-leaf" viewBox="0 0 140 96" aria-hidden focusable="false">
            <ellipse cx="70" cy="48" rx="14" ry="31" transform="rotate(-34 70 80)" />
            <ellipse cx="70" cy="41" rx="14" ry="37" />
            <ellipse cx="70" cy="48" rx="14" ry="31" transform="rotate(34 70 80)" />
          </svg>
          {formIntro ? <p className="cta-consult-intro">{formIntro}</p> : null}
          <form className="cta-consult-form" onSubmit={submitConsult} noValidate>
            <label className="cta-consult-field">
              <span>{nameLabel || "Your name"}</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                value={consultName}
                onChange={(event) => setConsultName(event.target.value)}
              />
            </label>
            <label className="cta-consult-field">
              <span>{emailLabel || "Email address"}</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                value={consultEmail}
                onChange={(event) => setConsultEmail(event.target.value)}
              />
            </label>
            <fieldset className="cta-consult-plans">
              <legend>{planLabel || "Plan"}</legend>
              <div className="cta-consult-plan-grid">
                {BILLING_PLAN_ORDER.map((id) => {
                  const plan = BILLING_PLANS[id];
                  return (
                    <label
                      key={id}
                      className={`cta-consult-plan${consultPlan === id ? " is-picked" : ""}`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={id}
                        checked={consultPlan === id}
                        onChange={() => setConsultPlan(id)}
                      />
                      <span className="cta-consult-plan-name">
                        {plan.label}
                        {plan.savingsHint ? <em>{plan.savingsHint}</em> : null}
                      </span>
                      <span className="cta-consult-plan-price">
                        {plan.displayPrice}
                        <small>{plan.displayPeriod}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <button type="submit" className="cta-btn cta-btn--primary cta-consult-submit">
              {primary.label}
              <ArrowRight size={16} aria-hidden />
            </button>
            {consultError ? (
              <p className="cta-consult-error" role="alert">
                {consultError}
              </p>
            ) : null}
          </form>
          {note ? <p className="cta-note">{note}</p> : null}
        </div>
      </div>
    ) : null;

  return (
    <div
      className={`cta-show cta-show--${template} cta-show--${variant} cta-tone--${ctaShowcaseTone(template)}${aside ? " cta-show--aside" : ""}`}
      data-surface={custom ? "custom" : "own"}
      style={style}
    >
      <div className="cta-show-bg" aria-hidden>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="cta-photo"
            src={template === "consult" ? CTA_CONSULT_PHOTO : CTA_SHOWCASE_PHOTO}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {template === "fullbleed" ? <i className="cta-fade" /> : null}
        {template === "consult" && !custom ? <i className="cta-consult-scrim" /> : null}
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
      {consultBody ?? (
        <div className="cta-show-inner">
          {copy}
          {aside}
        </div>
      )}
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
