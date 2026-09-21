import { getPool } from "@/lib/db";
import { getAppUrl, sendEmail, sendTemplateEmail } from "@/lib/email";
import { getPlatformSettings } from "@/lib/platform-settings";
import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import {
  accountDeletedBillingNote,
  type StripeCancelResult,
} from "@/lib/delete-account-shared";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function adminRecipientEmails(
  excludeEmail?: string
): Promise<string[]> {
  const platform = await getPlatformSettings();
  const { rows } = await getPool().query<{ email: string }>(
    `SELECT email FROM users
     WHERE role IN ('platform_admin','support') AND status = 'active'`
  );
  const recipients = new Set(
    rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean)
  );
  if (platform.supportEmail?.trim()) {
    recipients.add(platform.supportEmail.trim().toLowerCase());
  }
  const exclude = excludeEmail?.trim().toLowerCase();
  if (exclude) recipients.delete(exclude);
  return [...recipients];
}

/**
 * After a successful account delete: confirm to the user, notify admins.
 * Failures are logged; they must not undo the deletion.
 */
export async function sendAccountDeletedEmails(input: {
  email: string;
  name: string | null;
  stripe: StripeCancelResult;
  /** Self-serve vs admin-initiated */
  self: boolean;
  actorEmail?: string | null;
}): Promise<void> {
  const platform = await getPlatformSettings();
  const displayName =
    input.name?.trim() || input.email.split("@")[0] || "there";
  const supportEmail =
    platform.supportEmail?.trim() || BRAND_SUPPORT_EMAIL;
  const homeUrl = await getAppUrl("/");
  const billingNote = accountDeletedBillingNote(input.stripe);

  try {
    await sendTemplateEmail(input.email, "account_deleted", {
      name: displayName,
      supportEmail,
      homeUrl,
      billingNote,
    });
  } catch (err) {
    console.warn("[account-deleted] user confirmation email failed:", err);
  }

  const recipients = await adminRecipientEmails(input.email);
  if (!recipients.length) return;

  const siteName = platform.siteName?.trim() || "Nura";
  const activityUrl = await getAppUrl("/admin/activity");
  const summary = input.self
    ? `${displayName} (${input.email}) deleted their ${siteName} account.`
    : `${displayName} (${input.email}) was deleted from ${siteName} by ${
        input.actorEmail?.trim() || "an administrator"
      }.`;
  const stripeLine = input.stripe.hadSubscription
    ? input.stripe.canceled
      ? "Stripe subscription canceled."
      : "Stripe subscription cancel FAILED."
    : "No Stripe subscription on file.";
  const subject = `Account deleted: ${input.email}`;
  const text = `${summary}\n\n${stripeLine}\n\nActivity: ${activityUrl}`;
  const html = `<p>${escapeHtml(summary)}</p><p>${escapeHtml(stripeLine)}</p><p><a href="${escapeHtml(activityUrl)}">Open activity log</a></p>`;

  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, html, text });
    } catch (err) {
      console.error("[account-deleted] admin notify failed:", to, err);
    }
  }
}
