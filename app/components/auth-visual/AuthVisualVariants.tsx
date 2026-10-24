"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  CalendarCheck,
  Facebook,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
import {
  AUTH_PANEL_ID,
  authSocialPosition,
  sectionList,
  sectionText,
  slotMedia,
  type AuthPanelTemplate,
  type SectionConfig,
} from "@/lib/marketing-sections";
import { BRAND_SOCIAL } from "@/lib/brand";
import "./auth-visual-variants.css";

/**
 * Visual pane of the sign-in / sign-up screens. AuthShell picks the preset
 * (saved choice, or the `?auth=` preview); copy and colours come from the
 * section editor (`auth-login`).
 */
export function AuthVisual({ template }: { template: AuthPanelTemplate }) {
  const config = useSectionConfig(AUTH_PANEL_ID);
  if (template === "forest") return <ForestPanel config={config} />;
  return <CardPanel config={config} />;
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

/* ---------- Photo card ---------- */

function CardMedia({ config }: { config: SectionConfig }) {
  const media = slotMedia(config, "cardMedia");
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
  if (!media) return <span className="av-card-art" aria-hidden />;
  if (media.kind === "video") {
    return (
      <video
        ref={videoRef}
        className="av-card-media"
        src={media.video}
        poster={media.poster || undefined}
        muted
        loop
        playsInline
        aria-hidden={!media.alt}
        aria-label={media.alt || undefined}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="av-card-media" src={media.image} alt={media.alt} />;
}

function CardPanel({ config }: { config: SectionConfig }) {
  const tagline = sectionText(config, "cardTagline");
  return (
    <Frame template="photo" config={config} style={colorVars(config, { "--av-title": "cardTitleColor" })}>
      <CardMedia config={config} />
      <span className="av-card-shade" aria-hidden />
      <h2 className="av-card-title">
        <Lines text={sectionText(config, "cardTitle")} />
      </h2>
      <div className="av-card-brand">
        <BrandLockup href={null} tone="white" />
        {tagline ? <p>{tagline}</p> : null}
      </div>
    </Frame>
  );
}
