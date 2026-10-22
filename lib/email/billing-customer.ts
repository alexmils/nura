/**
 * Customer billing mail. These are transactional: they do not check marketing opt-in.
 * Live charges only. Dedup keys stop Stripe retries from sending twice.
 */

import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import { ensureSchemaReady, getPool } from "@/lib/db";
import { clearSubscriptionCancelScheduledActivity } from "@/lib/subscription-cancel-effects";
import { hasSentEmailDedup } from "@/lib/email-events";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import {
  formatReceiptAmount,
  formatReceiptDate,
  receiptPlanLabel,
} from "@/lib/email/purchase-receipt";
import { getEmailTemplateAutomation } from "@/lib/email-templates-db";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getUserById } from "@/lib/users";

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;
/** If the cron was down, look this far back past the due date, not further. */
const REVIEW_CATCHUP_DAYS = 7;

/** Due once the trial ends within 2 days, until the end time. */
export function isTrialReminderDue(
  trialEndsAt: Date,
  now: Date = new Date()
): boolean {
  const diff = trialEndsAt.getTime() - now.getTime();
  return diff > 0 && diff <= 2 * MS_DAY;
}

async function supportEmail(): Promise<string> {
  const { supportEmail: configured } = await getPlatformSettings();
  return configured.trim() || BRAND_SUPPORT_EMAIL;
}

async function displayName(userId: string): Promise<{
  email: string;
  name: string;
} | null> {
  const user = await getUserById(userId);
  if (!user?.email) return null;
  return {
    email: user.email,
    name: user.name?.trim() || user.email.split("@")[0]!,
  };
}

export async function sendTrialStartedEmail(input: {
  userId: string;
  plan?: string | null;
  amountCents: number;
  currency?: string | null;
  trialEndsAt: string | Date | null;
  livemode: boolean;
  stripeEventId: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!input.livemode) return { sent: false, reason: "test mode" };
  const dedup = `trial_started:${input.stripeEventId}`;
  if (await hasSentEmailDedup(dedup)) return { sent: false, reason: "already sent" };
  const who = await displayName(input.userId);
  if (!who) return { sent: false, reason: "no recipient" };
  const end =
    input.trialEndsAt == null
      ? ""
      : formatReceiptDate(
          input.trialEndsAt instanceof Date
            ? input.trialEndsAt
            : new Date(input.trialEndsAt)
        );
  await sendTemplateEmail(
    who.email,
    "trial_started",
    {
      name: who.name,
      planLabel: receiptPlanLabel(input.plan),
      amount: formatReceiptAmount(input.amountCents, input.currency),
      trialEndsAt: end || "the end of the trial",
      manageBillingUrl: await getAppUrl("/app/billing/manage"),
      supportEmail: await supportEmail(),
    },
    { dedupKey: dedup }
  );
  return { sent: true };
}

export async function sendPaymentFailedEmail(input: {
  userId: string;
  amountCents: number;
  currency?: string | null;
  livemode: boolean;
  stripeEventId: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!input.livemode) return { sent: false, reason: "test mode" };
  if (input.amountCents <= 0) return { sent: false, reason: "nothing due" };
  const dedup = `payment_failed:${input.stripeEventId}`;
  if (await hasSentEmailDedup(dedup)) return { sent: false, reason: "already sent" };
  const who = await displayName(input.userId);
  if (!who) return { sent: false, reason: "no recipient" };
  await sendTemplateEmail(
    who.email,
    "payment_failed",
    {
      name: who.name,
      amount: formatReceiptAmount(input.amountCents, input.currency),
      manageBillingUrl: await getAppUrl("/app/billing/manage"),
      supportEmail: await supportEmail(),
    },
    { dedupKey: dedup }
  );
  return { sent: true };
}

