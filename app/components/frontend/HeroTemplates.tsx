"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { frameKey, framePosKey } from "@/lib/image-position";
import {
  mediaNames,
  sectionList,
  sectionText,
  type HeroTemplate,
  type SectionConfig,
} from "@/lib/marketing-sections";
import { SectionMedia } from "./SectionMedia";

/** The hero's shared copy, built once by the page so every template uses the same elements (and motion hooks). */
export type HeroParts = {
  kicker: ReactNode;
  title: ReactNode;
  sub: ReactNode;
  actions: ReactNode;
  checks: ReactNode;
};

/** A template's extra media slot (its own upload, position and zoom). */
function SlotMedia({ hero, slot, className }: { hero: SectionConfig | undefined; slot: string; className: string }) {
  const names = mediaNames(slot);
  const read = (key: string) => sectionText(hero, key);
  if (!read(names.image) && !read(names.video) && !read(names.poster)) return null;
  return (
    <SectionMedia
      className={className}
      kind={read(names.kind)}
      image={read(names.image)}
      video={read(names.video)}
      poster={read(names.poster)}
      alt={read(names.alt)}
      frameKey={frameKey("home-hero", names.image)}
      framePos={read(framePosKey(names.image))}
    />
  );
}

/**
 * Every template except Default. Only the active template's elements render,
 * so nothing from another template leaks onto the page. The wrapper keeps
 * `v2-hero-inner` (the hero hand-off moves it) and the copy keeps its
 * `v2-hero-*` classes (the load reveal targets them).
 */
export function HeroTemplateBody({
  hero,
  template,
  parts,
}: {
  hero: SectionConfig | undefined;
  template: Exclude<HeroTemplate, "default">;
  parts: HeroParts;
}) {
  const text = (key: string) => sectionText(hero, key);
  const copy = (
    <div className="v2-hero-copy v2-tpl-copy">
      {parts.kicker}
      {parts.title}
      {parts.sub}
      {parts.actions}
      {parts.checks}
    </div>
  );

  if (template === "split" || template === "mirror") {
    const caption = text("sideCaption");
    return (
      <div className={`v2-hero-inner v2-tpl v2-tpl--split${template === "mirror" ? " v2-tpl--mirror" : ""}`} data-hero-template={template}>
        {copy}
        <figure className="v2-tpl-card v2-tpl-rise">
          <SlotMedia hero={hero} slot="sideMedia" className="v2-tpl-card-media" />
          {caption ? <figcaption className="v2-tpl-chip">{caption}</figcaption> : null}
        </figure>
      </div>
    );
  }

  if (template === "spotlight") {
    const label = text("clipLabel");
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--spotlight" data-hero-template={template}>
        {copy}
        <figure className="v2-tpl-clip v2-tpl-rise">
          <SlotMedia hero={hero} slot="clipMedia" className="v2-tpl-clip-media" />
          {label ? (
            <figcaption className="v2-tpl-clip-label">
              <span className="v2-tpl-live" aria-hidden />
              {label}
            </figcaption>
          ) : null}
        </figure>
      </div>
    );
  }

  if (template === "editorial") {
    const stats = sectionList(hero, "stats").filter((stat) => stat.value || stat.label);
    const note = text("statsNote");
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--editorial" data-hero-template={template}>
        <div className="v2-hero-copy v2-tpl-copy">
          {parts.kicker}
          {parts.title}
          <div className="v2-tpl-ed-row">
            <div className="v2-tpl-ed-lead">
              {parts.sub}
              {parts.actions}
              {parts.checks}
            </div>
            {stats.length || note ? (
              <aside className="v2-tpl-stats v2-tpl-rise" aria-label="At a glance">
                {stats.length ? (
                  <dl>
                    {stats.map((stat, index) => (
                      <div key={stat.id || index} className="v2-tpl-stat">
                        <dt>{stat.value}</dt>
                        <dd>{stat.label}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {note ? <p className="v2-tpl-stats-note">{note}</p> : null}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (template === "framed") {
    const caption = text("frameCaption");
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--framed" data-hero-template={template}>
        {copy}
        <figure className="v2-tpl-frame v2-tpl-rise">
          <div className="v2-tpl-frame-box">
            <SlotMedia hero={hero} slot="frameMedia" className="v2-tpl-frame-media" />
          </div>
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      </div>
    );
  }

  if (template === "stage") {
    const caption = text("stageCaption");
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--stage" data-hero-template={template}>
        <div className="v2-hero-copy v2-tpl-stage-copy">
          {parts.kicker}
          {parts.title}
          {parts.sub}
        </div>
        <figure className="v2-tpl-stage v2-tpl-rise">
          <SlotMedia hero={hero} slot="stageMedia" className="v2-tpl-stage-media" />
          {caption ? <figcaption className="v2-tpl-chip">{caption}</figcaption> : null}
        </figure>
        <div className="v2-tpl-stage-actions">
          {parts.actions}
          {parts.checks}
        </div>
      </div>
    );
  }

  if (template === "poster") {
    const caption = text("posterCaption");
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--poster" data-hero-template={template}>
        {copy}
        <figure className="v2-tpl-poster v2-tpl-rise">
          <SlotMedia hero={hero} slot="posterMedia" className="v2-tpl-poster-media" />
          {caption ? <figcaption className="v2-tpl-chip">{caption}</figcaption> : null}
        </figure>
      </div>
    );
  }

  if (template === "minimal") {
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--minimal" data-hero-template={template}>
        {copy}
      </div>
    );
  }

  if (template === "billboard") {
    const label = text("billboardLabel");
    return (
      <div className="v2-hero-inner v2-tpl v2-tpl--billboard" data-hero-template={template}>
        <figure className="v2-tpl-billboard v2-tpl-rise">
          <SlotMedia hero={hero} slot="billboardMedia" className="v2-tpl-billboard-media" />
          {label ? (
            <figcaption className="v2-tpl-chip">
              <span className="v2-tpl-live" aria-hidden />
              {label}
            </figcaption>
          ) : null}
        </figure>
        <div className="v2-hero-copy v2-tpl-copy v2-tpl-bar">
          <div className="v2-tpl-bar-head">
            {parts.kicker}
            {parts.title}
          </div>
          <div className="v2-tpl-bar-side">
            {parts.sub}
            {parts.actions}
            {parts.checks}
          </div>
        </div>
      </div>
    );
  }

  // cinema: the background fills the hero, the copy sits in a bar along the bottom.
  const bar = text("barLabel");
  return (
    <div className="v2-hero-inner v2-tpl v2-tpl--cinema" data-hero-template={template}>
      <div className="v2-hero-copy v2-tpl-copy v2-tpl-bar">
        <div className="v2-tpl-bar-head">
          {bar ? (
            <p className="v2-tpl-bar-label">
              <span className="v2-tpl-live" aria-hidden />
              {bar}
            </p>
          ) : null}
          {parts.kicker}
          {parts.title}
        </div>
        <div className="v2-tpl-bar-side">
          {parts.sub}
          {parts.actions}
          {parts.checks}
        </div>
      </div>
    </div>
  );
}

/** Headline / accent / body colours as CSS variables; undefined when none is set (Default stays byte-identical). */
export function heroInkStyle(ink: { headline: string; accent: string; body: string }): CSSProperties | undefined {
  const style: Record<string, string> = {};
  if (ink.headline) style["--hero-ink"] = ink.headline;
  if (ink.accent) style["--hero-accent"] = ink.accent;
  if (ink.body) style["--hero-body"] = ink.body;
  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}

/** prefers-reduced-motion, live. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}
