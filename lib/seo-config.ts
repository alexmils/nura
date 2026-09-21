/** Public-site SEO + marketing tags — Admin → SEO (`app_settings.seo`). */

import {
  BLOG_CATEGORY_SLUGS,
  isKnownBlogCategorySlug,
  normalizeBlogCategorySlug,
  type BlogCategorySlug,
} from "@/lib/blog-categories";

const BASE_SEO_PAGE_IDS = [
  "home",
  "about",
  "clinical-team",
  "editorial",
  "emdr",
  "learn",
  "knowledge",
  "blog",
  "pricing",
  "faq",
  "support",
  "changelog",
  "privacy",
  "terms",
  "safety",
  "limits",
] as const;

export type BaseSeoPageId = (typeof BASE_SEO_PAGE_IDS)[number];

/**
 * One Admin → SEO row per blog category hub, so each `/blog/category/[slug]`
 * page owns its title, description, and share image instead of inheriting the
 * home Open Graph copy. Derived from `BLOG_CATEGORIES` — never hand-listed.
 */
export type BlogSeoPageId = `blog-${BlogCategorySlug}`;

export const BLOG_SEO_PAGE_IDS: readonly BlogSeoPageId[] =
  BLOG_CATEGORY_SLUGS.map((slug) => `blog-${slug}` as BlogSeoPageId);

export const SEO_PAGE_IDS = [...BASE_SEO_PAGE_IDS, ...BLOG_SEO_PAGE_IDS];

export type SeoPageId = BaseSeoPageId | BlogSeoPageId;

export function isSeoPageId(value: string): value is SeoPageId {
  return (SEO_PAGE_IDS as readonly string[]).includes(value);
}

/** `/blog/category/trauma` → `blog-trauma` (null when the slug is unknown). */
export function blogCategorySeoPageId(slug: string): BlogSeoPageId | null {
  const clean = normalizeBlogCategorySlug(slug);
  if (!isKnownBlogCategorySlug(clean)) return null;
  return `blog-${clean}` as BlogSeoPageId;
}

/** `blog-trauma` → `trauma` (null for every other SEO page id). */
export function blogCategoryFromSeoPageId(
  id: SeoPageId
): BlogCategorySlug | null {
  if (!id.startsWith("blog-")) return null;
  const slug = normalizeBlogCategorySlug(id.slice("blog-".length));
  if (!isKnownBlogCategorySlug(slug)) return null;
  return slug as BlogCategorySlug;
}

export type SeoPageOverride = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogImageUrl?: string;
};

/** Max length for OG image data URLs (~375KB binary). */
export const SEO_OG_IMAGE_MAX_CHARS = 500_000;

export type PlatformSeoConfig = {
  pages: Partial<Record<SeoPageId, SeoPageOverride>>;
  ga4MeasurementId: string;
  gtmId: string;
  clarityId: string;
  gscVerification: string;
  gscProperty: string;
  bingVerification: string;
  ignoreIps: string;
  /** Google service account JSON for Analytics tab (GA4 + Search Console). */
  googleServiceAccountJson: string;
  /** Numeric GA4 property id, or `properties/123…`. */
  ga4PropertyId: string;
  /**
   * Site-wide default Open Graph / share image.
   * https URL, root-relative path, or jpeg/png/webp data URL.
   * Empty → `/brand/lockup.png`.
   */
  defaultOgImageUrl: string;

  /*
   * Server-side conversion tracking (docs/conversions.md). These report the
   * first real charge from the Stripe webhook, days after the ad click, when no
   * browser is present. They live here rather than in the environment so they
   * can be changed from Admin without a redeploy — an env var of the same name
   * only fills in when the field is empty.
   */

  /** GA4 Measurement Protocol secret — Admin → Data streams → API secrets. */
  ga4ApiSecret: string;

  /** Meta dataset (pixel) id. */
  metaPixelId: string;
  /** Meta Conversions API access token. */
  metaCapiAccessToken: string;
  /** Routes probe events to Events Manager → Test Events. */
  metaTestEventCode: string;

  /** Google Ads account that owns the conversion action. */
  googleAdsCustomerId: string;
  /** Conversion action id from `customers/X/conversionActions/Y`. */
  googleAdsConversionActionId: string;
  /** Google Ads API developer token. */
  googleAdsDeveloperToken: string;
  /** Manager account id — only when the action lives under an MCC. */
  googleAdsLoginCustomerId: string;
  googleAdsOAuthClientId: string;
  googleAdsOAuthClientSecret: string;
  /** Refresh token minted with the `https://www.googleapis.com/auth/adwords` scope. */
  googleAdsOAuthRefreshToken: string;
  /** Ads API version override, e.g. `v21`. */
  googleAdsApiVersion: string;
};