export async function sendSubscriptionCanceledEmail(input: {
  userId: string;
  accessEndsAt: string | Date | null;
  stripeSubscriptionId: string;
  livemode: boolean;
  /** Still inside the paid period. Deleted subscriptions are not. */
  keepsAccess?: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!input.livemode) return { sent: false, reason: "test mode" };
  const dedup = `subscription_canceled:${input.stripeSubscriptionId}`;
  if (await hasSentEmailDedup(dedup)) return { sent: false, reason: "already sent" };
  const claimed = await getPool().query(
    `UPDATE subscriptions
     SET cancel_notice_sent_at = NOW()
     WHERE user_id = $1
       AND stripe_subscription_id = $2
       AND cancel_notice_sent_at IS NULL`,
    [input.userId, input.stripeSubscriptionId]
  );
  if ((claimed.rowCount ?? 0) === 0) {
    return { sent: false, reason: "already sent" };
  }
  const who = await displayName(input.userId);
  if (!who) {
    await releaseCancelNotice(input.userId, input.stripeSubscriptionId);
    return { sent: false, reason: "no recipient" };
  }
  const endDate =
    input.accessEndsAt == null
      ? null
      : input.accessEndsAt instanceof Date
        ? input.accessEndsAt
        : new Date(input.accessEndsAt);
  const keepsAccess =
    input.keepsAccess ?? Boolean(endDate && endDate.getTime() > Date.now());
  const end = endDate ? formatReceiptDate(endDate) : "now";
  try {
    await sendTemplateEmail(
      who.email,
      "subscription_canceled",
      {
        name: who.name,
        accessEndsAt: end,
        homeUrl: await getAppUrl("/"),
        supportEmail: await supportEmail(),
        billingNote: keepsAccess
          ? `You can keep using Nura until ${end}. The plan will not renew after that.`
          : "Your plan will not renew.",
        keepsAccess,
      },
      { dedupKey: dedup }
    );
  } catch (err) {
    await releaseCancelNotice(input.userId, input.stripeSubscriptionId);
    throw err;
  }
  return { sent: true };
}

async function releaseCancelNotice(
  userId: string,
  stripeSubscriptionId: string
): Promise<void> {
  await getPool().query(
    `UPDATE subscriptions SET cancel_notice_sent_at = NULL
     WHERE user_id = $1 AND stripe_subscription_id = $2`,
    [userId, stripeSubscriptionId]
  );
}

/** A renewed plan can cancel again later, so the last notice must not stick. */
export async function clearSubscriptionCancelNotice(
  userId: string,
  stripeSubscriptionId: string
): Promise<void> {
  await getPool().query(
    `UPDATE subscriptions SET cancel_notice_sent_at = NULL
     WHERE user_id = $1 AND stripe_subscription_id = $2`,
    [userId, stripeSubscriptionId]
  );
  await getPool().query(
    `DELETE FROM email_events WHERE dedup_key = $1`,
    [`subscription_canceled:${stripeSubscriptionId}`]
  );
  await clearSubscriptionCancelScheduledActivity(stripeSubscriptionId);
}

export async function sendDueTrialChargeReminders(
  now: Date = new Date()
): Promise<{ scanned: number; sent: number }> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    user_id: string;
    stripe_subscription_id: string;
    plan: string;
    amount_cents: number;
    currency: string | null;
    trial_ends_at: Date;
    stripe_livemode: boolean | null;
  }>(
    `SELECT user_id, stripe_subscription_id, plan, amount_cents, currency,
            trial_ends_at, stripe_livemode
     FROM subscriptions
     WHERE status = 'trialing'
       AND trial_reminder_sent_at IS NULL
       AND trial_ends_at IS NOT NULL
       AND stripe_livemode IS TRUE
       AND trial_ends_at > $1
       AND trial_ends_at <= $2`,
    [now, new Date(now.getTime() + 2 * MS_DAY)]
  );

  let sent = 0;
  for (const row of rows) {
    if (!isTrialReminderDue(new Date(row.trial_ends_at), now)) continue;
    const who = await displayName(row.user_id);
    if (!who || !row.stripe_subscription_id) continue;
    const dedup = `trial_charge_reminder:${row.stripe_subscription_id}`;
    if (await hasSentEmailDedup(dedup)) {
      await getPool().query(
        `UPDATE subscriptions SET trial_reminder_sent_at = NOW()
         WHERE user_id = $1 AND trial_reminder_sent_at IS NULL`,
        [row.user_id]
      );
      continue;
    }
    try {
      await sendTemplateEmail(
        who.email,
        "trial_charge_reminder",
        {
          name: who.name,
          planLabel: receiptPlanLabel(row.plan),
          amount: formatReceiptAmount(row.amount_cents, row.currency),
          chargeDate: formatReceiptDate(new Date(row.trial_ends_at)),
          manageBillingUrl: await getAppUrl("/app/billing/manage"),
        },
        { dedupKey: dedup }
      );
      await getPool().query(
        `UPDATE subscriptions SET trial_reminder_sent_at = NOW() WHERE user_id = $1`,
        [row.user_id]
      );
      sent += 1;
    } catch (err) {
      console.error("[email] trial reminder failed", row.user_id, err);
    }
  }
  return { scanned: rows.length, sent };
}

