import { getPlatformSettings } from "@/lib/platform-settings";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateId?: string | null;
  /**
   * Override the platform Reply-To (e.g. a contact form should reply to the
   * visitor). Blank falls back to Admin → Email → Reply-To.
   */
  replyTo?: string | null;
  /** Stable key so a retry does not send the same mail twice. */
  dedupKey?: string | null;
};

export type SendEmailResult = {
  provider: "brevo" | "gmail";
  messageId?: string;
};

export class EmailQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailQuotaError";
  }
}

export function isQuotaError(err: unknown): boolean {
  if (err instanceof EmailQuotaError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("too many") ||
      msg.includes("429")
    );
  }
  return false;
}

export async function getFromAddress(): Promise<{ email: string; name: string }> {
  const platform = await getPlatformSettings();
  const email = platform.fromAddress.trim();
  if (!email) {
    throw new Error(
      "Sender address is not configured. Set it in Admin → Email."
    );
  }
  return {
    email,
    name: platform.fromName.trim() || platform.siteName || "Nura",
  };
}

/** Optional Reply-To from Admin → Email (empty = omit header). */
export async function getReplyToAddress(): Promise<string | null> {
  const platform = await getPlatformSettings();
  const reply = platform.email.replyTo.trim();
  return reply || null;
}