export const DEFAULT_PLATFORM_SEO: PlatformSeoConfig = {
  pages: {},
  ga4MeasurementId: "",
  gtmId: "",
  clarityId: "",
  gscVerification: "",
  gscProperty: "",
  bingVerification: "",
  ignoreIps: "",
  googleServiceAccountJson: "",
  ga4PropertyId: "",
  defaultOgImageUrl: "",
  ga4ApiSecret: "",
  metaPixelId: "",
  metaCapiAccessToken: "",
  metaTestEventCode: "",
  googleAdsCustomerId: "",
  googleAdsConversionActionId: "",
  googleAdsDeveloperToken: "",
  googleAdsLoginCustomerId: "",
  googleAdsOAuthClientId: "",
  googleAdsOAuthClientSecret: "",
  googleAdsOAuthRefreshToken: "",
  googleAdsApiVersion: "",
};

function str(raw: unknown, max = 500): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max);
}

function normalizePageOverride(raw: unknown): SeoPageOverride | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: SeoPageOverride = {};
  const title = str(o.title, 200);
  const description = str(o.description, 500);
  const ogTitle = str(o.ogTitle, 200);
  const ogImageUrl = str(o.ogImageUrl, SEO_OG_IMAGE_MAX_CHARS);
  if (title) out.title = title;
  if (description) out.description = description;
  if (ogTitle) out.ogTitle = ogTitle;
  if (ogImageUrl && isAllowedOgImageUrl(ogImageUrl)) out.ogImageUrl = ogImageUrl;
  return Object.keys(out).length ? out : null;
}

export function normalizeSeoConfig(raw: unknown): PlatformSeoConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PLATFORM_SEO, pages: {} };
  }
  const r = raw as Partial<PlatformSeoConfig> & {
    pages?: Record<string, unknown>;
  };
  const pages: Partial<Record<SeoPageId, SeoPageOverride>> = {};
  if (r.pages && typeof r.pages === "object") {
    for (const id of SEO_PAGE_IDS) {
      const override = normalizePageOverride(r.pages[id]);
      if (override) pages[id] = override;
    }
    // Retired public hub id: /resources → /learn
    if (!pages.learn) {
      const legacy = normalizePageOverride(r.pages.resources);
      if (legacy) pages.learn = legacy;
    }
  }
  return {
    pages,
    ga4MeasurementId: str(r.ga4MeasurementId, 40),
    gtmId: str(r.gtmId, 40),
    clarityId: str(r.clarityId, 40),
    gscVerification: str(r.gscVerification, 200),
    gscProperty: str(r.gscProperty, 200),
    bingVerification: str(r.bingVerification, 200),
    ignoreIps: str(r.ignoreIps, 2000),
    googleServiceAccountJson: str(r.googleServiceAccountJson, 200_000),
    ga4PropertyId: str(r.ga4PropertyId, 80),
    defaultOgImageUrl: (() => {
      const t = str(r.defaultOgImageUrl, SEO_OG_IMAGE_MAX_CHARS);
      return t && isAllowedOgImageUrl(t) ? t : "";
    })(),
    ga4ApiSecret: str(r.ga4ApiSecret, 200),
    metaPixelId: str(r.metaPixelId, 40),
    // Meta access tokens run long; the cap only stops a paste of something else.
    metaCapiAccessToken: str(r.metaCapiAccessToken, 2000),
    metaTestEventCode: str(r.metaTestEventCode, 40),
    googleAdsCustomerId: str(r.googleAdsCustomerId, 40),
    googleAdsConversionActionId: str(r.googleAdsConversionActionId, 40),
    googleAdsDeveloperToken: str(r.googleAdsDeveloperToken, 200),
    googleAdsLoginCustomerId: str(r.googleAdsLoginCustomerId, 40),
    googleAdsOAuthClientId: str(r.googleAdsOAuthClientId, 300),
    googleAdsOAuthClientSecret: str(r.googleAdsOAuthClientSecret, 300),
    googleAdsOAuthRefreshToken: str(r.googleAdsOAuthRefreshToken, 1000),
    googleAdsApiVersion: str(r.googleAdsApiVersion, 10),
  };
}

