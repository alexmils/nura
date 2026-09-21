/**
 * Operator ping when money actually moves.
 *
 * Same Stripe webhook moment as the customer receipt: checkout only stores a
 * card, so the charge is invisible until `invoice.paid`. Every live paid
 * invoice notifies admins (first charge and renewals).
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
 * Always-on inbox for payment alerts. Merged with active platform_admin rows
 * so a role change does not silently drop the operator copy.
 */
export const ADMIN_PAYMENT_NOTIFY_EMAIL = "amilosavljevic09@gmail.com";

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

    const recipients = await adminPaymentNotifyRecipients();
    if (!recipients.length) return { sent: 0, reason: "no recipients" };

    const customerName = user.name?.trim() || user.email.split("@")[0] || "Customer";
    const copy = buildAdminPaymentNotifyCopy({
      customerEmail: user.email,
      customerName,
      planLabel: receiptPlanLabel(input.plan),
      amount: formatReceiptAmount(input.amountCents, input.currency),
      paidAt: formatReceiptDate(input.paidAt),
      adminUserUrl: await getAppUrl(`/admin/users/${input.userId}`),
    });

    let sent = 0;
    for (const to of recipients) {
      try {
        await sendEmail({
          to,
          subject: copy.subject,
          html: copy.html,
          text: copy.text,
        });
        sent += 1;
      } catch (err) {
        console.error("[email] admin payment notify failed:", to, err);
      }
    }
    if (sent > 0) {
      console.info(`[email] admin payment notify sent to ${sent} recipient(s)`);
    }
    return { sent };
  } catch (err) {
    console.error("[email] admin payment notify failed", err);
    return {
      sent: 0,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}
