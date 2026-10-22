"use client";

import { SessionLoopKit } from "./SessionLoopKit";
import { SectionEdit } from "./section-editor/SectionEdit";
import "./session-path-sticky.css";

/**
 * Language support as its own page-layout section (it used to be rendered by
 * the how-it-works component next to "Between sessions"). The wrapper class is
 * unchanged, so the between -> languages curve and languages -> modes tilt
 * hand-offs keep their boxes.
 */
export function LanguagesSection() {
  return (
    <section
      className="fe-spath-kit-section fe-has-edit"
      data-section="home-how-languages"
      aria-label="Session language support"
    >
      <SectionEdit id="home-how-languages" />
      <SessionLoopKit />
    </section>
  );
}
