import {
  EmailQuotaError,
  getFromAddress,
  getReplyToAddress,
  type SendEmailInput,
  type SendEmailResult,
} from "./types";
import { getResolvedBrevoApiKey } from "./status";

function isBrevoQuotaResponse(status: number, body: string): boolean {
  if (status === 429) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("credit") ||
    lower.includes("daily limit") ||
    lower.includes("exceeded")
  );
}

export async function sendViaBrevo(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const apiKey = await getResolvedBrevoApiKey();
  if (!apiKey) {
    throw new Error(
      "Brevo API key is not set. Add it in Admin → Email."
    );
  }

  const from = await getFromAddress();
  const replyTo = input.replyTo?.trim() || (await getReplyToAddress());
  const payload: Record<string, unknown> = {
    sender: { name: from.name, email: from.email },
    to: [{ email: input.to }],
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text,
  };
  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();

  if (!res.ok) {
    if (isBrevoQuotaResponse(res.status, body)) {
      throw new EmailQuotaError(`Brevo quota exceeded: ${body}`);
    }
    throw new Error(`Brevo send failed (${res.status}): ${body}`);
  }

  let messageId: string | undefined;
  try {
    const json = JSON.parse(body) as { messageId?: string };
    messageId = json.messageId;
  } catch {
    /* optional */
  }

  return { provider: "brevo", messageId };
}
