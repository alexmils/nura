import { rewriteEmailLogoSrc } from "@/lib/brand-assets";
import { sendViaBrevo } from "./brevo";
import { isGmailReady, sendViaGmail } from "./gmail";
import { logEmailEvent } from "@/lib/email-events";
import { getResolvedBrevoApiKey } from "./status";
import {
  isQuotaError,
  type SendEmailInput,
  type SendEmailResult,
} from "./types";

export type { SendEmailInput, SendEmailResult } from "./types";
export {
  renderEmailTemplate,
  getAppUrl,
  appUrl,
  type EmailTemplateId,
  type EmailTemplateData,
} from "./templates";

/**
 * Primary: Brevo. Fallback: Gmail API (send-as from Admin → Email)
 * when Brevo is missing or hits quota.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const message = { ...input, html: rewriteEmailLogoSrc(input.html) };
  const brevoKey = await getResolvedBrevoApiKey();
  const gmailReady = await isGmailReady();

  try {
    let result: SendEmailResult;

    if (brevoKey) {
      try {
        result = await sendViaBrevo(message);
      } catch (err) {
        if (isQuotaError(err) && gmailReady) {
          console.warn("[email] Brevo quota hit, falling back to Gmail API");
          result = await sendViaGmail(message);
        } else if (isQuotaError(err)) {
          throw new Error(
            "Brevo quota exceeded and Gmail API fallback is not configured"
          );
        } else {
          throw err;
        }
      }
    } else if (gmailReady) {
      result = await sendViaGmail(message);
    } else {
      throw new Error(
        "No email provider configured. Set Brevo API key (preferred) or Gmail API credentials in Admin → Email."
      );
    }

    await logEmailEvent({
      toEmail: input.to,
      templateId: input.templateId ?? null,
      provider: result.provider,
      status: "sent",
      dedupKey: input.dedupKey ?? null,
    });
    return result;
  } catch (err) {
    await logEmailEvent({
      toEmail: input.to,
      templateId: input.templateId ?? null,
      provider: brevoKey ? "brevo" : gmailReady ? "gmail" : null,
      status: "failed",
      error: err instanceof Error ? err.message : "Send failed",
    });
    throw err;
  }
}

export async function sendTemplateEmail<
  T extends import("./templates").EmailTemplateId,
>(
  to: string,
  templateId: T,
  data: import("./templates").EmailTemplateData[T],
  options?: { dedupKey?: string | null }
): Promise<SendEmailResult> {
  const { renderStoredTemplate } = await import("@/lib/email-templates-db");
  const { subject, html, text } = await renderStoredTemplate(templateId, data);
  return sendEmail({
    to,
    subject,
    html,
    text,
    templateId,
    dedupKey: options?.dedupKey ?? null,
  });
}
