/**
 * Email delivery credentials — Admin → Email only.
 * Blank secrets may be copied once from env into `app_settings` on load.
 * Sending never reads env after that.
 */

import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";

export type PlatformEmailConfig = {
  brevoApiKey: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;
  /**
   * Reply-To for outbound mail. Customers are told to reply to the receipt, so
   * this defaults to the support inbox; a stored empty string means the admin
   * deliberately wants no Reply-To header.
   */
  replyTo: string;
  /** Brevo list id for marketing contacts. Empty means contacts sync without a list. */
  brevoMarketingListId: string;
  /** Shared secret Brevo sends as x-brevo-secret or Bearer. Empty rejects the webhook. */
  brevoWebhookSecret: string;
};

export const DEFAULT_PLATFORM_EMAIL: PlatformEmailConfig = {
  brevoApiKey: "",
  gmailClientId: "",
  gmailClientSecret: "",
  gmailRefreshToken: "",
  // Replies to any transactional mail — a receipt, a password reset — should
  // land in the inbox someone actually reads.
  replyTo: BRAND_SUPPORT_EMAIL,
  brevoMarketingListId: "",
  brevoWebhookSecret: "",
};

export function normalizeEmailConfig(raw: unknown): PlatformEmailConfig {
  const r =
    raw && typeof raw === "object"
      ? (raw as Partial<PlatformEmailConfig>)
      : {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    brevoApiKey: str(r.brevoApiKey),
    gmailClientId: str(r.gmailClientId),
    gmailClientSecret: str(r.gmailClientSecret),
    gmailRefreshToken: str(r.gmailRefreshToken),
    // A missing key takes the default (fresh install, or a row written before
    // this field existed); an explicit empty string is the admin saying they
    // want no Reply-To header.
    replyTo:
      typeof r.replyTo === "string"
        ? str(r.replyTo)
        : DEFAULT_PLATFORM_EMAIL.replyTo,
    brevoMarketingListId: str(r.brevoMarketingListId),
    brevoWebhookSecret: str(r.brevoWebhookSecret),
  };
}

/**
 * True when no delivery credential is stored. `replyTo` is not a credential.
 */
export function isEmailConfigEmpty(cfg: PlatformEmailConfig): boolean {
  return (
    !cfg.brevoApiKey &&
    !cfg.gmailClientId &&
    !cfg.gmailClientSecret &&
    !cfg.gmailRefreshToken
  );
}

/** Copy blank stored secrets from env. Does not overwrite a saved value. */
export function emailFromEnvFallback(
  current: PlatformEmailConfig
): PlatformEmailConfig {
  const env = (k: string) => process.env[k]?.trim() || "";
  const pick = (cur: string, envKey: string) => cur || env(envKey);
  return {
    brevoApiKey: pick(current.brevoApiKey, "BREVO_API_KEY"),
    gmailClientId: pick(current.gmailClientId, "GMAIL_CLIENT_ID"),
    gmailClientSecret: pick(current.gmailClientSecret, "GMAIL_CLIENT_SECRET"),
    gmailRefreshToken: pick(current.gmailRefreshToken, "GMAIL_REFRESH_TOKEN"),
    replyTo: current.replyTo,
    brevoMarketingListId: current.brevoMarketingListId,
    brevoWebhookSecret: current.brevoWebhookSecret,
  };
}

export function isBrevoConfigured(cfg: PlatformEmailConfig): boolean {
  return Boolean(cfg.brevoApiKey.trim());
}

export function isGmailCredentialsConfigured(cfg: PlatformEmailConfig): boolean {
  return Boolean(
    cfg.gmailClientId.trim() &&
      cfg.gmailClientSecret.trim() &&
      cfg.gmailRefreshToken.trim()
  );
}

export function resolveBrevoApiKey(cfg: PlatformEmailConfig): string | null {
  return cfg.brevoApiKey.trim() || null;
}

export function resolveGmailCredentials(cfg: PlatformEmailConfig): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} | null {
  const clientId = cfg.gmailClientId.trim();
  const clientSecret = cfg.gmailClientSecret.trim();
  const refreshToken = cfg.gmailRefreshToken.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export type EmailCredentialSource = "stored" | "none";

export function brevoKeySource(cfg: PlatformEmailConfig): EmailCredentialSource {
  return cfg.brevoApiKey.trim() ? "stored" : "none";
}

export function gmailCredsSource(
  cfg: PlatformEmailConfig
): EmailCredentialSource {
  if (
    cfg.gmailClientId.trim() ||
    cfg.gmailClientSecret.trim() ||
    cfg.gmailRefreshToken.trim()
  ) {
    return "stored";
  }
  return "none";
}
