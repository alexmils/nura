"use client";

import Link from "next/link";
import {
  type FormEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { BrandSocialLinks } from "@/app/components/BrandSocialLinks";
import { CookieSettingsButton } from "@/app/components/frontend/CookieBanner";
import { LetterRevealHeading } from "@/app/components/frontend/LetterRevealHeading";
import { appPath, LOGIN_PATH } from "@/lib/app-base";
import { BRAND_LIMITS_LINE, BRAND_SPOKEN } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/billing-constants";
import "./frontend-footer.css";

const FOOTER_COLS = [
  {
    title: "Explore",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/learn", label: "Learn" },
      { href: "/knowledge", label: "Knowledge" },
      { href: "/changelog", label: "What's new" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/safety", label: "Safety" },
      { href: "/limits", label: "Limits" },
    ],
  },
] as const;

const FOOTER_LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

/** Giant white lockup for Lassie-style end reveal (vector — crisp at any size). */
const FOOTER_REVEAL_LOGO = "/brand/Nura%20Logo.svg";

export function FrontendFooter() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [spotlightOn, setSpotlightOn] = useState(false);
  const footerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef(0);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const el = footerRef.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--fe-ft-spot-x", `${x}%`);
      el.style.setProperty("--fe-ft-spot-y", `${y}%`);
    });
  }, []);

  function onNewsletter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    const q = new URLSearchParams({ email: trimmed });
    window.location.href = `${appPath("/create-account")}?${q.toString()}`;
    setSent(true);
  }

  return (
    <>
      <footer
        ref={footerRef}
        className={`fe-site-footer${spotlightOn ? " is-spotlight" : ""}`}
        onPointerEnter={() => setSpotlightOn(true)}
        onPointerLeave={() => {
          setSpotlightOn(false);
          cancelAnimationFrame(rafRef.current);
        }}
        onPointerMove={onPointerMove}
      >
        <div
          className="fe-site-footer-glow fe-site-footer-glow--cursor"
          aria-hidden
        />

        <div className="fe-site-footer-inner">
          <div className="fe-site-footer-cta">
            <LetterRevealHeading className="fe-site-footer-cta-title">
              Support that stays calm — start when you are ready
            </LetterRevealHeading>
            <p className="fe-site-footer-cta-sub">
              Built for practice between sessions. Create an account for a{" "}
              {TRIAL_DAYS}-day trial, or sign in if you already use {BRAND_SPOKEN}
              .
            </p>
            <div className="fe-site-footer-cta-actions">
              <Link
                href={appPath("/create-account")}
                className="fe-site-footer-cta-btn fe-site-footer-cta-btn--primary"
              >
                Get started
              </Link>
              <Link
                href={LOGIN_PATH}
                className="fe-site-footer-cta-btn fe-site-footer-cta-btn--ghost"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="fe-site-footer-grid">
            <div className="fe-site-footer-brand">
              <BrandLockup
                href="/"
                tone="white"
                className="fe-site-footer-logo"
              />
              <p className="fe-site-footer-tagline">
                Join {BRAND_SPOKEN} today — calm guided support when you need it.
              </p>
              <div className="fe-site-footer-social" aria-label="Social">
                <BrandSocialLinks
                  className="fe-site-footer-social-brand"
                  linkClassName="fe-site-footer-social-link"
                  labelled={false}
                />
              </div>
            </div>

            <nav className="fe-site-footer-cols" aria-label="Footer">
              {FOOTER_COLS.map((col) => (
                <div key={col.title} className="fe-site-footer-col">
                  <p className="fe-site-footer-col-title">{col.title}</p>
                  <ul className="fe-site-footer-col-list">
                    {col.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href}>{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="fe-site-footer-newsletter">
              <p className="fe-site-footer-newsletter-title">Newsletter</p>
              <p className="fe-site-footer-newsletter-hint">
                Occasional notes — no spam.
              </p>
              {sent ? (
                <p className="fe-site-footer-newsletter-done">
                  Continue in create account to stay in touch.
                </p>
              ) : (
                <form
                  className="fe-site-footer-form"
                  onSubmit={onNewsletter}
                  noValidate
                >
                  <label className="fe-site-footer-sr" htmlFor="fe-footer-email">
                    Email
                  </label>
                  <input
                    id="fe-footer-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="fe-site-footer-input"
                  />
                  <button type="submit" className="fe-site-footer-send">
                    Send
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="fe-site-footer-meta">
            <p className="fe-site-footer-limits">
              {BRAND_LIMITS_LINE}{" "}
              <Link href="/limits">Read the limits</Link>.
            </p>
            <div className="fe-site-footer-meta-end">
              <p className="fe-site-footer-copy">
                © {new Date().getFullYear()} {BRAND_SPOKEN} | All rights reserved
              </p>
              <nav className="fe-site-footer-legal" aria-label="Legal">
                {FOOTER_LEGAL.map((l) => (
                  <Link key={l.href} href={l.href}>
                    {l.label}
                  </Link>
                ))}
                <CookieSettingsButton className="fe-site-footer-cookie-btn" />
              </nav>
            </div>
          </div>
        </div>
      </footer>
      {/* In-flow peek after the footer (not position:fixed — that glued the logo on legal pages). */}
      <div className="fe-site-footer-reveal" aria-hidden>
        <div className="fe-site-footer-reveal-gradient" />
        {/* Mask keeps the SVG vector-sharp; filter on <img> would rasterize */}
        <div
          className="fe-site-footer-reveal-logo"
          style={{
            WebkitMaskImage: `url("${FOOTER_REVEAL_LOGO}")`,
            maskImage: `url("${FOOTER_REVEAL_LOGO}")`,
          }}
        />
      </div>
    </>
  );
}
