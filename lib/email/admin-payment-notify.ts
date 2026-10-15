/**
 * Operator pings for money and new accounts.
 *
 * Payment: same Stripe webhook moment as the customer receipt. Signup: email
 * register and Google OAuth when a brand-new user row is created.
 */

import { getPool } from "@/lib/db";
import { sendEmail, getAppUrl } from "@/lib/email";
import { renderStoredTemplate } from "@/lib/email-templates-db";
import { renderEmailTemplate } from "@/lib/email/templates";
import {
  formatReceiptAmount,
  formatReceiptDate,
  receiptPlanLabel,
} from "@/lib/email/purchase-receipt";
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
  return renderEmailTemplate("admin_payment", {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    planLabel: input.planLabel,
    amount: input.amount,
    paidAt: input.paidAt,
    adminUserUrl: input.adminUserUrl,
  });
}

export function buildAdminTrialNotifyCopy(input: {
  customerEmail: string;
  customerName: string;
  planLabel: string;
  amount: string;
  trialEndsAt: string | null;
  mode: "Live" | "Sandbox";
  adminUserUrl: string;
}): { subject: string; text: string; html: string } {
  return renderEmailTemplate("admin_trial", {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    planLabel: input.planLabel,
    amount: input.amount,
    trialEndsAt: input.trialEndsAt ?? "",
    mode: input.mode,
    adminUserUrl: input.adminUserUrl,
  });
}

/**
 * Email the operator when checkout starts a trial, including a $0 sandbox trial.
 * A later real charge still uses notifyAdminsOfPayment.
 */
export async function notifyAdminsOfTrial(input: {
  userId: string;
  plan?: string | null;
  amountCents: number;
  currency?: string | null;
  trialEndsAt?: string | Date | null;
  livemode: boolean;
}): Promise<{ sent: number; reason?: string }> {
  try {
    const user = await getUserById(input.userId);
    if (!user?.email) return { sent: 0, reason: "no customer" };

    const end =
      input.trialEndsAt == null
        ? null
        : formatReceiptDate(
            input.trialEndsAt instanceof Date
              ? input.trialEndsAt
              : new Date(input.trialEndsAt)
          );
    const customerName =
      user.name?.trim() || user.email.split("@")[0] || "Customer";
    const copy = await renderStoredTemplate("admin_trial", {
      customerName,
      customerEmail: user.email,
      planLabel: receiptPlanLabel(input.plan),
      amount: formatReceiptAmount(input.amountCents, input.currency),
      trialEndsAt: end && !end.includes("Invalid") ? end : "",
      mode: input.livemode ? "Live" : "Sandbox",
      adminUserUrl: await getAppUrl(`/admin/users/${input.userId}`),
    });

    return await sendToOperatorRecipients({
      ...copy,
      logLabel: "admin trial notify",
    });
  } catch (err) {
    console.error("[email] admin trial notify failed", err);
    return {
      sent: 0,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
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
  return renderEmailTemplate("admin_signup", {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    source: signupSourceLabel(input.source),
    adminUserUrl: input.adminUserUrl,
  });
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
    const copy = await renderStoredTemplate("admin_payment", {
      customerName,
      customerEmail: user.email,
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
export function buildAdminSubscriptionCancelNotifyCopy(input: {
  customerEmail: string;
  customerName: string;
  planLabel: string;
  accessEndsAt: string;
  keepsAccess: boolean;
  mode: "Live" | "Sandbox";
  adminUserUrl: string;
}): { subject: string; text: string; html: string } {
  const headline = input.keepsAccess
    ? "Subscription cancel scheduled"
    : "Subscription ended";
  const subject = input.keepsAccess
    ? `Cancel scheduled: ${input.planLabel} · ${input.mode}`
    : `Subscription ended: ${input.planLabel} · ${input.mode}`;
  return renderEmailTemplate("admin_subscription_canceled", {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    planLabel: input.planLabel,
    accessEndsAt: input.accessEndsAt,
    keepsAccess: input.keepsAccess,
    mode: input.mode,
    headline,
    adminUserUrl: input.adminUserUrl,
  });
}

/**
 * Email platform admins when a customer cancels or schedules cancel at period end.
 * Includes sandbox so dev matches trial alerts.
 */
export async function notifyAdminsOfSubscriptionCancel(input: {
  userId: string;
  plan?: string | null;
  accessEndsAt?: string | Date | null;
  keepsAccess: boolean;
  livemode: boolean;
}): Promise<{ sent: number; reason?: string }> {
  try {
    const user = await getUserById(input.userId);
    if (!user?.email) return { sent: 0, reason: "no customer" };

    const end =
      input.accessEndsAt == null
        ? ""
        : formatReceiptDate(
            input.accessEndsAt instanceof Date
              ? input.accessEndsAt
              : new Date(input.accessEndsAt)
          );

    const customerName =
      user.name?.trim() || user.email.split("@")[0] || "Customer";
    const copy = await renderStoredTemplate("admin_subscription_canceled", {
      customerName,
      customerEmail: user.email,
      planLabel: receiptPlanLabel(input.plan),
      accessEndsAt: end,
      keepsAccess: input.keepsAccess,
      mode: input.livemode ? "Live" : "Sandbox",
      headline: input.keepsAccess
        ? "Subscription cancel scheduled"
        : "Subscription ended",
      adminUserUrl: await getAppUrl(`/admin/users/${input.userId}`),
    });

    return await sendToOperatorRecipients({
      ...copy,
      logLabel: "admin subscription cancel notify",
    });
  } catch (err) {
    console.error("[email] admin subscription cancel notify failed", err);
    return {
      sent: 0,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}

export async function notifyAdminsOfSignup(input: {
  userId: string;
  email: string;
  name?: string | null;
  source: AdminSignupSource;
}): Promise<{ sent: number; reason?: string }> {
  try {
    const customerName =
      input.name?.trim() || input.email.split("@")[0] || "Customer";
    const copy = await renderStoredTemplate("admin_signup", {
      customerName,
      customerEmail: input.email.trim().toLowerCase(),
      source: signupSourceLabel(input.source),
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
