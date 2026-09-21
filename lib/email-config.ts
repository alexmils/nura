/**
 * Email delivery credentials — Admin → Email.
 * Secrets live in `app_settings.email`; env vars remain optional bootstrap / fallback.
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
};

export const DEFAULT_PLATFORM_EMAIL: PlatformEmailConfig = {
  brevoApiKey: "",
  gmailClientId: "",
  gmailClientSecret: "",
  gmailRefreshToken: "",
  // Replies to any transactional mail — a receipt, a password reset — should
  // land in the inbox someone actually reads.
  replyTo: BRAND_SUPPORT_EMAIL,
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
  };
}

/**
 * True when no delivery credential is set. `replyTo` is deliberately not part
 * of this: it is optional presentation, not a credential, and it now defaults
 * to the support inbox — counting it would make every config look non-empty and
 * silently switch off the `.env` bootstrap below.
 */
export function isEmailConfigEmpty(cfg: PlatformEmailConfig): boolean {
  return (
    !cfg.brevoApiKey &&
    !cfg.gmailClientId &&
    !cfg.gmailClientSecret &&
    !cfg.gmailRefreshToken
  );
}

/** One-time / gap-fill from .env when DB fields are blank. */
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
  };
}

export function isBrevoConfigured(cfg: PlatformEmailConfig): boolean {
  return Boolean(cfg.brevoApiKey.trim() || process.env.BREVO_API_KEY?.trim());
}

export function isGmailCredentialsConfigured(cfg: PlatformEmailConfig): boolean {
  const id = cfg.gmailClientId.trim() || process.env.GMAIL_CLIENT_ID?.trim();
  const secret =
    cfg.gmailClientSecret.trim() || process.env.GMAIL_CLIENT_SECRET?.trim();
  const refresh =
    cfg.gmailRefreshToken.trim() || process.env.GMAIL_REFRESH_TOKEN?.trim();
  return Boolean(id && secret && refresh);
}

export function resolveBrevoApiKey(cfg: PlatformEmailConfig): string | null {
  const key = cfg.brevoApiKey.trim() || process.env.BREVO_API_KEY?.trim();
  return key || null;
}

export function resolveGmailCredentials(cfg: PlatformEmailConfig): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} | null {
  const clientId =
    cfg.gmailClientId.trim() || process.env.GMAIL_CLIENT_ID?.trim() || "";
  const clientSecret =
    cfg.gmailClientSecret.trim() ||
    process.env.GMAIL_CLIENT_SECRET?.trim() ||
    "";
  const refreshToken =
    cfg.gmailRefreshToken.trim() ||
    process.env.GMAIL_REFRESH_TOKEN?.trim() ||
    "";
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export type EmailCredentialSource = "stored" | "env" | "none";

export function brevoKeySource(cfg: PlatformEmailConfig): EmailCredentialSource {
  if (cfg.brevoApiKey.trim()) return "stored";
  if (process.env.BREVO_API_KEY?.trim()) return "env";
  return "none";
}

export function gmailCredsSource(
  cfg: PlatformEmailConfig
): EmailCredentialSource {
  const stored =
    cfg.gmailClientId.trim() &&
    cfg.gmailClientSecret.trim() &&
    cfg.gmailRefreshToken.trim();
  if (stored) return "stored";
  if (
    process.env.GMAIL_CLIENT_ID?.trim() &&
    process.env.GMAIL_CLIENT_SECRET?.trim() &&
    process.env.GMAIL_REFRESH_TOKEN?.trim()
  ) {
    return "env";
  }
  // Partial stored still counts as stored if any piece is in DB
  if (
    cfg.gmailClientId.trim() ||
    cfg.gmailClientSecret.trim() ||
    cfg.gmailRefreshToken.trim()
  ) {
    return "stored";
  }
  return "none";
}
