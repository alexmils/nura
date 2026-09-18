"use client";

import { Languages, Phone, Shield } from "lucide-react";
import { LetterRevealHeading } from "./LetterRevealHeading";

type KitChip = {
  code: string;
  language: string;
  country: string;
};

/** BrightHub language pills — real ISO flags, native language + country. */
const KIT_ROWS: KitChip[][] = [
  [
    { code: "fr", language: "Français", country: "France" },
    { code: "jp", language: "日本語", country: "Japan" },
    { code: "in", language: "हिन्दी", country: "India" },
    { code: "kr", language: "한국어", country: "South Korea" },
    { code: "gb", language: "English", country: "United Kingdom" },
    { code: "de", language: "Deutsch", country: "Germany" },
  ],
  [
    { code: "es", language: "Español", country: "Spain" },
    { code: "it", language: "Italiano", country: "Italy" },
    { code: "pt", language: "Português", country: "Portugal" },
    { code: "br", language: "Português", country: "Brazil" },
    { code: "ru", language: "Русский", country: "Russia" },
    { code: "ph", language: "Filipino", country: "Philippines" },
  ],
  [
    { code: "sa", language: "العربية", country: "Saudi Arabia" },
    { code: "cn", language: "中文", country: "China" },
    { code: "vn", language: "Tiếng Việt", country: "Vietnam" },
    { code: "mx", language: "Español", country: "Mexico" },
    { code: "us", language: "English", country: "United States" },
    { code: "tr", language: "Türkçe", country: "Turkey" },
  ],
];

const KIT_POINTS = [
  {
    icon: Languages,
    title: "Answers in your language",
    hint: "No translating yourself first.",
  },
  {
    icon: Shield,
    title: "Safety in every language",
    hint: "Red-flag checks and grounding never switch off.",
  },
  {
    icon: Phone,
    title: "Local help, by country",
    hint: "The crisis panel shows your country's emergency numbers.",
  },
] as const;

function flagSrc(code: string) {
  return `https://flagcdn.com/w80/${code}.png`;
}

function KitRow({
  items,
  direction,
}: {
  items: KitChip[];
  direction: "ltr" | "rtl";
}) {
  const loop = [...items, ...items];
  return (
    <div className="fe-spath-kit-row-clip">
      <ul
        className={
          direction === "rtl"
            ? "fe-spath-kit-row fe-spath-kit-row--rtl"
            : "fe-spath-kit-row"
        }
        aria-hidden
      >
        {loop.map((chip, i) => (
          <li key={`${chip.code}-${chip.country}-${i}`} className="fe-spath-kit-pill">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny remote flags, decorative */}
            <img
              className="fe-spath-kit-flag"
              src={flagSrc(chip.code)}
              alt=""
              width={40}
              height={30}
              loading="lazy"
              decoding="async"
            />
            <span className="fe-spath-kit-pill-text">
              <span className="fe-spath-kit-lang">{chip.language}</span>
              <span className="fe-spath-kit-country">{chip.country}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** BrightHub language-board clone — flags + languages, pistachio copy. */
export function SessionLoopKit() {
  return (
    <div className="fe-spath-kit">
      <div className="fe-container">
        <div className="fe-spath-kit-hero">
          <div className="fe-spath-kit-copy">
            <p className="fe-spath-kit-kicker fe-animate">Your language</p>
            <LetterRevealHeading as="h2" className="fe-spath-kit-title">
              A calm session in many languages.
            </LetterRevealHeading>
            <p className="fe-spath-kit-sub fe-animate">
              Write the way you&apos;d speak. The agent answers the same way —
              intake, check-ins, closure.
            </p>
          </div>
          <div className="fe-spath-kit-board fe-animate" aria-hidden>
            <KitRow items={KIT_ROWS[0]!} direction="ltr" />
            <KitRow items={KIT_ROWS[1]!} direction="rtl" />
            <KitRow items={KIT_ROWS[2]!} direction="ltr" />
          </div>
        </div>

        <ul className="fe-spath-kit-points">
          {KIT_POINTS.map((point) => (
            <li key={point.title} className="fe-spath-kit-point fe-animate">
              <span className="fe-spath-kit-point-icon" aria-hidden>
                <point.icon size={22} strokeWidth={1.6} />
              </span>
              <h3 className="fe-spath-kit-point-title">{point.title}</h3>
              <p className="fe-spath-kit-point-hint">{point.hint}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
