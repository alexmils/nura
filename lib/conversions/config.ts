/**
 * Server-side conversion delivery credentials.
 *
 * They live in `app_settings.seo` (Admin → SEO → Connections) and are read from
 * there alone — no environment fallback. A second source would make "cleared in
 * Admin" indistinguishable from "never set", and the environment would quietly
 * keep sending through a credential the admin had removed.
 *
 * Every channel degrades to "skipped" when its credentials are incomplete, so a
 * half-filled form can never block checkout or the Stripe webhook.
 */

import { getPlatformSettings } from "@/lib/platform-settings";
import type { PlatformSeoConfig } from "@/lib/seo-config";

export type Ga4ConversionConfig = {
  measurementId: string;
  apiSecret: string;
};

export type MetaConversionConfig = {
  pixelId: string;
  accessToken: string;
  /** Meta Events Manager test code — routes probe events to Test Events. */
  testEventCode?: string;
};

export type GoogleAdsConversionConfig = {
  /** Ads account that owns the conversion action, digits only. */
  customerId: string;
  /** Conversion action id (the number from `customers/X/conversionActions/Y`). */
  conversionActionId: string;
  developerToken: string;
  /** Manager account id, only when the conversion action lives under an MCC. */
  loginCustomerId?: string;
  /** OAuth client used to mint an access token from the refresh token. */
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Ads API version override, e.g. `v21`. */
  apiVersion?: string;
};

export type ConversionConfig = {
  ga4: Ga4ConversionConfig | null;
  meta: MetaConversionConfig | null;
  googleAds: GoogleAdsConversionConfig | null;
};

/** The settings fields this module owns — one list, so nothing drifts. */
export const CONVERSION_SETTING_KEYS = [
  "ga4ApiSecret",
  "metaPixelId",
  "metaCapiAccessToken",
  "metaTestEventCode",
  "googleAdsCustomerId",
  "googleAdsConversionActionId",
  "googleAdsDeveloperToken",
  "googleAdsLoginCustomerId",
  "googleAdsOAuthClientId",
  "googleAdsOAuthClientSecret",
  "googleAdsOAuthRefreshToken",
  "googleAdsApiVersion",
] as const satisfies readonly (keyof PlatformSeoConfig)[];

export type ConversionSeoFields = Pick<
  PlatformSeoConfig,
  (typeof CONVERSION_SETTING_KEYS)[number]
>;

function value(seo: Partial<PlatformSeoConfig> | null | undefined, key: keyof PlatformSeoConfig): string {
  const raw = seo?.[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function digitsOnly(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

/**
 * Pure builder so the completeness rules stay testable without a database.
 * `seo` may be a stored config, a partial, or null when it cannot be read.
 */
export function buildConversionConfig(
  seo: Partial<PlatformSeoConfig> | null | undefined
): ConversionConfig {
  // The measurement id is the public tag id, shared with the browser tags
  // rather than duplicated under the conversions fields.
  const measurementId = value(seo, "ga4MeasurementId");
  const ga4Secret = value(seo, "ga4ApiSecret");

  const pixelId = digitsOnly(value(seo, "metaPixelId"));
  const metaToken = value(seo, "metaCapiAccessToken");
  const testEventCode = value(seo, "metaTestEventCode");

  const customerId = digitsOnly(value(seo, "googleAdsCustomerId"));
  const conversionActionId = digitsOnly(value(seo, "googleAdsConversionActionId"));
  const developerToken = value(seo, "googleAdsDeveloperToken");
  const loginCustomerId = digitsOnly(value(seo, "googleAdsLoginCustomerId"));
  const clientId = value(seo, "googleAdsOAuthClientId");
  const clientSecret = value(seo, "googleAdsOAuthClientSecret");
  const refreshToken = value(seo, "googleAdsOAuthRefreshToken");
  const apiVersion = value(seo, "googleAdsApiVersion");

  const googleAdsComplete = Boolean(
    customerId &&
      conversionActionId &&
      developerToken &&
      clientId &&
      clientSecret &&
      refreshToken
  );

  return {
    ga4:
      measurementId && ga4Secret
        ? { measurementId, apiSecret: ga4Secret }
        : null,
    meta:
      pixelId && metaToken
        ? {
            pixelId,
            accessToken: metaToken,
            ...(testEventCode ? { testEventCode } : {}),
          }
        : null,
    googleAds: googleAdsComplete
      ? {
          customerId,
          conversionActionId,
          developerToken,
          loginCustomerId: loginCustomerId || undefined,
          clientId,
          clientSecret,
          refreshToken,
          apiVersion: apiVersion || undefined,
        }
      : null,
  };
}

/**
 * Read the stored credentials. Never throws: an unreadable settings row leaves
 * every channel skipped rather than failing the caller, so the Stripe webhook
 * still returns 200 and the charge is not retried forever.
 */
export async function loadConversionConfig(): Promise<ConversionConfig> {
  try {
    return buildConversionConfig((await getPlatformSettings()).seo);
  } catch (err) {
    console.warn("[conversions] platform settings unreadable", err);
    return buildConversionConfig(null);
  }
}

/** Which channels are ready, for the admin status view. Never exposes secrets. */
export function conversionChannelStatus(config: ConversionConfig) {
  return {
    ga4: {
      configured: Boolean(config.ga4),
      measurementId: config.ga4?.measurementId ?? null,
    },
    meta: {
      configured: Boolean(config.meta),
      pixelId: config.meta?.pixelId ?? null,
    },
    googleAds: {
      configured: Boolean(config.googleAds),
      customerId: config.googleAds?.customerId ?? null,
      conversionActionId: config.googleAds?.conversionActionId ?? null,
    },
  };
}

/** One-line summary of what the stored credentials currently enable. */
export function describeConversionChannels(config: ConversionConfig): string {
  const ready = [
    config.ga4 ? "GA4" : null,
    config.meta ? "Meta" : null,
    config.googleAds ? "Google Ads" : null,
  ].filter(Boolean);
  return ready.length ? ready.join(", ") : "none";
}
