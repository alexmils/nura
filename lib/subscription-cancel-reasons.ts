/** Preset reasons when someone schedules cancel at period end. */

export const SUBSCRIPTION_CANCEL_REASONS = [
  { id: "too_expensive", label: "Too expensive" },
  { id: "not_using", label: "Not using it enough" },
  { id: "missing_feature", label: "Missing a feature I need" },
  { id: "technical", label: "Bugs or technical trouble" },
  { id: "other_tool", label: "Using something else" },
  { id: "done_for_now", label: "Done for now" },
  { id: "other", label: "Something else" },
] as const;

export type SubscriptionCancelReasonId =
  (typeof SUBSCRIPTION_CANCEL_REASONS)[number]["id"];

const REASON_IDS = new Set<string>(
  SUBSCRIPTION_CANCEL_REASONS.map((r) => r.id)
);

export function isSubscriptionCancelReasonId(
  value: string
): value is SubscriptionCancelReasonId {
  return REASON_IDS.has(value);
}

export function labelForCancelReason(id: string): string {
  const row = SUBSCRIPTION_CANCEL_REASONS.find((r) => r.id === id);
  return row?.label ?? id;
}

export function formatCancelReasonSummary(
  reasonIds: string[],
  comment?: string | null
): string {
  const labels = reasonIds
    .map((id) => labelForCancelReason(id))
    .filter(Boolean);
  const trimmed = comment?.trim();
  if (trimmed) labels.push(trimmed);
  return labels.join("; ");
}

export function parseCancelFeedbackBody(body: unknown): {
  reasonIds: SubscriptionCancelReasonId[];
  comment: string | null;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid body");
  }
  const raw = body as { reasons?: unknown; comment?: unknown };
  if (!Array.isArray(raw.reasons) || raw.reasons.length === 0) {
    throw new Error("Pick at least one reason");
  }
  const reasonIds: SubscriptionCancelReasonId[] = [];
  for (const item of raw.reasons) {
    if (typeof item !== "string" || !isSubscriptionCancelReasonId(item)) {
      throw new Error("Invalid reason");
    }
    if (!reasonIds.includes(item)) reasonIds.push(item);
  }
  if (reasonIds.length > 1) {
    throw new Error("Pick one reason only");
  }
  let comment: string | null = null;
  if (raw.comment !== undefined && raw.comment !== null) {
    if (typeof raw.comment !== "string") throw new Error("Invalid comment");
    comment = raw.comment.trim().slice(0, 500) || null;
  }
  if (reasonIds.includes("other") && !comment) {
    throw new Error("Tell us a little more for Something else");
  }
  return { reasonIds, comment };
}
