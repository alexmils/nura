import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  formatCancelReasonSummary,
  labelForCancelReason,
  type SubscriptionCancelReasonId,
} from "@/lib/subscription-cancel-reasons";

export type SubscriptionCancelFeedbackRow = {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  reasonIds: string[];
  comment: string | null;
  createdAt: string;
};

export async function saveSubscriptionCancelFeedback(input: {
  userId: string;
  stripeSubscriptionId: string | null;
  reasonIds: SubscriptionCancelReasonId[];
  comment?: string | null;
}): Promise<string> {
  await ensureSchemaReady();
  const id = crypto.randomUUID();
  await getPool().query(
    `INSERT INTO subscription_cancel_feedback (
       id, user_id, stripe_subscription_id, reason_ids, comment, created_at
     ) VALUES ($1,$2,$3,$4,$5,NOW())`,
    [
      id,
      input.userId,
      input.stripeSubscriptionId,
      input.reasonIds,
      input.comment?.trim() || null,
    ]
  );
  return id;
}

export async function getLatestCancelFeedbackForUser(
  userId: string
): Promise<SubscriptionCancelFeedbackRow | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    id: string;
    user_id: string;
    stripe_subscription_id: string | null;
    reason_ids: string[];
    comment: string | null;
    created_at: string;
  }>(
    `SELECT id, user_id, stripe_subscription_id, reason_ids, comment, created_at
     FROM subscription_cancel_feedback
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    reasonIds: row.reason_ids ?? [],
    comment: row.comment,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function describeCancelFeedback(row: SubscriptionCancelFeedbackRow): {
  summary: string;
  labels: string[];
} {
  const labels = row.reasonIds.map((id) => labelForCancelReason(id));
  const summary = formatCancelReasonSummary(row.reasonIds, row.comment);
  return { summary, labels };
}

export function billingEventDescriptionWithReasons(
  accessEndsAtIso: string | null,
  reasonSummary: string | null
): string | null {
  const end = accessEndsAtIso?.trim() || "";
  const reasons = reasonSummary?.trim() || "";
  if (end && reasons) return `${end}::${reasons}`;
  if (end) return end;
  if (reasons) return `::${reasons}`;
  return null;
}

export function parseBillingEventDescription(description: string | null): {
  accessEndsAt: string | null;
  reasonSummary: string | null;
} {
  if (!description?.trim()) {
    return { accessEndsAt: null, reasonSummary: null };
  }
  const idx = description.indexOf("::");
  if (idx === -1) {
    return { accessEndsAt: description, reasonSummary: null };
  }
  const end = description.slice(0, idx).trim();
  const reasons = description.slice(idx + 2).trim();
  return {
    accessEndsAt: end || null,
    reasonSummary: reasons || null,
  };
}
