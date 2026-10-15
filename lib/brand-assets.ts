/**
 * Platform brand assets (favicon + /app sidebar logo).
 * Stored in app_settings; served from /brand-assets/*.
 */

import { BRAND_DOMAIN } from "@/lib/brand";
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
 * URL. Gmail fetches that URL itself, so it must be the public site. A
 * login-gated host such as dev.nurahelp.com returns HTML and the logo breaks.
 */
export const EMAIL_LOGO_PATH = "/brand/nura-wave-logo.png";

export function publicEmailLogoUrl(): string {
  return `https://${BRAND_DOMAIN}${EMAIL_LOGO_PATH}`;
}

/** Use the app origin only when that host already serves the PNG in public. */
export function emailLogoSrcForOrigin(appOrigin: string): string {
  const fallback = publicEmailLogoUrl();
  try {
    const url = new URL(appOrigin);
    const host = url.hostname.replace(/\.$/, "").toLowerCase();
    const onPublicSite = host === BRAND_DOMAIN || host === `www.${BRAND_DOMAIN}`;
    if (url.protocol === "https:" && onPublicSite) {
      return `${url.origin}${EMAIL_LOGO_PATH}`;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

/** Saved templates may still point at a gated host. Outbound mail must not. */
export function rewriteEmailLogoSrc(html: string): string {
  const logo = publicEmailLogoUrl();
  return html
    .replace(/https?:\/\/[^"'\s]+\/brand\/nura-wave-logo\.png/g, logo)
    .replace(/(?<![\w/])\/brand\/nura-wave-logo\.png/g, logo);
}

/**
 * Display width for the email lockup; the source is 1600×363 (≈4.4:1).
 * Deliberately modest — the card can shrink to ~260px in a narrow preview, and
 * the lockup should sit under the copy rather than dominate it.
 */
export const EMAIL_LOGO_WIDTH = 132;

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
