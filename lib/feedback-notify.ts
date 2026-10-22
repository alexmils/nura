/**
 * Mail to the operator when a member leaves feedback or a review.
 *
 * Private feedback and public reviews both land in Admin → Feedback, so both
 * use the same notice; the kind and the score say which one it is. A failure
 * here must never fail the member's submit — the row is already stored.
 */

import { getPool } from "@/lib/db";
import { sendTemplateEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/email/templates";
import { feedbackSourceLabel } from "@/lib/feedback";
import { getPlatformSettings } from "@/lib/platform-settings";

export type FeedbackNotice = {
  id: string;
  score: number;
  comment: string | null;
  source: string;
  kind: "feedback" | "review";
  userEmail?: string | null;
  userName?: string | null;
};

export async function notifyAdminsOfFeedback(input: {
  feedback: FeedbackNotice;
  user?: { name?: string | null; email?: string | null } | null;
}): Promise<void> {
  const platform = await getPlatformSettings();
  const { rows } = await getPool().query<{ email: string }>(
    `SELECT email FROM users
     WHERE role IN ('platform_admin','support') AND status = 'active'`
  );
  const recipients = new Set(
    rows
      .map((row) => row.email.trim().toLowerCase())
      // Seeded local admins are not real inboxes.
      .filter((email) => email && !email.endsWith(".local"))
  );
  const support = platform.supportEmail?.trim().toLowerCase();
  if (support && !support.endsWith(".local")) recipients.add(support);
  if (!recipients.size) return;

  const item = input.feedback;
  const name =
    input.user?.name?.trim() ||
    item.userName?.trim() ||
    input.user?.email ||
    item.userEmail ||
    "A member";
  const email = input.user?.email?.trim() || item.userEmail || "";
  const kindLabel = item.kind === "review" ? "review" : "feedback";
  const adminFeedbackUrl = await getAppUrl(
    `/admin/feedback?id=${encodeURIComponent(item.id)}`
  );

  for (const to of recipients) {
    try {
      await sendTemplateEmail(to, "admin_feedback", {
        customerName: name,
        customerEmail: email,
        score: `${item.score}/10`,
        kindLabel,
        source: feedbackSourceLabel(item.source),
        comment: item.comment ?? "",
        adminFeedbackUrl,
      });
    } catch (err) {
      console.error("[feedback/notify]", to, err);
    }
  }
}
