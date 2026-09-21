/**
 * Server-side conversion delivery credentials.
 *
 * These are long-lived service tokens (not per-user secrets), so they live in
 * the environment rather than `app_settings`. Every channel degrades to
 * "skipped" when its credentials are absent, so a missing token can never block
 * checkout or the Stripe webhook.
 */

export type Ga4ConversionConfig = {
  measurementId: string;
  apiSecret: string;
};

export type MetaConversionConfig = {
  pixelId: string;
  accessToken: string;
  /** Meta Events Manager test code — routes events to Test Events. */
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
  /** Separately-created OAuth client used to mint an access token from a refresh token. */
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type ConversionConfig = {
  ga4: Ga4ConversionConfig | null;
  meta: MetaConversionConfig | null;
  googleAds: GoogleAdsConversionConfig | null;
};

/** Documented in `docs/conversions.md` — keep the two in sync. */
export const CONVERSION_ENV_KEYS = {
  ga4: ["GA4_API_SECRET", "GA4_MEASUREMENT_ID"],
  meta: ["META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN", "META_TEST_EVENT_CODE"],
  googleAds: [
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION_ID",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REFRESH_TOKEN",
  ],
} as const;

function env(key: string): string {
  return (process.env[key] || "").trim();
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/**
 * GA4 measurement id is already configured for the client tags (Admin → SEO),
 * so only the Measurement Protocol API secret is new setup. The env override
 * exists for preview environments pointing at a different property.
 */
export function resolveGa4MeasurementId(
  fromSettings: string | null | undefined
): string {
  return env("GA4_MEASUREMENT_ID") || (fromSettings || "").trim();
}

export function loadConversionConfig(input: {
  ga4MeasurementId?: string | null;
}): ConversionConfig {
  const measurementId = resolveGa4MeasurementId(input.ga4MeasurementId);
  const ga4Secret = env("GA4_API_SECRET");
  const pixelId = digitsOnly(env("META_PIXEL_ID"));
  const metaToken = env("META_CAPI_ACCESS_TOKEN");

  const googleCustomerId = digitsOnly(env("GOOGLE_ADS_CUSTOMER_ID"));
  const googleActionId = digitsOnly(env("GOOGLE_ADS_CONVERSION_ACTION_ID"));
  const developerToken = env("GOOGLE_ADS_DEVELOPER_TOKEN");
  const oauthClientId = env("GOOGLE_OAUTH_CLIENT_ID");
  const oauthClientSecret = env("GOOGLE_OAUTH_CLIENT_SECRET");
  const oauthRefreshToken = env("GOOGLE_OAUTH_REFRESH_TOKEN");

  const googleAdsComplete = Boolean(
    googleCustomerId &&
      googleActionId &&
      developerToken &&
      oauthClientId &&
      oauthClientSecret &&
      oauthRefreshToken
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
            ...(env("META_TEST_EVENT_CODE")
              ? { testEventCode: env("META_TEST_EVENT_CODE") }
              : {}),
          }
        : null,
    googleAds: googleAdsComplete
      ? {
          customerId: googleCustomerId,
          conversionActionId: googleActionId,
          developerToken,
          loginCustomerId: digitsOnly(env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
          clientId: oauthClientId,
          clientSecret: oauthClientSecret,
          refreshToken: oauthRefreshToken,
        }
      : null,
  };
}

/** Which channels are ready, for the admin status view. Never exposes secrets. */
export function conversionChannelStatus(config: ConversionConfig) {
  return {
    ga4: {
      configured: Boolean(config.ga4),
      measurementId: config.ga4?.measurementId ?? null,
    },
    meta: { configured: Boolean(config.meta), pixelId: config.meta?.pixelId ?? null },
    googleAds: {
      configured: Boolean(config.googleAds),
      customerId: config.googleAds?.customerId ?? null,
      conversionActionId: config.googleAds?.conversionActionId ?? null,
    },
  };
}
