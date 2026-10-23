import { google } from "googleapis";
import {
  EmailQuotaError,
  getFromAddress,
  getReplyToAddress,
  type SendEmailInput,
  type SendEmailResult,
} from "./types";
import { getResolvedGmailCredentials } from "./status";

async function buildRawMessage(input: SendEmailInput): Promise<string> {
  const from = await getFromAddress();
  const sender = from.email;
  if (!sender) {
    throw new Error(
      "Gmail send-as address is not set. Configure Admin → Email → From address."
    );
  }
  const replyTo = input.replyTo?.trim() || (await getReplyToAddress());
  const boundary = `nurahelp_${Date.now()}`;

  const lines = [
    `From: ${from.name} <${sender}>`,
    `To: ${input.to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.text).toString("base64"),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.html).toString("base64"),
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

export async function isGmailReady(): Promise<boolean> {
  return Boolean(await getResolvedGmailCredentials());
}

export async function sendViaGmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const creds = await getResolvedGmailCredentials();

  if (!creds) {
    throw new Error(
      "Gmail API not configured. Set credentials in Admin → Email."
    );
  }

  const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2.setCredentials({ refresh_token: creds.refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const raw = await buildRawMessage(input);

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(raw)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
      },
    });

    return { provider: "gmail", messageId: res.data.id ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("quota") || msg.includes("Rate Limit")) {
      throw new EmailQuotaError(`Gmail quota exceeded: ${msg}`);
    }
    throw err;
  }
}
