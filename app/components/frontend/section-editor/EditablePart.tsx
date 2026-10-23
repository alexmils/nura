"use client";
import { frameKey, storedFrameStyle } from "@/lib/image-position";

import type { ReactNode } from "react";
import {
  getSectionDef,
  gradientLayerStyle,
  gradientIsOverlay,
  sectionBackground,
  sectionGradient,
  type SectionGradient,
} from "@/lib/marketing-sections";
import { useSectionConfig, useSectionOn } from "./MarketingCopy";
import { SectionEdit } from "./SectionEdit";
import { useIsPlatformAdmin } from "./useIsPlatformAdmin";

/**
 * One visual block with its own Edit chip and its own "Show this section"
 * switch. Visitors get the children only (no wrapper) or nothing when the
 * block is switched off, so their markup is unchanged by default.
 */
export function EditablePart({
  id,
  children,
  lift = false,
  className,
  backdrop = true,
}: {
  id: string;
  children: ReactNode;
  lift?: boolean;
  className?: string;
  /** False when an outer SectionGate already paints the background. */
  backdrop?: boolean;
}) {
  const admin = useIsPlatformAdmin();
  const on = useSectionOn(id);
  const body = backdrop ? <SectionBackdrop id={id}>{children}</SectionBackdrop> : children;
  if (!admin) return on ? <>{body}</> : null;
  if (!on) return <HiddenSectionNote id={id} />;
  return (
    <div className={className ? `fe-has-edit fe-editable-part ${className}` : "fe-has-edit fe-editable-part"} data-section={id}>
      <SectionEdit id={id} lift={lift} />
      {body}
    </div>
  );
}

/** Admin-only placeholder where a switched-off section sits. */
export function HiddenSectionNote({ id }: { id: string }) {
  const name = getSectionDef(id)?.name ?? id;
  return (
    <div className="fe-has-edit fe-hidden-section" data-admin-chip data-section={id}>
      <SectionEdit id={id} />
      <p>
        <strong>Hidden section</strong> {"\u00b7"} {name} {"\u2014"} Edit to show it again
      </p>
    </div>
  );
}

/** Hides a whole block when its own switch is off; admins get the placeholder. */
export function SectionGate({ id, children }: { id: string; children: ReactNode }) {
  const admin = useIsPlatformAdmin();
  const on = useSectionOn(id);
  if (on) return <SectionBackdrop id={id}>{children}</SectionBackdrop>;
  return admin ? <HiddenSectionNote id={id} /> : null;
}

/** A linear gradient layer (decorative, no pointer events). */
export function GradientLayer({ gradient, className }: { gradient: SectionGradient; className?: string }) {
  return (
    <div
      className={className ? `fe-grad-layer ${className}` : "fe-grad-layer"}
      aria-hidden
      data-grad-mode={gradient.mode}
      style={gradientLayerStyle(gradient)}
    />
  );
}

/**
 * Paints the section's own Background setting behind its content.
 * With no background chosen the children render exactly as before.
 */
export function SectionBackdrop({ id, children }: { id: string; children: ReactNode }) {
  const config = useSectionConfig(id);
  const bg = sectionBackground(config);
  const grad = sectionGradient(config);
  if ((!bg && !grad) || getSectionDef(id)?.ownBackground) return <>{children}</>;
  const overlay = grad ? gradientIsOverlay(grad, bg) : false;
  // "As background": the gradient replaces the image/video.
  const media = bg && !(grad && !overlay) ? bg : null;
  const kind = bg?.kind ?? "gradient";
  const className = `fe-bgwrap fe-bgwrap--${kind}${media && media.kind !== "color" && media.tone === "dark" ? " fe-bgwrap--dark" : ""}`;
  return (
    <div className={className} data-bg-section={id} style={bg?.kind === "color" ? { backgroundColor: bg.color } : undefined}>
      {grad && !overlay ? <GradientLayer gradient={grad} className="fe-bgwrap-grad" /> : null}
      {!media ? null : media.kind === "video" ? (
        <div className="fe-bgwrap-media" aria-hidden>
          <video src={media.video} poster={media.poster || undefined} autoPlay muted loop playsInline preload="metadata" />
        </div>
      ) : media.kind === "image" ? (
        <div className="fe-bgwrap-media" aria-hidden style={{ overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.image} alt="" loading="lazy" decoding="async" data-frame-key={frameKey(id, "bgImage")} style={storedFrameStyle(media.imagePos)} />
        </div>
      ) : null}
      {media && media.kind !== "color" && media.overlay > 0 ? (
        <div className="fe-bgwrap-overlay" aria-hidden style={{ opacity: media.overlay / 100 }} />
      ) : null}
      {grad && overlay ? <GradientLayer gradient={grad} className="fe-bgwrap-grad" /> : null}
      {children}
    </div>
  );
}
