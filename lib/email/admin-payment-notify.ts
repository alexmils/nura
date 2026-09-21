/**
 * Operator pings for money and new accounts.
 *
 * Payment: same Stripe webhook moment as the customer receipt. Signup: email
 * register and Google OAuth when a brand-new user row is created.
 */

import { getPool } from "@/lib/db";
import { sendEmail, getAppUrl } from "@/lib/email";
import {
  formatReceiptAmount,
  formatReceiptDate,
  receiptPlanLabel,
} from "@/lib/email/purchase-receipt";
import { escapeHtml } from "@/lib/help-format";
import { getUserById } from "@/lib/users";

/**
 * Always-on inbox for operator alerts. Merged with active platform_admin rows
 * so a role change does not silently drop the operator copy.
 */
export const ADMIN_PAYMENT_NOTIFY_EMAIL = "amilosavljevic09@gmail.com";

export type AdminSignupSource = "email" | "google";

/** Active platform admins plus the fixed operator address. */
export async function adminPaymentNotifyRecipients(): Promise<string[]> {
  const { rows } = await getPool().query<{ email: string }>(
    `SELECT email FROM users
     WHERE role = 'platform_admin' AND status = 'active'`
  );
  const recipients = new Set(
    rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean)
  );
  recipients.add(ADMIN_PAYMENT_NOTIFY_EMAIL.toLowerCase());
  return [...recipients];
}

export function buildAdminPaymentNotifyCopy(input: {
  customerEmail: string;
  customerName: string;
  planLabel: string;
  amount: string;
  paidAt: string;
  adminUserUrl: string;
}): { subject: string; text: string; html: string } {
  const who = `${input.customerName} <${input.customerEmail}>`;
  const subject = `Payment received: ${input.amount} · ${input.planLabel}`;
  const text = [
    `${who} paid ${input.amount} for ${input.planLabel}.`,
    `Date: ${input.paidAt}`,
    "",
    `Open user: ${input.adminUserUrl}`,
  ].join("\n");
  const html = `<p><strong>${escapeHtml(input.customerName)}</strong> (${escapeHtml(input.customerEmail)}) paid <strong>${escapeHtml(input.amount)}</strong> for <strong>${escapeHtml(input.planLabel)}</strong>.</p>
<p>Date: ${escapeHtml(input.paidAt)}</p>
<p><a href="${escapeHtml(input.adminUserUrl)}">Open user in admin</a></p>`;
  return { subject, text, html };
}

export function signupSourceLabel(source: AdminSignupSource): string {
  return source === "google" ? "Google" : "Email";
}

export function buildAdminSignupNotifyCopy(input: {
  customerEmail: string;
  customerName: string;
  source: AdminSignupSource;
  adminUserUrl: string;
}): { subject: string; text: string; html: string } {
  const via = signupSourceLabel(input.source);
  const subject = `New account: ${input.customerEmail}`;
  const text = [
    `${input.customerName} <${input.customerEmail}> created a Nura account (${via}).`,
    "",
    `Open user: ${input.adminUserUrl}`,
  ].join("\n");
  const html = `<p><strong>${escapeHtml(input.customerName)}</strong> (${escapeHtml(input.customerEmail)}) created a Nura account via <strong>${escapeHtml(via)}</strong>.</p>
<p><a href="${escapeHtml(input.adminUserUrl)}">Open user in admin</a></p>`;
  return { subject, text, html };
}

async function sendToOperatorRecipients(input: {
  subject: string;
  html: string;
  text: string;
  logLabel: string;
}): Promise<{ sent: number; reason?: string }> {
  const recipients = await adminPaymentNotifyRecipients();
  if (!recipients.length) return { sent: 0, reason: "no recipients" };

  let sent = 0;
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      sent += 1;
    } catch (err) {
      console.error(`[email] ${input.logLabel} failed:`, to, err);
    }
  }
  if (sent > 0) {
    console.info(`[email] ${input.logLabel} sent to ${sent} recipient(s)`);
  }
  return { sent };
}

/**
 * Email platform admins that a live charge cleared.
 * Failures are logged only: the webhook must still return 200.
 */
export async function notifyAdminsOfPayment(input: {
  userId: string;
  plan?: string | null;
  amountCents: number;
  currency?: string | null;
  paidAt: Date;
  livemode: boolean;
}): Promise<{ sent: number; reason?: string }> {
  if (!input.livemode) {
    return { sent: 0, reason: "test mode" };
  }
  if (input.amountCents <= 0) {
    return { sent: 0, reason: "nothing charged" };
  }

  try {
    const user = await getUserById(input.userId);
    if (!user?.email) return { sent: 0, reason: "no customer" };

    const customerName =
      user.name?.trim() || user.email.split("@")[0] || "Customer";
    const copy = buildAdminPaymentNotifyCopy({
      customerEmail: user.email,
      customerName,
      planLabel: receiptPlanLabel(input.plan),
      amount: formatReceiptAmount(input.amountCents, input.currency),
      paidAt: formatReceiptDate(input.paidAt),
      adminUserUrl: await getAppUrl(`/admin/users/${input.userId}`),
    });

    return await sendToOperatorRecipients({
      ...copy,
      logLabel: "admin payment notify",
    });
  } catch (err) {
    console.error("[email] admin payment notify failed", err);
    return {
      sent: 0,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}

/**
 * Email platform admins that someone just created an account.
 * Failures must not block signup.
 */
export async function notifyAdminsOfSignup(input: {
  userId: string;
  email: string;
  name?: string | null;
  source: AdminSignupSource;
}): Promise<{ sent: number; reason?: string }> {
  try {
    const customerName =
      input.name?.trim() || input.email.split("@")[0] || "Customer";
    const copy = buildAdminSignupNotifyCopy({
      customerEmail: input.email.trim().toLowerCase(),
      customerName,
      source: input.source,
      adminUserUrl: await getAppUrl(`/admin/users/${input.userId}`),
    });

    return await sendToOperatorRecipients({
      ...copy,
      logLabel: "admin signup notify",
    });
  } catch (err) {
    console.error("[email] admin signup notify failed", err);
    return {
      sent: 0,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}