/**
 * One review request after the trial. The delay is the template's, so Admin →
 * Email can move it from the shipped month to something else without a deploy.
 * Skips members with no real sessions and anyone who already submitted
 * feedback.
 */
export async function sendDueTrialFeedbackEmails(
  now: Date = new Date()
): Promise<{ enabled: boolean; scanned: number; sent: number; skipped: number }> {
  await ensureSchemaReady();

  const template = await getEmailTemplateAutomation("trial_feedback");
  if (!template.enabled) {
    return { enabled: false, scanned: 0, sent: 0, skipped: 0 };
  }

  const { ensureFeedbackSchema, userHasSubmittedFeedback } = await import(
    "@/lib/feedback-db"
  );
  const { userHasQualifyingSession } = await import("@/lib/feedback-db");
  await ensureFeedbackSchema();

  const delayHours = Math.max(0, template.delayHours ?? 30 * 24);
  const dueBefore = new Date(now.getTime() - delayHours * MS_HOUR);
  const windowStart = new Date(dueBefore.getTime() - REVIEW_CATCHUP_DAYS * MS_DAY);
  const { rows } = await getPool().query<{
    user_id: string;
    stripe_subscription_id: string;
  }>(
    `SELECT user_id, stripe_subscription_id
     FROM subscriptions
     WHERE trial_ends_at IS NOT NULL
       AND trial_ends_at <= $1
       AND trial_ends_at >= $2
       AND trial_feedback_sent_at IS NULL
       AND stripe_livemode IS TRUE`,
    [dueBefore, windowStart]
  );

  let sent = 0;
  let skipped = 0;
  for (const row of rows) {
    const markSent = async () => {
      await getPool().query(
        `UPDATE subscriptions SET trial_feedback_sent_at = NOW() WHERE user_id = $1`,
        [row.user_id]
      );
    };

    const who = await displayName(row.user_id);
    if (!who?.email || !row.stripe_subscription_id) {
      skipped += 1;
      await markSent();
      continue;
    }

    const [hasSession, submitted] = await Promise.all([
      userHasQualifyingSession(row.user_id),
      userHasSubmittedFeedback(row.user_id),
    ]);
    if (!hasSession || submitted) {
      skipped += 1;
      await markSent();
      continue;
    }

    const dedup = `trial_feedback:${row.stripe_subscription_id}`;
    if (await hasSentEmailDedup(dedup)) {
      await markSent();
      continue;
    }

    try {
      const feedbackUrl = await getAppUrl("/app/feedback?source=review");
      await sendTemplateEmail(
        who.email,
        "trial_feedback",
        {
          name: who.name,
          feedbackUrl,
        },
        { dedupKey: dedup }
      );
      await markSent();
      sent += 1;
    } catch (err) {
      console.error("[email] trial feedback failed", row.user_id, err);
    }
  }
  return { enabled: true, scanned: rows.length, sent, skipped };
}
