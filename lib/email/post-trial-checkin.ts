/**
 * The one post-trial check-in.
 *
 * Anchor: the first time a member opens the app after their trial date. A
 * cron then sends one email after the configured delay, but only to members
 * who are still paying and still have access.
 *
 * This is a one-time service check-in, not a promotion: it asks how the
 * sessions are going and sells nothing. That is why it does not require the
 * marketing opt-in — the same reason the trial-feedback mail does not. The
 * settings link stays in the footer so the address can be silenced.
 *
 * The anchor is written where app access is checked, not at login: someone
 * already signed in when the trial ended would otherwise never be seen using
 * the app. `post_trial_seen_at` is written once and never moved; the send
 * marker is claimed before the provider call so two overlapping cron runs
 * cannot mail the same person twice.
 */

import { ensureSchemaReady, getPool } from "@/lib/db";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import { getEmailTemplateAutomation } from "@/lib/email-templates-db";
import { formatReceiptDate } from "@/lib/email/purchase-receipt";
import { isPostTrialCheckinDue } from "./post-trial-checkin-policy";

const HOUR = 60 * 60 * 1000;
/** Per run; keeps a first run after a deploy from mailing the whole history. */
const LIMIT = 200;

export { isPostTrialCheckinDue } from "./post-trial-checkin-policy";

export async function sendDuePostTrialCheckinEmails(
  now: Date = new Date()
): Promise<{
  enabled: boolean;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  await ensureSchemaReady();

  const template = await getEmailTemplateAutomation("post_trial_checkin");
  if (!template.enabled) {
    return { enabled: false, scanned: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const delayHours = template.delayHours ?? 0;
  const cutoff = new Date(now.getTime() - delayHours * HOUR);

  const { rows } = await getPool().query<{
    id: string;
    email: string;
    name: string | null;
    post_trial_seen_at: Date;
    trial_ends_at: Date;
  }>(
    `SELECT u.id, u.email, u.name, u.post_trial_seen_at, s.trial_ends_at
     FROM users u
     JOIN subscriptions s ON s.user_id = u.id
     WHERE u.post_trial_seen_at IS NOT NULL
       AND u.post_trial_seen_at <= $1
       AND u.post_trial_email_sent_at IS NULL
       AND u.status = 'active'
       AND TRIM(COALESCE(u.email, '')) <> ''
       AND s.trial_ends_at IS NOT NULL
       AND s.status IN ('active', 'legacy')
     ORDER BY u.post_trial_seen_at ASC
     LIMIT $2`,
    [cutoff, LIMIT]
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const pool = getPool();

  for (const row of rows) {
    if (
      !isPostTrialCheckinDue(
        new Date(row.post_trial_seen_at),
        delayHours,
        now
      )
    ) {
      continue;
    }

    // Claim first: the marker, not the provider response, is what stops a
    // second run from sending while this one is still in flight.
    const claimed = await pool.query(
      `UPDATE users SET post_trial_email_sent_at = NOW()
       WHERE id = $1 AND post_trial_email_sent_at IS NULL`,
      [row.id]
    );
    if ((claimed.rowCount ?? 0) === 0) {
      skipped += 1;
      continue;
    }

    try {
      await sendTemplateEmail(
        row.email,
        "post_trial_checkin",
        {
          name: row.name?.trim() || row.email.split("@")[0] || "there",
          trialEndedOn: formatReceiptDate(new Date(row.trial_ends_at)),
          appUrl: await getAppUrl("/app"),
          preferencesUrl: await getAppUrl("/app/settings"),
        },
        { dedupKey: `post_trial_checkin:${row.id}` }
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      // Release the claim so the next run retries instead of losing the mail.
      await pool
        .query(`UPDATE users SET post_trial_email_sent_at = NULL WHERE id = $1`, [
          row.id,
        ])
        .catch(() => {});
      console.error("[email] post-trial check-in failed", row.id, err);
    }
  }

  return { enabled: true, scanned: rows.length, sent, skipped, failed };
}
