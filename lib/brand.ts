/** Spoken + product name — UI chrome, email from-name, Stripe Checkout, lockup. */
export const BRAND_SPOKEN = "Nura";

/**
 * Public brand lockup (same as spoken). The registered operator is Receptly LLC
 * (`lib/legal-entity.ts`). Domain stays nurahelp.com — do not write “NuraHelp”
 * in user-facing copy.
 */
export const BRAND_LEGAL = BRAND_SPOKEN;

/** Current product line — a feature, not the company name. */
export const BRAND_PRODUCT = "EMDR Support";

/** Site host only — not a brand word for UI. */
export const BRAND_DOMAIN = "nurahelp.com";

/** Official social profiles (footer + Organization sameAs). */
export const BRAND_SOCIAL = {
  instagram: "https://www.instagram.com/nurahelpco/",
  facebook: "https://www.facebook.com/profile.php?id=61594147808052",
} as const;

export const BRAND_TAGLINE = "Support for therapy. Starting with EMDR.";

/**
 * Default meta description (value only). Do not put the therapy disclaimer here —
 * that lives in `BRAND_LIMITS_LINE` (footer /limits / llms.txt).
 */
export const BRAND_DESCRIPTION =
  "Guided EMDR sessions you run yourself: visual sets, optional voice, grounding, and short guides for between sessions. Start with a 7-day trial.";

/**
 * User-facing session mode names. Internal ids stay `guided` | `free`.
 * Never call the self-run mode “Free session” — it reads as $0, not “no agent.”
 */
export const SESSION_MODE_GUIDED_LABEL = "AI agent-guided session";
export const SESSION_MODE_SELF_LABEL = "Self-guided session";
export const SESSION_MODE_GUIDED_SHORT = "AI agent-guided";
export const SESSION_MODE_SELF_SHORT = "Self-guided";
/** Trial / billing cap on self-guided visual-set minutes (not a price). */
export const SESSION_MODE_SELF_SET_TIME = "self-guided set time";

/**
 * Canonical limits sentence — footer, /limits lead, llms.txt.
 * Not for meta descriptions (snippet layer).
 */
export const BRAND_LIMITS_LINE =
  "Nura is a self-help tool for practice between sessions. It is not therapy, diagnosis, or crisis care.";

/** Title stem for `/` — layout template adds ` — Nura`. Keep under ~50 chars. */
export const BRAND_TITLE_STEM =
  "EMDR Therapy Online — Guided Bilateral Stimulation";

export const BRAND_TITLE = `${BRAND_TITLE_STEM} — ${BRAND_SPOKEN}`;

/**
 * Strip trailing brand markers so the layout `%s — Nura` template cannot
 * produce `… | Nura — Nura` or `… at Nura — Nura`.
 */
export function stripBrandTitleSuffix(title: string): string {
  let t = title.trim();
  if (!t) return t;
  const brand = BRAND_SPOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  t = t.replace(new RegExp(`\\s*[|•·]\\s*${brand}\\s*$`, "i"), "").trim();
  t = t.replace(new RegExp(`\\s*[—–-]\\s*${brand}\\s*$`, "i"), "").trim();
  t = t
    .replace(new RegExp(`\\s+(?:at|for|by)\\s+${brand}\\s*$`, "i"), "")
    .trim();
  t = t.replace(/\bAi\b/g, "AI");
  return t;
}

/** Circular wordmark for marketing bylines (home blog cards, etc.). */
export const BRAND_CIRCLE_AVATAR = "/brand/nura-circle-variants/A-white-on-sage-128.png";

/** Pistachio palette — see docs/brand.md */
export const BRAND_COLORS = {
  paper: "#A4EDA5",
  gold: "#C6D67E",
  earth: "#84B067",
  olive: "#948F4E",
  ink: "#2A3020",
  sidebar: "#3D4129",
} as const;

const LEGACY_CHROME_NAMES = new Set([
  "NuraHelp AI",
  "NuraHelpAI",
  "Nura Help AI",
  "NuraHelp",
  "Nura Help",
]);

/**
 * Map leftover “NuraHelp” / “NuraHelp AI” defaults to Nura.
 * Custom admin names are kept.
 */
export function chromeBrandName(raw?: string | null): string {
  const v = raw?.trim() ?? "";
  if (!v || LEGACY_CHROME_NAMES.has(v)) return BRAND_SPOKEN;
  return v;
}

/** Rewrite leftover “NuraHelp” branding (and a few old help defaults) in stored copy. */
export function rewriteRetiredBrandCopy(text: string): string {
  return text
    .replaceAll("NuraHelp AI", BRAND_SPOKEN)
    .replaceAll("NuraHelpAI", BRAND_SPOKEN)
    .replaceAll("Nura Help AI", BRAND_SPOKEN)
    .replaceAll("NuraHelp assistant", "Nura assistant")
    .replaceAll("NuraHelp product", "Nura product")
    .replaceAll("What NuraHelp is", "What Nura is")
    .replaceAll("Nura Help", BRAND_SPOKEN)
    .replaceAll("NuraHelp", BRAND_SPOKEN)
    .replaceAll(
      "guided sessions and bilateral stimulation (BLS)",
      "guided sessions and visual sets"
    )
    .replaceAll(
      "overview of bilateral stimulation and how guided sessions",
      "overview of visual sets and how Guided sessions"
    )
    .replaceAll(
      "many people use **bilateral stimulation** — rhythmically tracking something left and right",
      "many people follow **a moving target left and right** during a visual set"
    )
    .replaceAll(
      "**bilateral stimulation** — rhythmically tracking something left and right",
      "**a moving target left and right** during a visual set"
    )
    .replaceAll(
      "bilateral stimulation — rhythmically tracking something left and right",
      "a moving target left and right during a visual set"
    )
    .replaceAll("bilateral stimulation", "left-and-right eye tracking")
    .replaceAll(
      "many people use **a moving target left and right**",
      "many people follow **a moving target left and right**"
    )
    .replaceAll(
      "use **a moving target left and right**",
      "follow **a moving target left and right**"
    )
    .replaceAll("10 minutes of free BLS", "10 minutes of self-guided set time")
    .replaceAll("free BLS minutes", "self-guided set minutes")
    .replaceAll("free BLS", "self-guided session")
    .replaceAll(
      "Free mode is BLS-only controls",
      "self-guided session is sets you run yourself"
    )
    .replaceAll("free BLS-only", "self-guided session (sets you run yourself)")
    .replaceAll("BLS-only", "sets you run yourself")
    .replaceAll("BLS controls", "Session controls")
    .replaceAll(
      "Free mode is the moving ball only",
      "self-guided session is sets you run yourself"
    )
    .replaceAll("the moving ball only", "sets you run yourself")
    .replaceAll("Free session time", "self-guided set time")
    .replaceAll("Free sessions", "self-guided sessions")
    .replaceAll("Free session", "Self-guided session")
    .replaceAll("Free visual sets", "self-guided visual sets")
    .replaceAll("Free mode", "self-guided session")
    .replace(/(?<!AI )Agent-guided/g, "AI agent-guided")
    .replace(/(?<!AI )agent-guided/g, "AI agent-guided");
}

export function brandMetadataBase(): URL {
  const raw = process.env.APP_URL?.trim() || `https://${BRAND_DOMAIN}`;
  try {
    return new URL(raw);
  } catch {
    return new URL(`https://${BRAND_DOMAIN}`);
  }
}
