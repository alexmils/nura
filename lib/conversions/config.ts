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

/** Everything a channel needs, already trimmed — read once, used by both the
 * builder and the status view so the two can never disagree. */
function readConversionFields(seo: Partial<PlatformSeoConfig> | null | undefined) {
  return {
    // The measurement id is the public tag id, shared with the browser tags
    // rather than duplicated under the conversions fields.
    measurementId: value(seo, "ga4MeasurementId"),
    ga4ApiSecret: value(seo, "ga4ApiSecret"),
    pixelId: digitsOnly(value(seo, "metaPixelId")),
    metaCapiAccessToken: value(seo, "metaCapiAccessToken"),
    metaTestEventCode: value(seo, "metaTestEventCode"),
    customerId: digitsOnly(value(seo, "googleAdsCustomerId")),
    conversionActionId: digitsOnly(value(seo, "googleAdsConversionActionId")),
    developerToken: value(seo, "googleAdsDeveloperToken"),
    loginCustomerId: digitsOnly(value(seo, "googleAdsLoginCustomerId")),
    clientId: value(seo, "googleAdsOAuthClientId"),
    clientSecret: value(seo, "googleAdsOAuthClientSecret"),
    refreshToken: value(seo, "googleAdsOAuthRefreshToken"),
    apiVersion: value(seo, "googleAdsApiVersion"),
  };
}

/**
 * Pure builder so the completeness rules stay testable without a database.
 * `seo` may be a stored config, a partial, or null when it cannot be read.
 */
export function buildConversionConfig(
  seo: Partial<PlatformSeoConfig> | null | undefined
): ConversionConfig {
  const f = readConversionFields(seo);

  const googleAdsComplete = Boolean(
    f.customerId &&
      f.conversionActionId &&
      f.developerToken &&
      f.clientId &&
      f.clientSecret &&
      f.refreshToken
  );

  return {
    ga4:
      f.measurementId && f.ga4ApiSecret
        ? { measurementId: f.measurementId, apiSecret: f.ga4ApiSecret }
        : null,
    meta:
      f.pixelId && f.metaCapiAccessToken
        ? {
            pixelId: f.pixelId,
            accessToken: f.metaCapiAccessToken,
            ...(f.metaTestEventCode ? { testEventCode: f.metaTestEventCode } : {}),
          }
        : null,
    googleAds: googleAdsComplete
      ? {
          customerId: f.customerId,
          conversionActionId: f.conversionActionId,
          developerToken: f.developerToken,
          loginCustomerId: f.loginCustomerId || undefined,
          clientId: f.clientId,
          clientSecret: f.clientSecret,
          refreshToken: f.refreshToken,
          apiVersion: f.apiVersion || undefined,
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

/**
 * Which channels are ready, and what each one is still waiting for.
 *
 * Reading the same fields the builder does means the status can name the gap —
 * "Pixel ID" rather than a bare `null` — and never exposes a secret value.
 */
export function conversionChannelStatus(
  seo: Partial<PlatformSeoConfig> | null | undefined
) {
  const f = readConversionFields(seo);

  const ga4Missing = [
    f.measurementId ? null : "Google Analytics measurement ID",
    f.ga4ApiSecret ? null : "Measurement Protocol API secret",
  ].filter((v): v is string => Boolean(v));
  const metaMissing = [
    f.pixelId ? null : "Pixel ID",
    f.metaCapiAccessToken ? null : "Conversions API access token",
  ].filter((v): v is string => Boolean(v));
  const googleAdsMissing = [
    f.customerId ? null : "Customer ID",
    f.conversionActionId ? null : "Conversion action ID",
    f.developerToken ? null : "Developer token",
    f.clientId ? null : "OAuth client ID",
    f.clientSecret ? null : "OAuth client secret",
    f.refreshToken ? null : "OAuth refresh token",
  ].filter((v): v is string => Boolean(v));

  return {
    ga4: {
      configured: ga4Missing.length === 0,
      measurementId: f.measurementId || null,
      missing: ga4Missing,
    },
    meta: {
      configured: metaMissing.length === 0,
      pixelId: f.pixelId || null,
      missing: metaMissing,
    },
    googleAds: {
      configured: googleAdsMissing.length === 0,
      customerId: f.customerId || null,
      conversionActionId: f.conversionActionId || null,
      missing: googleAdsMissing,
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
