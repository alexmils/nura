"use client";

import type { ReactNode } from "react";
import { getSectionDef, sectionBackground } from "@/lib/marketing-sections";
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
}: {
  id: string;
  children: ReactNode;
  lift?: boolean;
  className?: string;
}) {
  const admin = useIsPlatformAdmin();
  const on = useSectionOn(id);
  if (!admin) return on ? <SectionBackdrop id={id}>{children}</SectionBackdrop> : null;
  if (!on) return <HiddenSectionNote id={id} />;
  return (
    <div className={className ? `fe-has-edit fe-editable-part ${className}` : "fe-has-edit fe-editable-part"} data-section={id}>
      <SectionEdit id={id} lift={lift} />
      <SectionBackdrop id={id}>{children}</SectionBackdrop>
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

/**
 * Paints the section's own Background setting behind its content.
 * With no background chosen the children render exactly as before.
 */
export function SectionBackdrop({ id, children }: { id: string; children: ReactNode }) {
  const bg = sectionBackground(useSectionConfig(id));
  if (!bg) return <>{children}</>;
  const className = `fe-bgwrap fe-bgwrap--${bg.kind}${bg.kind !== "color" && bg.tone === "dark" ? " fe-bgwrap--dark" : ""}`;
  return (
    <div className={className} data-bg-section={id} style={bg.kind === "color" ? { backgroundColor: bg.color } : undefined}>
      {bg.kind === "video" ? (
        <div className="fe-bgwrap-media" aria-hidden>
          <video src={bg.video} poster={bg.poster || undefined} autoPlay muted loop playsInline preload="metadata" />
        </div>
      ) : bg.kind === "image" ? (
        <div className="fe-bgwrap-media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bg.image} alt="" loading="lazy" decoding="async" />
        </div>
      ) : null}
      {bg.kind !== "color" && bg.overlay > 0 ? (
        <div className="fe-bgwrap-overlay" aria-hidden style={{ opacity: bg.overlay / 100 }} />
      ) : null}
      {children}
    </div>
  );
}
