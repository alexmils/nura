import type { GoogleAdsConversionConfig } from "./config";
import {
  buildGoogleAdsClickConversion,
  type GoogleClickIdField,
} from "./payloads";
import { failed, sent, type ChannelResult } from "./types";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DEFAULT_API_VERSION = "v21";

type TokenCache = { key: string; token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

/** Test helper — drop the cached OAuth access token. */
export function clearGoogleAdsTokenCache(): void {
  tokenCache = null;
}

/** `v21`, `v22`, … — pinned in Admin so a deprecation is a settings change. */
function apiVersion(config: GoogleAdsConversionConfig): string {
  return (config.apiVersion || "").trim() || DEFAULT_API_VERSION;
}

/**
 * The Ads API rejects service accounts unless they use domain-wide delegation,
 * so this mints an access token from a refresh token issued to a real user with
 * access to the account.
 */
async function getAccessToken(
  config: GoogleAdsConversionConfig
): Promise<{ token?: string; error?: string }> {
  const key = `${config.clientId}:${config.refreshToken}`;
  const now = Date.now();
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > now + 60_000) {
    return { token: tokenCache.token };
  }

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
      }).toString(),
      cache: "no-store",
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return { error: `oauth ${res.status} ${text}` };
    }
    const parsed = JSON.parse(text) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!parsed.access_token) return { error: "oauth response had no access_token" };
    tokenCache = {
      key,
      token: parsed.access_token,
      expiresAt: now + Number(parsed.expires_in || 3600) * 1000,
    };
    return { token: parsed.access_token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Upload one offline click conversion against the stored gclid. This is the
 * only channel that credits a charge to the exact ad click that produced it,
 * rather than relying on GA4 to stitch the session back together.
 */
export async function uploadClickConversion(input: {
  config: GoogleAdsConversionConfig;
  clickId: string;
  clickIdField: GoogleClickIdField;
  occurredAt: Date;
  valueCents?: number | null;
  currency?: string | null;
  orderId?: string | null;
  /** Ask Google to validate the payload without recording a conversion. */
  validateOnly?: boolean;
}): Promise<ChannelResult> {
  const auth = await getAccessToken(input.config);
  if (!auth.token) {
    return failed("google_ads", `auth failed: ${auth.error}`);
  }

  const url = `https://googleads.googleapis.com/${apiVersion(
    input.config
  )}/customers/${input.config.customerId}:uploadClickConversions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    "Content-Type": "application/json",
    "developer-token": input.config.developerToken,
  };
  if (input.config.loginCustomerId) {
    headers["login-customer-id"] = input.config.loginCustomerId;
  }

  const body = {
    conversions: [
      buildGoogleAdsClickConversion({
        customerId: input.config.customerId,
        conversionActionId: input.config.conversionActionId,
        clickId: input.clickId,
        clickIdField: input.clickIdField,
        occurredAt: input.occurredAt,
        valueCents: input.valueCents,
        currency: input.currency,
        orderId: input.orderId,
      }),
    ],
    partialFailure: true,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) return failed("google_ads", `${res.status} ${text}`);

    let parsed: {
      results?: unknown[];
      partialFailureError?: { message?: string; code?: number };
    } = {};
    try {
      parsed = JSON.parse(text || "{}");
    } catch {
      return failed("google_ads", text || "unparseable response");
    }
    // A 200 can still carry a per-conversion rejection.
    if (parsed.partialFailureError) {
      return failed(
        "google_ads",
        parsed.partialFailureError.message ||
          JSON.stringify(parsed.partialFailureError)
      );
    }
    if (!parsed.results?.length) {
      return failed("google_ads", text || "no results returned");
    }
    return sent("google_ads");
  } catch (err) {
    return failed("google_ads", err instanceof Error ? err.message : String(err));
  }
}
