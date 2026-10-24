"use client";

import { Suspense, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  Facebook,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import {
  AUTH_PANEL_ID,
  authPanelTemplate,
  authSocialPosition,
  sectionList,
  sectionText,
  slotMedia,
  type AuthPanelTemplate,
  type SectionConfig,
} from "@/lib/marketing-sections";
import { BRAND_SOCIAL } from "@/lib/brand";
import "./auth-visual-variants.css";

/** `?auth=forest|breath|press` (or 1/2/3) previews a preset without saving it. */
const PREVIEW_ALIASES: Record<string, AuthPanelTemplate> = {
  "1": "forest",
  "2": "breath",
  "3": "press",
};

/**
 * Right pane of the sign-in / sign-up screens. The admin picks the preset and
 * edits its copy and colours in the section editor (`auth-login`).
 */
export function AuthVisual() {
  return (
    <Suspense fallback={<AuthPanel override={null} />}>
      <AuthVisualPreview />
    </Suspense>
  );
}

function AuthVisualPreview() {
  const raw = useSearchParams().get("auth");
  return <AuthPanel override={raw ? (PREVIEW_ALIASES[raw] ?? raw) : null} />;
}

function AuthPanel({ override }: { override: string | null }) {
  const config = useSectionConfig(AUTH_PANEL_ID);
  const template = authPanelTemplate(config, override);
  if (template === "breath") return <BreathPanel config={config} />;
  if (template === "press") return <PressPanel config={config} />;
  return <ForestPanel config={config} />;
}

/* ---------- shared ---------- */

function colorVars(config: SectionConfig, map: Record<string, string>): CSSProperties {
  const style: Record<string, string> = {};
  for (const [cssVar, key] of Object.entries(map)) {
    const value = sectionText(config, key).trim();
    if (value) style[cssVar] = value;
  }
  return style as CSSProperties;
}

function Lines({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <>
      {lines.map((line, index) => (
        <span key={index} className="av-line">
          {line}
        </span>
      ))}
    </>
  );
}

function Social({ config, inline = false }: { config: SectionConfig; inline?: boolean }) {
  const position = authSocialPosition(config);
  if (position === "none" || (position === "inline") !== inline) return null;
  const links = [
    {
      href: sectionText(config, "socialInstagram") || BRAND_SOCIAL.instagram,
      label: "Follow Nura on Instagram",
      Icon: Instagram,
    },
    {
      href: sectionText(config, "socialFacebook") || BRAND_SOCIAL.facebook,
      label: "Follow Nura on Facebook",
      Icon: Facebook,
    },
  ];
  return (
    <div className={`av-social av-social--${position}`} aria-label="Follow Nura">
      {links.map(({ href, label, Icon }) => (
        <a key={label} href={href} className="av-social-link" aria-label={label} target="_blank" rel="noopener noreferrer">
          <Icon size={17} strokeWidth={1.6} aria-hidden />
        </a>
      ))}
    </div>
  );
}

function Frame({
  template,
  config,
  style,
  children,
}: {
  template: AuthPanelTemplate;
  config: SectionConfig;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={`av av--${template}`} style={style}>
      {children}
      <Social config={config} />
    </div>
  );
}

/* ---------- Forest value ---------- */

const FOREST_ICONS = [MessageCircle, ShieldCheck, CalendarCheck];

function ForestPanel({ config }: { config: SectionConfig }) {
  const cards = sectionList(config, "forestCards");
  const badge = sectionText(config, "forestBadge");
  const lead = sectionText(config, "forestLead");
  return (
    <Frame
      template="forest"
      config={config}
      style={colorVars(config, {
        "--av-bg": "forestBg",
        "--av-glow-a": "forestGlow",
        "--av-glow-b": "forestGlow2",
        "--av-ink": "forestText",
        "--av-card": "forestCard",
        "--av-badge": "forestBadgeBg",
      })}
    >
      <span className="av-glow av-glow--a" aria-hidden />
      <span className="av-glow av-glow--b" aria-hidden />
      <span className="av-glow av-glow--c" aria-hidden />
      <div className="av-forest">
        {badge ? (
          <p className="av-trial">
            <Sparkles size={15} aria-hidden /> {badge}
          </p>
        ) : null}
        <h2 className="av-forest-title">
          <Lines text={sectionText(config, "forestTitle")} />
        </h2>
        {lead ? <p className="av-forest-lead">{lead}</p> : null}
        {cards.length ? (
          <ul className="av-cards">
            {cards.map((card, index) => {
              const Icon = FOREST_ICONS[index % FOREST_ICONS.length];
              return (
                <li key={card.id ?? index} className="av-card">
                  <span className="av-card-icon" aria-hidden>
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <strong>{card.title}</strong>
                  {card.text ? <span>{card.text}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        <Social config={config} inline />
      </div>
    </Frame>
  );
}

/* ---------- Breathing light ---------- */

function BreathPanel({ config }: { config: SectionConfig }) {
  const lead = sectionText(config, "breathLead");
  const note = sectionText(config, "breathNote");
  const inhale = sectionText(config, "breathIn");
  const exhale = sectionText(config, "breathOut");
  return (
    <Frame
      template="breath"
      config={config}
      style={colorVars(config, {
        "--av-bg": "breathBg",
        "--av-orb": "breathOrb",
        "--av-ink": "breathText",
        "--av-card": "breathCard",
      })}
    >
      <span className="av-side av-side--l" aria-hidden />
      <span className="av-side av-side--r" aria-hidden />
      <div className="av-breath">
        <div className="av-orb-wrap" aria-hidden>
          <span className="av-orb-ring av-orb-ring--3" />
          <span className="av-orb-ring av-orb-ring--2" />
          <span className="av-orb-ring av-orb-ring--1" />
          <span className="av-orb" />
          <span className="av-orb-words">
            {inhale ? <span className="av-orb-word av-orb-word--in">{inhale}</span> : null}
            {exhale ? <span className="av-orb-word av-orb-word--out">{exhale}</span> : null}
          </span>
        </div>
        <div className="av-glass">
          <h2 className="av-breath-title">
            <Lines text={sectionText(config, "breathTitle")} />
          </h2>
          {lead ? <p className="av-breath-lead">{lead}</p> : null}
          {note ? <p className="av-breath-note">{note}</p> : null}
          <Social config={config} inline />
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Editorial split ---------- */

function PressMedia({ config }: { config: SectionConfig }) {
  const media = slotMedia(config, "editPhoto");
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (query.matches) video.pause();
      else void video.play().catch(() => {});
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [media?.video, media?.kind]);
  if (!media) {
    return (
      <div className="av-press-arch av-press-arch--empty" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    );
  }
  return (
    <div className="av-press-arch">
      {media.kind === "video" ? (
        <video
          ref={videoRef}
          src={media.video}
          poster={media.poster || undefined}
          muted
          loop
          playsInline
          aria-hidden={!media.alt}
          aria-label={media.alt || undefined}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.image} alt={media.alt} />
      )}
    </div>
  );
}

function PressPanel({ config }: { config: SectionConfig }) {
  const notes = sectionList(config, "editNotes");
  const kicker = sectionText(config, "editKicker");
  const number = sectionText(config, "editNumber");
  const guide = sectionText(config, "editSnippetGuide");
  const reply = sectionText(config, "editSnippetMe");
  return (
    <Frame
      template="press"
      config={config}
      style={colorVars(config, {
        "--av-bg": "editBg",
        "--av-ink": "editInk",
        "--av-accent": "editAccent",
      })}
    >
      <div className="av-press">
        <div className="av-press-top">
          {kicker ? <p className="av-press-kicker">{kicker}</p> : <span />}
          <span className="av-press-rule" aria-hidden />
        </div>
        <div className="av-press-head">
          <h2 className="av-press-title">
            <Lines text={sectionText(config, "editTitle")} />
          </h2>
          <div className="av-press-side">
            <PressMedia config={config} />
            {guide || reply ? (
              <div className="av-press-snippet" aria-hidden>
                <span className="av-press-snippet-head">
                  <span className="av-press-dot" /> Nura guide
                </span>
                {guide ? <span className="av-press-bubble av-press-bubble--guide">{guide}</span> : null}
                {reply ? <span className="av-press-bubble av-press-bubble--me">{reply}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="av-press-grid">
          {number ? (
            <div className="av-press-big">
              <span className="av-press-num">{number}</span>
              <span className="av-press-num-label">{sectionText(config, "editNumberLabel")}</span>
              <span className="av-press-num-text">{sectionText(config, "editNumberText")}</span>
            </div>
          ) : null}
          {notes.length ? (
            <ol className="av-press-notes">
              {notes.map((note, index) => (
                <li key={note.id ?? index}>
                  <span className="av-press-idx">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{note.title}</strong>
                  {note.text ? <span>{note.text}</span> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <Social config={config} inline />
      </div>
    </Frame>
  );
}
