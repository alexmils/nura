/**
 * Platform brand assets (favicon + /app sidebar logo).
 * Stored in app_settings; served from /brand-assets/*.
 */

import {
  SEO_OG_IMAGE_MAX_CHARS,
  isAllowedOgImageUrl,
  parseOgImageDataUrl,
} from "@/lib/seo-config";

export const BRAND_ASSET_MAX_CHARS = SEO_OG_IMAGE_MAX_CHARS;

export const DEFAULT_APP_LOGO_PATH = "/brand/nura-wave-logo-white.png";
export const DEFAULT_FAVICON_PATH = "/icon.png";

/**
 * Email header lockup: the coloured wave logo on transparency, so it sits on
 * the light card without a white box around it. Email clients need an absolute
 * URL — the template builds `<origin>${EMAIL_LOGO_PATH}`.
 */
export const EMAIL_LOGO_PATH = "/brand/nura-wave-logo.png";

/** Display width for the email lockup; the source is 1600×363 (≈4.4:1). */
export const EMAIL_LOGO_WIDTH = 168;

export function isAllowedBrandAssetUrl(url: string): boolean {
  return isAllowedOgImageUrl(url);
}

export function normalizeBrandAssetUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().slice(0, BRAND_ASSET_MAX_CHARS);
  if (!t) return "";
  return isAllowedBrandAssetUrl(t) ? t : "";
}

export { parseOgImageDataUrl as parseBrandAssetDataUrl };
