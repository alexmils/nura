"use client";

import { linesOf, sectionText } from "@/lib/marketing-sections";
import { EditablePart } from "./section-editor/EditablePart";
import { useSectionConfig } from "./section-editor/MarketingCopy";
import "./values-ticker.css";

/** "ground first" → "GROUND FIRST." (one full stop, never doubled). */
function asTickerWord(raw: string): string {
  const word = raw.trim().replace(/[.]+\s*$/, "");
  return word ? `${word}.` : "";
}

/**
 * Home: values ticker — a full-bleed lime band whose uppercase words scroll
 * like a news ticker, alternating solid and faded. Words come from the
 * section panel; the band ships switched off.
 */
export function ValuesTicker() {
  const copy = useSectionConfig("home-values-ticker");
  const words = linesOf(sectionText(copy, "words"))
    .slice(0, 12)
    .map(asTickerWord)
    .filter(Boolean);

  if (!words.length) return null;

  const set = (copyIndex: number) =>
    words.map((word, index) => (
      <span
        key={`${copyIndex}-${index}`}
        className={`v2-ticker-word${index % 2 === 1 ? " is-muted" : ""}`}
      >
        {word}
      </span>
    ));

  return (
    <EditablePart id="home-values-ticker" backdrop={false}>
      <section className="v2-section v2-ticker" id="values" aria-labelledby="v2-ticker-title">
        <h2 id="v2-ticker-title" className="v2-ticker-sr">
          {words.join(" ")}
        </h2>
        <div className="v2-ticker-band">
          <div
            className="v2-ticker-track"
            aria-hidden
            style={{ animationDuration: `${Math.max(24, words.length * 6)}s` }}
          >
            <span className="v2-ticker-set">{set(0)}</span>
            <span className="v2-ticker-set">{set(1)}</span>
          </div>
        </div>
      </section>
    </EditablePart>
  );
}
