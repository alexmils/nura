/** Meta Ads credentials for Admin → Overview. Secrets stay on the server. */

export type MetaAdsSettings = {
  accountId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
  /**
   * Unix seconds when the user token expires.
   * `0` means Meta reported that it does not expire.
   * `null` means we have not checked yet.
   */
  expiresAt: number | null;
};

export const DEFAULT_META_ADS_SETTINGS: MetaAdsSettings = {
  accountId: "",
  accessToken: "",
  appId: "",
  appSecret: "",
  expiresAt: null,
};

/** Refresh a user token once it is inside this window. */
export const META_TOKEN_REFRESH_WITHIN_SEC = 14 * 24 * 60 * 60;

export type MetaAdsAdminView = {
  accountId: string;
  appId: string;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  expiresAt: number | null;
  /** True when a saved app id and secret can extend an expiring user token. */
  autoRefresh: boolean;
  canEdit: boolean;
};

export type MetaAdsPatch = {
  accountId?: string;
  appId?: string;
  accessToken?: string;
  appSecret?: string;
};

function text(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max);
}

export function normalizeMetaAdsSettings(raw: unknown): MetaAdsSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_META_ADS_SETTINGS };
  const r = raw as Partial<MetaAdsSettings>;
  let expiresAt: number | null = null;
  if (r.expiresAt === 0) expiresAt = 0;
  else if (typeof r.expiresAt === "number" && Number.isFinite(r.expiresAt) && r.expiresAt > 0) {
    expiresAt = Math.floor(r.expiresAt);
  }
  return {
    accountId: text(r.accountId, 40),
    accessToken: text(r.accessToken, 2000),
    appId: text(r.appId, 40),
    appSecret: text(r.appSecret, 200),
    expiresAt,
  };
}

export function isMetaSecretClear(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "off" || t === "-" || t === "none" || t === "clear";
}

function keepSecret(current: string, patch: string | undefined): string {
  if (typeof patch !== "string") return current;
  const t = patch.trim();
  if (!t) return current;
  if (isMetaSecretClear(t)) return "";
  return t;
}

/** Empty secret fields keep the stored value. `off` clears it. */
export function mergeMetaAdsPatch(
  current: MetaAdsSettings,
  patch: MetaAdsPatch | undefined
): MetaAdsSettings {
  if (!patch || typeof patch !== "object") return current;
  const next: MetaAdsSettings = {
    accountId:
      typeof patch.accountId === "string" ? text(patch.accountId, 40) : current.accountId,
    appId: typeof patch.appId === "string" ? text(patch.appId, 40) : current.appId,
    accessToken: keepSecret(current.accessToken, patch.accessToken),
    appSecret: keepSecret(current.appSecret, patch.appSecret),
    expiresAt: current.expiresAt,
  };
  if (next.accessToken !== current.accessToken) next.expiresAt = null;
  return next;
}

export function validateMetaAdsPatch(patch: MetaAdsPatch | undefined): string[] {
  if (!patch || typeof patch !== "object") return [];
  const errors: string[] = [];
  if (typeof patch.accountId === "string" && patch.accountId.trim()) {
    const digits = patch.accountId.replace(/\D/g, "");
    if (!digits) errors.push("Ad account ID must be numbers.");
  }
  if (typeof patch.appId === "string" && patch.appId.trim() && !/^\d+$/.test(patch.appId.trim())) {
    errors.push("App ID must be numbers.");
  }
  for (const [label, value, min] of [
    ["Access token", patch.accessToken, 20],
    ["App secret", patch.appSecret, 8],
  ] as const) {
    if (typeof value !== "string") continue;
    const t = value.trim();
    if (!t || isMetaSecretClear(t)) continue;
    if (t.length < min) errors.push(`${label} looks too short.`);
    if (/\s/.test(t)) errors.push(`${label} must not contain spaces.`);
  }
  return errors;
}

export type MetaAdsEnvFallback = {
  accountId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
};

/** What the server will actually use: saved values, then environment. */
export function effectiveMetaAds(
  stored: MetaAdsSettings,
  env: MetaAdsEnvFallback
): MetaAdsSettings {
  return {
    accountId: stored.accountId || env.accountId,
    accessToken: stored.accessToken || env.accessToken,
    appId: stored.appId || env.appId,
    appSecret: stored.appSecret || env.appSecret,
    expiresAt: stored.expiresAt,
  };
}

export function toMetaAdsAdminView(
  stored: MetaAdsSettings,
  env: MetaAdsEnvFallback,
  canEdit: boolean
): MetaAdsAdminView {
  const effective = effectiveMetaAds(stored, env);
  const autoRefresh = Boolean(
    effective.accessToken &&
      effective.appId &&
      effective.appSecret &&
      effective.expiresAt !== 0
  );
  return {
    accountId: effective.accountId,
    appId: effective.appId,
    hasAccessToken: Boolean(effective.accessToken),
    hasAppSecret: Boolean(effective.appSecret),
    expiresAt: stored.expiresAt,
    autoRefresh,
    canEdit,
  };
}

/** User tokens can be exchanged for a new 60-day token. Never-expiring tokens cannot. */
export function shouldRefreshMetaToken(expiresAt: number | null, nowSec: number): boolean {
  if (expiresAt == null || expiresAt <= 0) return false;
  return expiresAt - nowSec <= META_TOKEN_REFRESH_WITHIN_SEC;
}
