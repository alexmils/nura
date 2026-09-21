/**
 * First-touch ad attribution for the paid funnel.
 *
 * The Stripe webhook collects the first real charge days after the ad click,
 * with no browser in the loop, so the click identifiers (gclid / fbclid /
 * GA4 client_id) must be captured while the visitor is still on the page and
 * persisted server-side before checkout. Without them a server-side
 * conversion cannot be credited to the ad that paid for it.
 *
 * Click identifiers and landing data are first-touch: the first value seen is
 * the one that gets credited for the 90-day window. Device identifiers
 * (GA4 client_id, _fbp) and the explicit cookie decision are refreshed.
 */

export const ATTRIBUTION_COOKIE = "nura_attr";
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** Explicit cookie-banner decision (see `lib/marketing-consent.ts`). */
export type ConsentSnapshot = {
  analytics: boolean;
  marketing: boolean;
};

export type AttributionSnapshot = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  /** GA4 `_ga` cookie value — needed for Measurement Protocol sends. */
  gaClientId?: string;
  /** Meta browser ID cookie, improves CAPI match rate. */
  fbp?: string;
  /** Meta click ID cookie derived from fbclid. */
  fbc?: string;
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /**
   * Explicit cookie-banner decision. Absent means the visitor never chose —
   * the same "detect then consent" rule the client tags already follow, where
   * only an explicit rejection silences an event. Refreshed on every capture,
   * so a mid-trial opt-out reaches the stored snapshot at the next visit.
   */
  consent?: ConsentSnapshot;
  capturedAt?: string;
};

/** First value wins for the whole attribution window. */
const FIRST_TOUCH_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "fbc",
  "landingPage",
  "referrer",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
] as const satisfies readonly (keyof AttributionSnapshot)[];

/** Refreshed on every capture — these identify the device, not the click. */
const REFRESH_KEYS = ["gaClientId", "fbp"] as const satisfies readonly (keyof AttributionSnapshot)[];

/** Click ids come back from query strings and cookies; keep them boring. */
const CLICK_ID_PATTERN = /^[A-Za-z0-9_.\-~]{4,200}$/;

const MAX_TEXT_LENGTH = 300;

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH);
  return trimmed || undefined;
}

function cleanClickId(value: unknown): string | undefined {
  const trimmed = cleanText(value);
  return trimmed && CLICK_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function parseCookieHeader(
  header: string | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
      value = value.slice(1, -1);
    }
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/**
 * GA4's `_ga` cookie is `GA1.<domain parts>.<random>.<timestamp>`; the client_id
 * the Measurement Protocol expects is the trailing `<random>.<timestamp>`.
 */
export function gaClientIdFromCookie(
  gaCookie: string | undefined
): string | undefined {
  const value = cleanText(gaCookie);
  if (!value) return undefined;
  const parts = value.split(".");
  if (parts.length < 4 || !parts[0].startsWith("GA")) return undefined;
  const clientId = parts.slice(2).join(".");
  return /^[0-9]+\.[0-9]+$/.test(clientId) ? clientId : undefined;
}

/**
 * Read everything a landing request can tell us about the click.
 * `cookies` must already be decoded (see `parseCookieHeader`).
 */
export function parseAttributionSources(input: {
  search?: string | null;
  cookies?: Record<string, string>;
  href?: string | null;
  referrer?: string | null;
  consent?: ConsentSnapshot;
  now?: string;
}): AttributionSnapshot {
  const params = new URLSearchParams(
    (input.search || "").replace(/^\?/, "")
  );
  const cookies = input.cookies || {};

  const snapshot: AttributionSnapshot = {
    gclid: cleanClickId(params.get("gclid")),
    gbraid: cleanClickId(params.get("gbraid")),
    wbraid: cleanClickId(params.get("wbraid")),
    fbclid: cleanClickId(params.get("fbclid")),
    gaClientId: gaClientIdFromCookie(cookies._ga),
    fbp: cleanClickId(cookies._fbp),
    fbc: cleanClickId(cookies._fbc),
    landingPage: cleanText(input.href),
    referrer: cleanText(input.referrer),
    utmSource: cleanText(params.get("utm_source")),
    utmMedium: cleanText(params.get("utm_medium")),
    utmCampaign: cleanText(params.get("utm_campaign")),
    utmTerm: cleanText(params.get("utm_term")),
    utmContent: cleanText(params.get("utm_content")),
    consent: input.consent,
    capturedAt: input.now,
  };

  // gclid may arrive as a bare value in the cookie rather than the URL when the
  // user navigated internally; Google's own cookie keeps the winning click.
  if (!snapshot.gclid) {
    const fromCookie = cookies._gcl_aw;
    const value = cleanText(fromCookie);
    const embedded = value?.startsWith("GCL.") ? value.split(".").pop() : value;
    snapshot.gclid = cleanClickId(embedded);
  }
  if (!snapshot.fbc && snapshot.fbclid) {
    snapshot.fbc = cleanClickId(
      `fb.1.${Date.parse(input.now || "") || 0}.${snapshot.fbclid}`
    );
  }

  return compactAttribution(snapshot);
}

/** Strip empty strings so stored snapshots never carry blank keys. */
export function compactAttribution(
  snapshot: AttributionSnapshot
): AttributionSnapshot {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "string") {
      if (value) out[key] = value;
    } else if (isConsentSnapshot(value)) {
      out[key] = { analytics: value.analytics, marketing: value.marketing };
    }
  }
  return out as AttributionSnapshot;
}

