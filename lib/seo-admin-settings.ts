import {
  DEFAULT_PLATFORM_SEO,
  normalizeSeoConfig,
  parseServiceAccountEmail,
  isValidClarityId,
  isValidGa4Id,
  isValidGtmId,
  isAllowedOgImageUrl,
  type PlatformSeoConfig,
  type SeoPageId,
  type SeoPageOverride,
  SEO_PAGE_IDS,
} from "@/lib/seo-config";

/** Credentials that are never echoed back to the browser. */
const CONVERSION_SECRET_KEYS = [
  "ga4ApiSecret",
  "metaCapiAccessToken",
  "googleAdsDeveloperToken",
  "googleAdsOAuthClientSecret",
  "googleAdsOAuthRefreshToken",
] as const;

type ConversionSecretKey = (typeof CONVERSION_SECRET_KEYS)[number];

/** Conversion fields safe to send to the admin form as-is. */
const CONVERSION_PLAIN_KEYS = [
  "metaPixelId",
  "metaTestEventCode",
  "googleAdsCustomerId",
  "googleAdsConversionActionId",
  "googleAdsLoginCustomerId",
  "googleAdsOAuthClientId",
  "googleAdsApiVersion",
] as const;

type ConversionPlainKey = (typeof CONVERSION_PLAIN_KEYS)[number];

type ConversionHasFlag =
  | "hasGa4ApiSecret"
  | "hasMetaCapiAccessToken"
  | "hasGoogleAdsDeveloperToken"
  | "hasGoogleAdsOAuthClientSecret"
  | "hasGoogleAdsOAuthRefreshToken";

/** Human labels so a validation error names the field the admin just typed in. */
const CONVERSION_FIELD_LABELS: Record<
  ConversionSecretKey | ConversionPlainKey,
  string
> = {
  ga4ApiSecret: "GA4 Measurement Protocol secret",
  metaCapiAccessToken: "Meta Conversions API token",
  googleAdsDeveloperToken: "Google Ads developer token",
  googleAdsOAuthClientSecret: "Google OAuth client secret",
  googleAdsOAuthRefreshToken: "Google OAuth refresh token",
  metaPixelId: "Meta Pixel ID",
  metaTestEventCode: "Meta test event code",
  googleAdsCustomerId: "Google Ads customer ID",
  googleAdsConversionActionId: "Google Ads conversion action ID",
  googleAdsLoginCustomerId: "Google Ads manager account ID",
  googleAdsOAuthClientId: "Google OAuth client ID",
  googleAdsApiVersion: "Google Ads API version",
};

const CONVERSION_HAS_FLAGS: Record<ConversionSecretKey, ConversionHasFlag> = {
  ga4ApiSecret: "hasGa4ApiSecret",
  metaCapiAccessToken: "hasMetaCapiAccessToken",
  googleAdsDeveloperToken: "hasGoogleAdsDeveloperToken",
  googleAdsOAuthClientSecret: "hasGoogleAdsOAuthClientSecret",
  googleAdsOAuthRefreshToken: "hasGoogleAdsOAuthRefreshToken",
};

export type SeoAdminView = {
  pages: Partial<Record<SeoPageId, SeoPageOverride>>;
  ga4MeasurementId: string;
  gtmId: string;
  clarityId: string;
  gscProperty: string;
  ga4PropertyId: string;
  ignoreIps: string;
  defaultOgImageUrl: string;
  /** Write-only — always empty on GET. */
  gscVerification: string;
  bingVerification: string;
  googleServiceAccountJson: string;
  hasGscVerification: boolean;
  hasBingVerification: boolean;
  hasGoogleServiceAccount: boolean;
  serviceAccountEmail: string | null;
  /** Server-side conversions — stored fields, echoed back. */
  metaPixelId: string;
  metaTestEventCode: string;
  googleAdsCustomerId: string;
  googleAdsConversionActionId: string;
  googleAdsLoginCustomerId: string;
  googleAdsOAuthClientId: string;
  googleAdsApiVersion: string;
  /** Server-side conversions — write-only, always empty on GET. */
  ga4ApiSecret: string;
  metaCapiAccessToken: string;
  googleAdsDeveloperToken: string;
  googleAdsOAuthClientSecret: string;
  googleAdsOAuthRefreshToken: string;
  hasGa4ApiSecret: boolean;
  hasMetaCapiAccessToken: boolean;
  hasGoogleAdsDeveloperToken: boolean;
  hasGoogleAdsOAuthClientSecret: boolean;
  hasGoogleAdsOAuthRefreshToken: boolean;
};

