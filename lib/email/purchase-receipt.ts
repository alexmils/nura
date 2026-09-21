/**
 * Thank-you receipt for the first real charge.
 *
 * Sent from the Stripe webhook, where the charge is finally visible: checkout
 * only stores a card, so the money moves days later with no browser in the
 * loop. Only the *first* charge gets an email from us — a weekly plan would
 * otherwise collect fifty thank-you notes a year, and renewals are what
 * Stripe's own receipt emails are for (Dashboard → Settings → Customer emails).
 */

import { BILLING_PLANS, isBillingPlanId } from "@/lib/billing-constants";
import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import { getAppUrl } from "@/lib/email/templates";
import { sendTemplateEmail } from "@/lib/email";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getUserById } from "@/lib/users";

/**
 * Locale is pinned: a customer email must not render "$14.99" one day and
 * "14,99 US$" the next because the server's locale changed.
 */
export function formatReceiptAmount(cents: number, currency?: string | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.round(cents) / 100);
}

/** Plan id as the customer sees it in the app; unknown ids pass through. */
export function receiptPlanLabel(plan?: string | null): string {
  if (plan && isBillingPlanId(plan)) return BILLING_PLANS[plan].label;
  return plan?.trim() || "subscription";
}

/** Invoice date in UTC, so the email matches the invoice Stripe stored. */
export function formatReceiptDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function sendPurchaseReceipt(input: {
  userId: string;
  plan?: string | null;
  amountCents: number;
  currency?: string | null;
  paidAt: Date;
  /** Stripe livemode. A test-mode charge must never produce a real receipt. */
  livemode: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!input.livemode) {
    // Saying "we charged you $14.99" for a sandbox charge would be a lie.
    return { sent: false, reason: "test mode" };
  }
  if (input.amountCents <= 0) {
    return { sent: false, reason: "nothing charged" };
  }

  try {
    const user = await getUserById(input.userId);
    if (!user?.email) return { sent: false, reason: "no recipient" };

    // The address printed on the receipt: Admin → Platform can override it,
    // the brand constant is what ships.
    const { supportEmail: configuredSupport } = await getPlatformSettings();

    await sendTemplateEmail(user.email, "payment_receipt", {
      name: user.name?.trim() || user.email.split("@")[0]!,
      planLabel: receiptPlanLabel(input.plan),
      amount: formatReceiptAmount(input.amountCents, input.currency),
      paidAt: formatReceiptDate(input.paidAt),
      manageBillingUrl: await getAppUrl("/app/billing"),
      supportEmail: configuredSupport.trim() || BRAND_SUPPORT_EMAIL,
    });
    console.info(`[email] purchase receipt sent to ${user.email}`);
    return { sent: true };
  } catch (err) {
    // A receipt that fails to send must not fail the webhook: Stripe would
    // retry the whole event, and the charge is already recorded.
    console.error("[email] purchase receipt failed", err);
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}
