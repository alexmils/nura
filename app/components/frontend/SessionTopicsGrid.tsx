"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { appPath } from "@/lib/app-base";
import { LetterRevealHeading } from "./LetterRevealHeading";
import "./session-topics-grid.css";

const TOPICS: { label: string; Icon: () => ReactNode }[] = [
  { label: "Trauma", Icon: IsoStorm },
  { label: "PTSD", Icon: IsoShield },
  { label: "Anxiety", Icon: IsoWind },
  { label: "Panic", Icon: IsoSiren },
  { label: "Grief", Icon: IsoRain },
  { label: "Phobias", Icon: IsoEye },
  { label: "Childhood memories", Icon: IsoHouse },
  { label: "Self-worth", Icon: IsoFigure },
];

export function SessionTopicsGrid() {
  return (
    <section className="fe-topics" aria-labelledby="fe-topics-title">
      <div className="fe-container fe-topics-frame">
        <div className="fe-topics-head">
          <p className="fe-section-kicker fe-animate">Why people start</p>
          <LetterRevealHeading id="fe-topics-title" className="fe-topics-title">
            What they bring to a session.
          </LetterRevealHeading>
        </div>
        <ul className="fe-topics-grid">
          {TOPICS.map(({ label, Icon }) => (
            <li key={label} className="fe-topics-card">
              <span className="fe-topics-icon" aria-hidden>
                <Icon />
              </span>
              <p className="fe-topics-label">{label}</p>
            </li>
          ))}
          <li className="fe-topics-cta">
            <div className="fe-topics-cta-copy">
              <p className="fe-topics-cta-title">Looking for something else?</p>
              <p className="fe-topics-cta-hint">Read the guides if your word is not here.</p>
            </div>
            <div className="fe-topics-cta-actions">
              <Link href="/learn" className="fe-topics-cta-ghost">
                Read the guides
              </Link>
              <Link href={appPath("/create-account")} className="fe-topics-cta-btn">
                Get started
              </Link>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}

function IsoSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="fe-topics-iso"
      viewBox="0 0 88 88"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
    </svg>
  );
}

function IsoStorm() {
  return (
    <IsoSvg>
      <path d="M22 46c0-10 8-18 18-18 2-8 10-14 18-12 7 2 12 8 12 16 8 1 14 8 14 16 0 9-8 16-18 16H36c-8 0-14-8-14-18Z" />
      <path d="M42 48l-6 14h12l-8 16" />
    </IsoSvg>
  );
}

function IsoShield() {
  return (
    <IsoSvg>
      <path d="M44 14l26 8v22c0 16-10 28-26 34C28 72 18 60 18 44V22l26-8Z" />
      <path d="M44 22v40" />
      <path d="M28 38h32" />
    </IsoSvg>
  );
}

function IsoWind() {
  return (
    <IsoSvg>
      <path d="M16 34h40c8 0 14-6 10-12-3-5-12-4-14 2" />
      <path d="M16 46h52c6 0 10 6 6 11-3 4-11 3-13-2" />
      <path d="M16 58h28c6 0 9 5 5 9-2 3-9 2-10-2" />
    </IsoSvg>
  );
}

function IsoSiren() {
  return (
    <IsoSvg>
      <path d="M28 54h32l4 16H24l4-16Z" />
      <path d="M32 54c0-14 6-26 12-26s12 12 12 26" />
      <path d="M44 18v8" />
      <path d="M26 26l6 6" />
      <path d="M62 26l-6 6" />
    </IsoSvg>
  );
}

function IsoRain() {
  return (
    <IsoSvg>
      <path d="M24 40c0-9 8-16 17-16 2-7 10-12 18-10 6 2 10 8 10 14 7 1 13 7 13 15 0 8-7 14-16 14H38c-8 0-14-7-14-17Z" />
      <path d="M32 66l-4 10" />
      <path d="M44 66l-4 10" />
      <path d="M56 66l-4 10" />
    </IsoSvg>
  );
}

function IsoEye() {
  return (
    <IsoSvg>
      <path d="M16 44c10-16 22-24 28-24s18 8 28 24c-10 16-22 24-28 24S26 60 16 44Z" />
      <circle cx="44" cy="44" r="8" />
      <path d="M24 68L64 20" />
    </IsoSvg>
  );
}

function IsoHouse() {
  return (
    <IsoSvg>
      <path d="M16 44L44 20l28 24v28H16V44Z" />
      <path d="M36 72V50h16v22" />
      <path d="M16 44l28 12 28-12" />
    </IsoSvg>
  );
}

function IsoFigure() {
  return (
    <IsoSvg>
      <circle cx="44" cy="22" r="8" />
      <path d="M44 30v22" />
      <path d="M28 40l16 6 16-6" />
      <path d="M44 52l-12 20" />
      <path d="M44 52l12 20" />
    </IsoSvg>
  );
}