export function isSeoConfigEmpty(seo: PlatformSeoConfig): boolean {
  return (
    Object.keys(seo.pages).length === 0 &&
    !seo.ga4MeasurementId &&
    !seo.gtmId &&
    !seo.clarityId &&
    !seo.gscVerification &&
    !seo.gscProperty &&
    !seo.bingVerification &&
    !seo.ignoreIps &&
    !seo.googleServiceAccountJson &&
    !seo.ga4PropertyId &&
    !seo.defaultOgImageUrl &&
    !seo.ga4ApiSecret &&
    !seo.metaPixelId &&
    !seo.metaCapiAccessToken &&
    !seo.metaTestEventCode &&
    !seo.googleAdsCustomerId &&
    !seo.googleAdsConversionActionId &&
    !seo.googleAdsDeveloperToken &&
    !seo.googleAdsLoginCustomerId &&
    !seo.googleAdsOAuthClientId &&
    !seo.googleAdsOAuthClientSecret &&
    !seo.googleAdsOAuthRefreshToken &&
    !seo.googleAdsApiVersion
  );
}

const GA4_ID_RE = /^G-[A-Z0-9]+$/i;
const GTM_ID_RE = /^GTM-[A-Z0-9]+$/i;
const CLARITY_ID_RE = /^[A-Za-z0-9]+$/;

export function isValidGa4Id(id: string): boolean {
  return GA4_ID_RE.test(id.trim());
}

export function isValidGtmId(id: string): boolean {
  return GTM_ID_RE.test(id.trim());
}

export function isValidClarityId(id: string): boolean {
  const t = id.trim();
  return t.length >= 4 && CLARITY_ID_RE.test(t);
}

/**
 * Allow https URLs, same-origin paths, or jpeg/png/webp data URLs
 * (under size cap) for Open Graph / share images.
 */
export function isAllowedOgImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith("data:image/")) {
    if (t.length > SEO_OG_IMAGE_MAX_CHARS) return false;
    return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(t);
  }
  if (t.startsWith("/") && !t.startsWith("//")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Decode a stored OG data URL for the public `/og-image` route. */
export function parseOgImageDataUrl(
  raw: string
): { contentType: string; body: Buffer } | null {
  const t = raw.trim();
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(t);
  if (!m) return null;
  try {
    const body = Buffer.from(m[2]!, "base64");
    if (!body.length) return null;
    const contentType = m[1]!.toLowerCase() === "image/jpg" ? "image/jpeg" : m[1]!;
    return { contentType, body };
  } catch {
    return null;
  }
}

export function maskPublicId(id: string, visible = 4): string {
  const t = id.trim();
  if (!t) return "";
  if (t.length <= visible) return "••••";
  return `••••${t.slice(-visible)}`;
}

export function parseServiceAccountEmail(json: string): string | null {
  const t = json.trim();
  if (!t) return null;
  try {
    const data = JSON.parse(t) as { client_email?: unknown };
    const email =
      typeof data.client_email === "string" ? data.client_email.trim() : "";
    return email || null;
  } catch {
    return null;
  }
}