export type SeoConfigPatch = {
  pages?: Partial<Record<SeoPageId, SeoPageOverride | null>>;
  ga4MeasurementId?: string;
  gtmId?: string;
  clarityId?: string;
  gscProperty?: string;
  ga4PropertyId?: string;
  ignoreIps?: string;
  defaultOgImageUrl?: string;
  gscVerification?: string;
  bingVerification?: string;
  googleServiceAccountJson?: string;
  metaPixelId?: string;
  metaTestEventCode?: string;
  googleAdsCustomerId?: string;
  googleAdsConversionActionId?: string;
  googleAdsLoginCustomerId?: string;
  googleAdsOAuthClientId?: string;
  googleAdsApiVersion?: string;
  ga4ApiSecret?: string;
  metaCapiAccessToken?: string;
  googleAdsDeveloperToken?: string;
  googleAdsOAuthClientSecret?: string;
  googleAdsOAuthRefreshToken?: string;
};

/** Redact verification tokens and service account JSON. */
export function toSeoAdminView(
  seo: PlatformSeoConfig,
  _canEdit: boolean
): SeoAdminView {
  return {
    pages: { ...seo.pages },
    ga4MeasurementId: seo.ga4MeasurementId,
    gtmId: seo.gtmId,
    clarityId: seo.clarityId,
    gscProperty: seo.gscProperty,
    ga4PropertyId: seo.ga4PropertyId,
    ignoreIps: seo.ignoreIps,
    defaultOgImageUrl: seo.defaultOgImageUrl,
    gscVerification: "",
    bingVerification: "",
    googleServiceAccountJson: "",
    hasGscVerification: Boolean(seo.gscVerification.trim()),
    hasBingVerification: Boolean(seo.bingVerification.trim()),
    hasGoogleServiceAccount: Boolean(seo.googleServiceAccountJson.trim()),
    serviceAccountEmail: parseServiceAccountEmail(seo.googleServiceAccountJson),
    // Security: credentials are never sent back down. The form shows an "is it
    // set" badge and an empty input, where blank means "leave unchanged".
    ...Object.fromEntries(
      CONVERSION_PLAIN_KEYS.map((key) => [key, seo[key]])
    ) as Record<ConversionPlainKey, string>,
    ...Object.fromEntries(
      CONVERSION_SECRET_KEYS.map((key) => [key, ""])
    ) as Record<ConversionSecretKey, string>,
    ...Object.fromEntries(
      CONVERSION_SECRET_KEYS.map((key) => [
        CONVERSION_HAS_FLAGS[key],
        Boolean(seo[key].trim()),
      ])
    ) as Record<ConversionHasFlag, boolean>,
  };
}

function mergePageOverride(
  current: SeoPageOverride | undefined,
  patch: SeoPageOverride | null | undefined
): SeoPageOverride | undefined {
  if (patch === null) return undefined;
  if (patch === undefined) return current;
  const next: SeoPageOverride = { ...current };
  if (typeof patch.title === "string") {
    const t = patch.title.trim();
    if (t) next.title = t;
    else delete next.title;
  }
  if (typeof patch.description === "string") {
    const t = patch.description.trim();
    if (t) next.description = t;
    else delete next.description;
  }
  if (typeof patch.ogTitle === "string") {
    const t = patch.ogTitle.trim();
    if (t) next.ogTitle = t;
    else delete next.ogTitle;
  }
  if (typeof patch.ogImageUrl === "string") {
    const t = patch.ogImageUrl.trim();
    if (t && isAllowedOgImageUrl(t)) next.ogImageUrl = t;
    else delete next.ogImageUrl;
  }
  return Object.keys(next).length ? next : undefined;
}

