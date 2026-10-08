/**
 * Extend a Meta user token when it is close to expiry.
 * Never-expiring tokens are left alone. Failures keep the current token.
 */

import { getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings";
import {
  effectiveMetaAds,
  shouldRefreshMetaToken,
  type MetaAdsEnvFallback,
  type MetaAdsSettings,
} from "@/lib/meta-ads-settings";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaAdsEnv(): MetaAdsEnvFallback {
  return {
    accountId: (process.env.META_ADS_ACCOUNT_ID || "").trim(),
    accessToken: (process.env.META_ADS_ACCESS_TOKEN || "").trim(),
    appId: (process.env.META_APP_ID || "").trim(),
    appSecret: (process.env.META_APP_SECRET || "").trim(),
  };
}

type DebugInfo = {
  valid: boolean;
  expiresAt: number | null;
};

async function debugToken(token: string): Promise<DebugInfo | null> {
  const url = new URL(`${GRAPH}/debug_token`);
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as {
    data?: { is_valid?: boolean; expires_at?: number };
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.data) return null;
  const expires = body.data.expires_at;
  return {
    valid: Boolean(body.data.is_valid),
    expiresAt: expires === 0 ? 0 : typeof expires === "number" && expires > 0 ? expires : null,
  };
}

async function exchangeToken(
  token: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", token);
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.access_token) {
    console.error(
      "[meta-ads] token refresh failed",
      body?.error?.message || res.status
    );
    return null;
  }
  const expiresIn = Number(body.expires_in || 0);
  const expiresAt =
    expiresIn > 0 ? Math.floor(Date.now() / 1000) + Math.floor(expiresIn) : null;
  return { accessToken: body.access_token, expiresAt: expiresAt ?? 0 };
}

let lastProbeKey = "";
let lastProbeAt = 0;
const PROBE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Return the token the dashboard should use, refreshing it first when Meta
 * allows an exchange and the saved app id and secret are present.
 */
export async function ensureFreshMetaAdsToken(
  stored: MetaAdsSettings,
  nowMs = Date.now()
): Promise<MetaAdsSettings> {
  const env = metaAdsEnv();
  const current = effectiveMetaAds(stored, env);
  if (!current.accessToken) return current;

  const nowSec = Math.floor(nowMs / 1000);
  const probeKey = `${current.accessToken.length}:${current.expiresAt ?? "x"}`;
  const freshProbe = lastProbeKey === probeKey && nowMs - lastProbeAt < PROBE_TTL_MS;
  const due = shouldRefreshMetaToken(current.expiresAt, nowSec);
  if (freshProbe && !due) return current;

  const info = current.expiresAt == null ? await debugToken(current.accessToken) : null;
  let expiresAt = current.expiresAt;
  if (info) expiresAt = info.expiresAt;

  const canExchange = Boolean(current.appId && current.appSecret);
  if (canExchange && shouldRefreshMetaToken(expiresAt, nowSec)) {
    const next = await exchangeToken(current.accessToken, current.appId, current.appSecret);
    if (next) {
      const saved = await persistToken({
        accountId: stored.accountId || current.accountId,
        appId: stored.appId || current.appId,
        appSecret: stored.appSecret || current.appSecret,
        accessToken: next.accessToken,
        expiresAt: next.expiresAt,
      });
      lastProbeKey = `${next.accessToken.length}:${next.expiresAt ?? "x"}`;
      lastProbeAt = nowMs;
      return effectiveMetaAds(saved, env);
    }
  }

  if (expiresAt !== stored.expiresAt) {
    await persistToken({ ...stored, expiresAt });
  }

  lastProbeKey = `${current.accessToken.length}:${expiresAt ?? "x"}`;
  lastProbeAt = nowMs;
  return { ...current, expiresAt };
}

async function persistToken(next: MetaAdsSettings): Promise<MetaAdsSettings> {
  const settings = await getPlatformSettings();
  const saved = await savePlatformSettings({ ...settings, metaAds: next });
  return saved.metaAds;
}

/** Test helper. */
export function resetMetaAdsProbeForTests(): void {
  lastProbeKey = "";
  lastProbeAt = 0;
}
