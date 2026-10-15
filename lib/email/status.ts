import {
  resolveBrevoApiKey,
  resolveGmailCredentials,
  isBrevoConfigured,
  isGmailCredentialsConfigured,
  type PlatformEmailConfig,
} from "@/lib/email-config";
import { getPlatformSettings } from "@/lib/platform-settings";

export type EmailProviderStatus = {
  gmailConfigured: boolean;
  brevoConfigured: boolean;
  /** @deprecated alias of gmailConfigured — Gmail is the fallback provider */
  gmailFallbackConfigured: boolean;
  fromAddress: string | null;
  fromName: string | null;
  appUrl: string;
  primaryProvider: "gmail" | "brevo" | "none";
};

export async function getEmailConfig(): Promise<PlatformEmailConfig> {
  const settings = await getPlatformSettings();
  return settings.email;
}

export async function getEmailProviderStatus(): Promise<
  Pick<
    EmailProviderStatus,
    | "gmailConfigured"
    | "brevoConfigured"
    | "gmailFallbackConfigured"
    | "primaryProvider"
  >
> {
  const email = await getEmailConfig();
  const gmailConfigured = isGmailCredentialsConfigured(email);
  const brevoConfigured = isBrevoConfigured(email);
  return {
    gmailConfigured,
    brevoConfigured,
    gmailFallbackConfigured: gmailConfigured,
    primaryProvider: brevoConfigured
      ? "brevo"
      : gmailConfigured
        ? "gmail"
        : "none",
  };
}

export async function getResolvedBrevoApiKey(): Promise<string | null> {
  return resolveBrevoApiKey(await getEmailConfig());
}

export async function getResolvedGmailCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} | null> {
  return resolveGmailCredentials(await getEmailConfig());
}
