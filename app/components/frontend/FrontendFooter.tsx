"use client";

import Link from "next/link";
import {
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { BrandSocialLinks } from "@/app/components/BrandSocialLinks";
import { CookieSettingsButton } from "@/app/components/frontend/CookieBanner";
import { LetterRevealHeading } from "@/app/components/frontend/LetterRevealHeading";
import {
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/app/components/TurnstileField";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile-shared";
import { BRAND_LIMITS_LINE, BRAND_SPOKEN } from "@/lib/brand";
import { sectionList, sectionText, parseLinkLines } from "@/lib/marketing-sections";
import { RichInline } from "@/app/components/frontend/section-editor/RichText";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig, useSectionOn } from "@/app/components/frontend/section-editor/MarketingCopy";
import { EditablePart, SectionBackdrop, SectionGate } from "@/app/components/frontend/section-editor/EditablePart";
import { useIsPlatformAdmin } from "@/app/components/frontend/section-editor/useIsPlatformAdmin";
import "./frontend-footer.css";

/** Giant white lockup for Lassie-style end reveal (vector — crisp at any size). */
const FOOTER_REVEAL_LOGO = "/brand/Nura%20Logo.svg";

/**
 * The email field is absent from the server HTML. LastPass injects
 * `[data-lastpass-icon-root]` beside `#fe-footer-email` before hydration,
 * and that mismatch takes down the whole page, including hero Edit.
 */
function FooterEmailInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) {
    return <div className="fe-site-footer-input" aria-hidden />;
  }
  return (
    <input
      id="fe-footer-email"
      type="email"
      name="email"
      autoComplete="email"
      required
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fe-site-footer-input"
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
    />
  );
}

export function FrontendFooter() {
  const cta = useSectionConfig("footer-cta");
  const links = useSectionConfig("footer-links");
  const columns = sectionList(links, "columns");
  const news = useSectionConfig("footer-newsletter");
  const legalCopy = useSectionConfig("footer-legal");
  const legalOn = useSectionOn("footer-legal");
  const footerAdmin = useIsPlatformAdmin();
  const legal = legalOn ? sectionList(legalCopy, "legal") : [];
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const [newsOptIn, setNewsOptIn] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [newsBusy, setNewsBusy] = useState(false);
  const turnstileRef = useRef<TurnstileFieldHandle>(null);
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

  async function onNewsletter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !newsOptIn || !turnstileToken || newsBusy) return;
    setNewsBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          marketingEmailOptIn: true,
          [TURNSTILE_TOKEN_FIELD]: turnstileToken,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNote(data.error ?? "Could not subscribe.");
        turnstileRef.current?.reset();
        return;
      }
      setSent(true);
    } catch {
      setNote("Network error. Try again.");
      turnstileRef.current?.reset();
    } finally {
      setNewsBusy(false);
    }
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
          <SectionGate id="footer-cta">
          <div className="fe-site-footer-cta fe-has-edit" data-section="footer-cta">
            <SectionEdit id="footer-cta" />
            <LetterRevealHeading className="fe-site-footer-cta-title">
              {sectionText(cta, "title")}
            </LetterRevealHeading>
            <p className="fe-site-footer-cta-sub">
              {sectionText(cta, "sub")}
            </p>
            <div className="fe-site-footer-cta-actions">
              <Link
                href={sectionText(cta, "primaryHref")}
                className="fe-site-footer-cta-btn fe-site-footer-cta-btn--primary"
              >
                {sectionText(cta, "primary")}
              </Link>
              <Link
                href={sectionText(cta, "secondaryHref")}
                className="fe-site-footer-cta-btn fe-site-footer-cta-btn--ghost"
              >
                {sectionText(cta, "secondary")}
              </Link>
            </div>
          </div>
          </SectionGate>

          <SectionBackdrop id="footer-links">
          <div className="fe-site-footer-grid fe-has-edit" data-section="footer-links">
            <SectionEdit id="footer-links" />
            <div className="fe-site-footer-brand">
              <BrandLockup
                href="/"
                tone="white"
                className="fe-site-footer-logo"
              />
              <p className="fe-site-footer-tagline">
                {sectionText(links, "tagline")}
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
              {columns.map((col) => (
                <div key={col.title} className="fe-site-footer-col">
                  <p className="fe-site-footer-col-title">{col.title}</p>
                  <ul className="fe-site-footer-col-list">
                    {parseLinkLines(col.links ?? "").map((l) => (
                      <li key={l.href}>
                        <Link href={l.href}>{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <EditablePart id="footer-newsletter">
            <div className="fe-site-footer-newsletter">
              <p className="fe-site-footer-newsletter-title">{sectionText(news, "newsTitle")}</p>
              <p className="fe-site-footer-newsletter-hint">
                {sectionText(news, "newsHint")}
              </p>
              {sent ? (
                <p className="fe-site-footer-newsletter-done">{sectionText(news, "newsThanks")}</p>
              ) : (
                <form
                  className="fe-site-footer-form"
                  onSubmit={(e) => void onNewsletter(e)}
                  noValidate
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                >
                  <label className="fe-site-footer-sr" htmlFor="fe-footer-email">
                    Email
                  </label>
                  <FooterEmailInput
                    placeholder={sectionText(news, "newsPlaceholder")}
                    value={email}
                    onChange={setEmail}
                  />
                  <button
                    type="submit"
                    className="fe-site-footer-send"
                    disabled={newsBusy || !newsOptIn || !turnstileToken}
                  >
                    {newsBusy ? sectionText(news, "newsSending") : sectionText(news, "newsSend")}
                  </button>
                  <label className="fe-site-footer-newsletter-hint" style={{ display: "flex", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={newsOptIn}
                      onChange={(e) => setNewsOptIn(e.target.checked)}
                    />
                    <span>
                      <RichInline text={sectionText(news, "newsOptIn")} />
                    </span>
                  </label>
                  <TurnstileField
                    ref={turnstileRef}
                    action="newsletter"
                    onToken={setTurnstileToken}
                  />
                  {note ? <p className="fe-site-footer-newsletter-hint">{note}</p> : null}
                </form>
              )}
            </div>
            </EditablePart>
          </div>
          </SectionBackdrop>

          <div className="fe-site-footer-meta">
            <p className="fe-site-footer-limits">
              {BRAND_LIMITS_LINE}{" "}
              <Link href="/limits">Read the limits</Link>.
            </p>
            <div className="fe-site-footer-meta-end">
              <p className="fe-site-footer-copy">
                © {new Date().getFullYear()} {BRAND_SPOKEN} | All rights reserved
              </p>
              <SectionBackdrop id="footer-legal">
              <nav
                className={footerAdmin ? "fe-site-footer-legal fe-has-edit" : "fe-site-footer-legal"}
                data-section={footerAdmin ? "footer-legal" : undefined}
                aria-label="Legal"
              >
                <SectionEdit id="footer-legal" />
                {legal.map((l) => (
                  <Link key={l.href} href={l.href}>
                    {l.label}
                  </Link>
                ))}
                <CookieSettingsButton className="fe-site-footer-cookie-btn" />
              </nav>
              </SectionBackdrop>
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