export function isConsentSnapshot(value: unknown): value is ConsentSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.analytics === "boolean" && typeof v.marketing === "boolean";
}

/** Merge a fresh capture into what we already stored. */
export function mergeAttribution(
  current: AttributionSnapshot | null | undefined,
  incoming: AttributionSnapshot
): AttributionSnapshot {
  const base: AttributionSnapshot = { ...(current || {}) };
  for (const key of FIRST_TOUCH_KEYS) {
    const existing = base[key];
    const next = incoming[key];
    if (!existing && next) base[key] = next;
  }
  for (const key of REFRESH_KEYS) {
    const next = incoming[key];
    if (next) base[key] = next;
  }
  if (incoming.consent) base.consent = incoming.consent;
  base.capturedAt = base.capturedAt || incoming.capturedAt;
  return base;
}

/** Parse the stored attribution cookie (browser or server). */
export function parseAttributionCookie(
  raw: string | null | undefined
): AttributionSnapshot | null {
  const value = cleanText(raw);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const snapshot = compactAttribution(parsed as AttributionSnapshot);
    return Object.keys(snapshot).length ? snapshot : null;
  } catch {
    return null;
  }
}

export function readAttributionFromCookieHeader(
  header: string | null | undefined
): AttributionSnapshot | null {
  const cookies = parseCookieHeader(header);
  return parseAttributionCookie(cookies[ATTRIBUTION_COOKIE]);
}

/* ------------------------------------------------------------------ client */

function browserCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  return parseCookieHeader(document.cookie);
}

/**
 * Capture the click on the pages where the tags load. Called from
 * `MarketingTags`, which covers the marketing pages and every funnel page.
 * Safe to call repeatedly: the merge keeps the original click.
 */
export function captureAttribution(consent?: ConsentSnapshot): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const incoming = parseAttributionSources({
      search: window.location.search,
      cookies: browserCookies(),
      href: window.location.href,
      referrer: document.referrer || null,
      consent,
      now: new Date().toISOString(),
    });
    const merged = mergeAttribution(
      parseAttributionCookie(browserCookies()[ATTRIBUTION_COOKIE]),
      incoming
    );
    // Nothing worth keeping on a bare direct visit. `_ga` lands a beat after
    // gtag.js boots, so the caller re-captures once the tags are ready.
    const useful =
      merged.gclid ||
      merged.fbclid ||
      merged.gaClientId ||
      merged.utmSource ||
      merged.utmCampaign;
    if (!useful) return;
    document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(
      JSON.stringify(merged)
    )}; path=/; max-age=${ATTRIBUTION_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    /* cookies unavailable (private mode) */
  }
}

/** The click id Google Ads credits, in priority order (iOS uses gbraid/wbraid). */
export function googleClickId(
  snapshot: AttributionSnapshot | null | undefined
): string | undefined {
  if (!snapshot) return undefined;
  return snapshot.gclid || snapshot.gbraid || snapshot.wbraid || undefined;
}
