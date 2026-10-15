import {
  DEFAULT_PLATFORM_EMAIL,
  type PlatformEmailConfig,
  brevoKeySource,
  gmailCredsSource,
  isBrevoConfigured,
  isGmailCredentialsConfigured,
  normalizeEmailConfig,
} from "@/lib/email-config";

export type EmailAdminView = {
  fromName: string;
  fromAddress: string;
  replyTo: string;
  brevoMarketingListId: string;
  /** Write-only — always empty on GET. */
  brevoWebhookSecret: string;
  hasBrevoWebhookSecret: boolean;
  brevoApiKey: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;
  hasBrevoApiKey: boolean;
  hasGmailClientId: boolean;
  hasGmailClientSecret: boolean;
  hasGmailRefreshToken: boolean;
  brevoSource: "stored" | "none";
  gmailSource: "stored" | "none";
};

export type EmailAdminStatus = {
  brevoConfigured: boolean;
  gmailConfigured: boolean;
  /** @deprecated alias of gmailConfigured */
  gmailFallbackConfigured: boolean;
  primaryProvider: "brevo" | "gmail" | "none";
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  appUrl: string;
};

export function emailAdminStatus(
  email: PlatformEmailConfig,
  opts: {
    fromName: string;
    fromAddress: string;
    appUrl: string;
    resolvedFromName: string | null;
    resolvedFromAddress: string | null;
  }
): EmailAdminStatus {
  const brevoConfigured = isBrevoConfigured(email);
  const gmailConfigured = isGmailCredentialsConfigured(email);
  return {
    brevoConfigured,
    gmailConfigured,
    gmailFallbackConfigured: gmailConfigured,
    primaryProvider: brevoConfigured
      ? "brevo"
      : gmailConfigured
        ? "gmail"
        : "none",
    fromName: opts.resolvedFromName,
    fromAddress: opts.resolvedFromAddress,
    replyTo: email.replyTo.trim() || null,
    appUrl: opts.appUrl,
  };
}

/** Redact live secrets — never echo them back. */
export function toEmailAdminView(
  email: PlatformEmailConfig,
  sender: { fromName: string; fromAddress: string },
  _canEdit: boolean
): EmailAdminView {
  return {
    fromName: sender.fromName,
    fromAddress: sender.fromAddress,
    replyTo: email.replyTo,
    brevoMarketingListId: email.brevoMarketingListId,
    brevoWebhookSecret: "",
    hasBrevoWebhookSecret: Boolean(email.brevoWebhookSecret.trim()),
    brevoApiKey: "",
    gmailClientId: "",
    gmailClientSecret: "",
    gmailRefreshToken: "",
    hasBrevoApiKey: Boolean(email.brevoApiKey.trim()),
    hasGmailClientId: Boolean(email.gmailClientId.trim()),
    hasGmailClientSecret: Boolean(email.gmailClientSecret.trim()),
    hasGmailRefreshToken: Boolean(email.gmailRefreshToken.trim()),
    brevoSource: brevoKeySource(email),
    gmailSource: gmailCredsSource(email),
  };
}

/**
 * Merge admin form patch. Empty secret fields mean leave unchanged.
 * Empty replyTo / from fields replace (explicit clear allowed for replyTo).
 */
export function mergeEmailConfigPatch(
  current: PlatformEmailConfig,
  patch: Partial<PlatformEmailConfig> | undefined
): PlatformEmailConfig {
  if (!patch || typeof patch !== "object") return current;
  const next: PlatformEmailConfig = { ...current };

  if (typeof patch.brevoApiKey === "string" && patch.brevoApiKey.trim()) {
    next.brevoApiKey = patch.brevoApiKey.trim();
  }
  if (typeof patch.brevoWebhookSecret === "string" && patch.brevoWebhookSecret.trim()) {
    next.brevoWebhookSecret = patch.brevoWebhookSecret.trim();
  }
  if (typeof patch.gmailClientId === "string" && patch.gmailClientId.trim()) {
    next.gmailClientId = patch.gmailClientId.trim();
  }
  if (
    typeof patch.gmailClientSecret === "string" &&
    patch.gmailClientSecret.trim()
  ) {
    next.gmailClientSecret = patch.gmailClientSecret.trim();
  }
  if (
    typeof patch.gmailRefreshToken === "string" &&
    patch.gmailRefreshToken.trim()
  ) {
    next.gmailRefreshToken = patch.gmailRefreshToken.trim();
  }
  if (typeof patch.replyTo === "string") {
    next.replyTo = patch.replyTo.trim();
  }
  if (typeof patch.brevoMarketingListId === "string") {
    next.brevoMarketingListId = patch.brevoMarketingListId.trim();
  }

  return next;
}

export { DEFAULT_PLATFORM_EMAIL, normalizeEmailConfig };