function isSecretClearToken(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "off" || t === "-" || t === "none" || t === "clear";
}

/**
 * Merge admin form patch. Empty secret fields mean leave unchanged.
 * Secret fields set to `off` / `-` / `none` / `clear` wipe the stored value.
 * Non-secret string fields replace (empty clears).
 */
export function mergeSeoConfigPatch(
  current: PlatformSeoConfig,
  patch: SeoConfigPatch | undefined
): PlatformSeoConfig {
  if (!patch || typeof patch !== "object") return current;
  const next: PlatformSeoConfig = {
    ...current,
    pages: { ...current.pages },
  };

  if (patch.pages && typeof patch.pages === "object") {
    for (const id of SEO_PAGE_IDS) {
      if (!(id in patch.pages)) continue;
      const merged = mergePageOverride(current.pages[id], patch.pages[id]);
      if (merged) next.pages[id] = merged;
      else delete next.pages[id];
    }
  }

  if (typeof patch.ga4MeasurementId === "string") {
    next.ga4MeasurementId = patch.ga4MeasurementId.trim();
  }
  if (typeof patch.gtmId === "string") {
    next.gtmId = patch.gtmId.trim();
  }
  if (typeof patch.clarityId === "string") {
    next.clarityId = patch.clarityId.trim();
  }
  if (typeof patch.gscProperty === "string") {
    next.gscProperty = patch.gscProperty.trim();
  }
  if (typeof patch.ga4PropertyId === "string") {
    next.ga4PropertyId = patch.ga4PropertyId.trim();
  }
  if (typeof patch.ignoreIps === "string") {
    next.ignoreIps = patch.ignoreIps.trim();
  }
  if (typeof patch.defaultOgImageUrl === "string") {
    const t = patch.defaultOgImageUrl.trim();
    if (!t || isSecretClearToken(t)) {
      next.defaultOgImageUrl = "";
    } else if (isAllowedOgImageUrl(t)) {
      next.defaultOgImageUrl = t;
    }
  }

  if (typeof patch.gscVerification === "string") {
    if (isSecretClearToken(patch.gscVerification)) {
      next.gscVerification = "";
    } else if (patch.gscVerification.trim()) {
      next.gscVerification = patch.gscVerification.trim();
    }
  }
  if (typeof patch.bingVerification === "string") {
    if (isSecretClearToken(patch.bingVerification)) {
      next.bingVerification = "";
    } else if (patch.bingVerification.trim()) {
      next.bingVerification = patch.bingVerification.trim();
    }
  }
  if (typeof patch.googleServiceAccountJson === "string") {
    if (isSecretClearToken(patch.googleServiceAccountJson)) {
      next.googleServiceAccountJson = "";
    } else if (patch.googleServiceAccountJson.trim()) {
      next.googleServiceAccountJson = patch.googleServiceAccountJson.trim();
    }
  }

  // Stored conversion fields replace outright; credentials follow the same
  // blank-keeps / `off`-clears rule as the other secrets.
  for (const key of CONVERSION_PLAIN_KEYS) {
    const value = patch[key];
    if (typeof value === "string") next[key] = value.trim();
  }
  for (const key of CONVERSION_SECRET_KEYS) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    if (isSecretClearToken(value)) next[key] = "";
    else if (value.trim()) next[key] = value.trim();
  }

  return normalizeSeoConfig(next);
}

