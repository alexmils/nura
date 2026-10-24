"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, Phone, Sparkles } from "lucide-react";
import { TurnstileField, type TurnstileFieldHandle } from "@/app/components/TurnstileField";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile-shared";
import {
  CTA_CONTACT_PHOTO,
  CTA_SHOWCASE_PHOTO,
  ctaContactBullets,
  ctaContactServices,
  type BackdropPlan,
  type CtaShowcaseTemplate,
} from "@/lib/marketing-sections";
import { useReducedMotion } from "./HeroTemplates";
import "./cta-showcase.css";

/** Light templates use ink copy; the rest sit on a dark surface. */
const LIGHT: ReadonlySet<CtaShowcaseTemplate> = new Set(["pulse", "quote", "minidemo", "horizon", "stacked", "contact"]);

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
  /** Contact form: the intro card's bullets and the form's editable copy. */
  bullets?: string;
  formIntro?: string;
  nameLabel?: string;
  emailLabel?: string;
  phoneLabel?: string;
  serviceLabel?: string;
  messageLabel?: string;
  services?: string;
  submitLabel?: string;
  successMsg?: string;
  contactLabel?: string;
  contactValue?: string;
  contactHref?: string;
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
 * Forms: contact).
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
    phoneLabel,
    serviceLabel,
    messageLabel,
    services,
    submitLabel,
    successMsg,
    contactLabel,
    contactValue,
    contactHref,
    plan,
    paintMedia,
  } = props;
  const reduce = useReducedMotion();
  const typed = useTypewriter(words, template === "typewriter" && !reduce);
  const custom = Boolean(plan.bg) || Boolean(plan.gradient);
  const style = plan.gradient
    ? ({ "--cta-a": plan.gradient.from, "--cta-b": plan.gradient.to } as CSSProperties)
    : undefined;
  const photo = (template === "fullbleed" || template === "contact") && paintMedia && plan.showBuiltIn;
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactService, setContactService] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  // Honeypot: a real person never fills this hidden field.
  const [contactSite, setContactSite] = useState("");
  const [contactState, setContactState] = useState<"idle" | "sending" | "sent">("idle");
  const [contactError, setContactError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileFieldHandle>(null);

  const submitContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (contactState === "sending") return;
    const name = contactName.trim();
    const email = contactEmail.trim();
    const message = contactMessage.trim();
    if (!name) {
      setContactError("Add your name so we know who we're writing back to.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactError("Check the email address — that's where the reply goes.");
      return;
    }
    if (!message) {
      setContactError("Write a short message so we know how to help.");
      return;
    }
    const token = turnstileToken || turnstileRef.current?.getToken() || "";
    if (!token) {
      setContactError("Complete the verification check, then try again.");
      return;
    }
    setContactError("");
    setContactState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: contactPhone.trim(),
          service: contactService.trim(),
          message,
          website: contactSite,
          [TURNSTILE_TOKEN_FIELD]: token,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setContactState("idle");
        setContactError(data.error || "Could not send the message. Try again in a moment.");
        turnstileRef.current?.reset();
        return;
      }
      setContactState("sent");
    } catch {
      setContactState("idle");
      setContactError("Network error. Try again in a moment.");
      turnstileRef.current?.reset();
    }
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

  // The Contact form is a pair of cards on a photo: a dark intro on the left,
  // a light contact form on the right. Every string comes from the section
  // config, so the whole block stays editable.
  const contactBody =
    template === "contact" ? (
      <div className="cta-contact">
        <div className="cta-contact-card cta-contact-card--info">
          <span className="cta-contact-spark" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {kicker ? <p className="cta-kicker">{kicker}</p> : null}
          <Title id={titleId} className="cta-title">
            <Accent text={title} accent={accent} />
          </Title>
          {body ? <p className="cta-body">{body}</p> : null}
          <ul className="cta-contact-list">
            {ctaContactBullets(bullets).map((line) => (
              <li key={line}>
                <span className="cta-contact-dot" aria-hidden>
                  <Sparkles size={13} strokeWidth={2.2} />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {contactValue ? (
            <div className="cta-contact-foot">
              <span className="cta-contact-call-label">{contactLabel || "Call us"}</span>
              {contactHref ? (
                <a href={contactHref} className="cta-contact-call">
                  {contactHref.startsWith("tel:") ? (
                    <Phone size={17} strokeWidth={1.9} aria-hidden />
                  ) : (
                    <Mail size={17} strokeWidth={1.9} aria-hidden />
                  )}
                  {contactValue}
                </a>
              ) : (
                <span className="cta-contact-call">{contactValue}</span>
              )}
            </div>
          ) : null}
        </div>

        <div className="cta-contact-card cta-contact-card--form">
          <svg className="cta-contact-leaf" viewBox="0 0 140 96" aria-hidden focusable="false">
            <ellipse cx="70" cy="48" rx="14" ry="31" transform="rotate(-34 70 80)" />
            <ellipse cx="70" cy="41" rx="14" ry="37" />
            <ellipse cx="70" cy="48" rx="14" ry="31" transform="rotate(34 70 80)" />
          </svg>
          {formIntro ? <p className="cta-contact-intro">{formIntro}</p> : null}
          {contactState === "sent" ? (
            <div className="cta-contact-sent" role="status">
              <CheckCircle2 size={26} strokeWidth={2} aria-hidden />
              <p>{successMsg || "Thanks — your message is in. We'll reply to the email you left."}</p>
            </div>
          ) : (
            <form className="cta-contact-form" onSubmit={submitContact} noValidate>
              <label className="cta-contact-field">
                <span>{nameLabel || "Your name"}</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
              </label>
              <label className="cta-contact-field">
                <span>{emailLabel || "Email address"}</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={200}
                  required
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </label>
              <label className="cta-contact-field">
                <span>{phoneLabel || "Phone number (optional)"}</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={40}
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </label>
              <label className="cta-contact-field">
                <span>{serviceLabel || "What is this about?"}</span>
                <select
                  name="service"
                  value={contactService}
                  onChange={(event) => setContactService(event.target.value)}
                >
                  <option value="">Select a service</option>
                  {ctaContactServices(services).map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cta-contact-field cta-contact-field--message">
                <span>{messageLabel || "Message"}</span>
                <textarea
                  name="message"
                  rows={4}
                  maxLength={4000}
                  required
                  placeholder="Describe what you need"
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                />
              </label>
              <input
                className="cta-contact-hp"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={contactSite}
                onChange={(event) => setContactSite(event.target.value)}
              />
              <div className="cta-contact-turnstile">
                <TurnstileField
                  ref={turnstileRef}
                  action="contact"
                  appearance="interaction-only"
                  onToken={setTurnstileToken}
                />
              </div>
              <button
                type="submit"
                className="cta-btn cta-btn--primary cta-contact-submit"
                disabled={contactState === "sending"}
              >
                {contactState === "sending" ? "Sending…" : submitLabel || primary.label || "Send message"}
                <ArrowRight size={16} aria-hidden />
              </button>
              {contactError ? (
                <p className="cta-contact-error" role="alert">
                  {contactError}
                </p>
              ) : null}
            </form>
          )}
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
            src={template === "contact" ? CTA_CONTACT_PHOTO : CTA_SHOWCASE_PHOTO}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {template === "fullbleed" ? <i className="cta-fade" /> : null}
        {template === "contact" && !custom ? <i className="cta-contact-scrim" /> : null}
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
      {contactBody ?? (
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