/** Returns human-readable validation errors for a patch (empty = OK). */
export function validateSeoConfigPatch(
  patch: SeoConfigPatch | undefined
): string[] {
  if (!patch || typeof patch !== "object") return [];
  const errors: string[] = [];
  if (
    typeof patch.ga4MeasurementId === "string" &&
    patch.ga4MeasurementId.trim() &&
    !isValidGa4Id(patch.ga4MeasurementId)
  ) {
    errors.push("Google Analytics ID must look like G-XXXXXXXX.");
  }
  if (
    typeof patch.gtmId === "string" &&
    patch.gtmId.trim() &&
    !isValidGtmId(patch.gtmId)
  ) {
    errors.push("Tag Manager ID must look like GTM-XXXXXXX.");
  }
  if (
    typeof patch.clarityId === "string" &&
    patch.clarityId.trim() &&
    !isValidClarityId(patch.clarityId)
  ) {
    errors.push("Clarity ID must be at least 4 alphanumeric characters.");
  }
  if (
    typeof patch.ga4PropertyId === "string" &&
    patch.ga4PropertyId.trim()
  ) {
    const raw = patch.ga4PropertyId.trim();
    const digits = raw.toLowerCase().startsWith("properties/")
      ? raw.split("/", 2)[1]?.trim() || ""
      : raw;
    if (raw.toUpperCase().startsWith("G-") || !/^\d+$/.test(digits)) {
      errors.push("GA4 property ID must be numeric (or properties/123…).");
    }
  }
  if (
    typeof patch.googleServiceAccountJson === "string" &&
    patch.googleServiceAccountJson.trim() &&
    !isSecretClearToken(patch.googleServiceAccountJson)
  ) {
    try {
      const parsed = JSON.parse(patch.googleServiceAccountJson) as {
        client_email?: unknown;
        private_key?: unknown;
      };
      if (
        typeof parsed.client_email !== "string" ||
        typeof parsed.private_key !== "string"
      ) {
        errors.push(
          "Service account JSON needs client_email and private_key."
        );
      }
    } catch {
      errors.push("Service account JSON is not valid JSON.");
    }
  }
  if (
    typeof patch.defaultOgImageUrl === "string" &&
    patch.defaultOgImageUrl.trim() &&
    !isSecretClearToken(patch.defaultOgImageUrl) &&
    !isAllowedOgImageUrl(patch.defaultOgImageUrl)
  ) {
    errors.push(
      "Default share image must be https, a path starting with /, or an uploaded image."
    );
  }
  // A mistyped credential here is invisible until the first real charge, so
  // reject the obvious mistakes at save time instead.
  const secretMinLength: Partial<Record<ConversionSecretKey, number>> = {
    ga4ApiSecret: 8,
    metaCapiAccessToken: 20,
    googleAdsDeveloperToken: 10,
  };
  for (const key of CONVERSION_SECRET_KEYS) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    const t = value.trim();
    if (!t || isSecretClearToken(t)) continue;
    const min = secretMinLength[key];
    if (min && t.length < min) {
      errors.push(`${CONVERSION_FIELD_LABELS[key]} looks too short.`);
    }
    if (/\s/.test(t)) {
      errors.push(`${CONVERSION_FIELD_LABELS[key]} must not contain spaces.`);
    }
  }

  // Ids are stored digits-only, so dashes and spaces are accepted on the way in.
  for (const key of [
    "metaPixelId",
    "googleAdsCustomerId",
    "googleAdsConversionActionId",
    "googleAdsLoginCustomerId",
  ] as const) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    const t = value.trim();
    if (t && !/^[\d\s-]+$/.test(t)) {
      errors.push(`${CONVERSION_FIELD_LABELS[key]} must be numbers only.`);
    }
  }
  if (
    typeof patch.googleAdsApiVersion === "string" &&
    patch.googleAdsApiVersion.trim() &&
    !/^v\d+$/.test(patch.googleAdsApiVersion.trim())
  ) {
    errors.push("Google Ads API version must look like v21.");
  }

  if (patch.pages && typeof patch.pages === "object") {
    for (const id of SEO_PAGE_IDS) {
      const page = patch.pages[id];
      if (!page || typeof page !== "object") continue;
      if (
        typeof page.ogImageUrl === "string" &&
        page.ogImageUrl.trim() &&
        !isAllowedOgImageUrl(page.ogImageUrl)
      ) {
        errors.push(
          `Share image for ${id} must be https, a path starting with /, or an uploaded image.`
        );
      }
    }
  }
  return errors;
}

export { DEFAULT_PLATFORM_SEO, normalizeSeoConfig, isSecretClearToken };
