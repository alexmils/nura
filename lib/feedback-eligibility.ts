import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  FEEDBACK_DAYS_ELAPSED,
  accountAgeEligible,
  type FeedbackSource,
} from "@/lib/feedback";

/** At least one real session (mode chosen or user wrote in chat). */
export async function userHasQualifyingSession(
  userId: string
): Promise<boolean> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM threads t
       WHERE t.user_id = $1
         AND (
           t.mode IN ('guided', 'free')
           OR EXISTS (
             SELECT 1 FROM messages m
             WHERE m.thread_id = t.id AND m.role = 'user'
           )
         )
     ) AS ok`,
    [userId]
  );
  return Boolean(rows[0]?.ok);
}

export type FeedbackPageEligibility = {
  submitted: boolean;
  canSubmit: boolean;
  hasQualifyingSession: boolean;
  accountAgeOk: boolean;
  reason: "ok" | "already_submitted" | "no_sessions" | "account_too_new";
};

export function canSubmitFeedback(input: {
  hasResponse: boolean;
  hasQualifyingSession: boolean;
  userCreatedAt: string;
  allowTrialLink: boolean;
  now?: number;
}): FeedbackPageEligibility {
  if (input.hasResponse) {
    return {
      submitted: true,
      canSubmit: false,
      hasQualifyingSession: input.hasQualifyingSession,
      accountAgeOk: accountAgeEligible(
        input.userCreatedAt,
        FEEDBACK_DAYS_ELAPSED,
        input.now
      ),
      reason: "already_submitted",
    };
  }
  if (!input.hasQualifyingSession) {
    return {
      submitted: false,
      canSubmit: false,
      hasQualifyingSession: false,
      accountAgeOk: accountAgeEligible(
        input.userCreatedAt,
        FEEDBACK_DAYS_ELAPSED,
        input.now
      ),
      reason: "no_sessions",
    };
  }
  const accountAgeOk = accountAgeEligible(
    input.userCreatedAt,
    FEEDBACK_DAYS_ELAPSED,
    input.now
  );
  if (!accountAgeOk && !input.allowTrialLink) {
    return {
      submitted: false,
      canSubmit: false,
      hasQualifyingSession: true,
      accountAgeOk: false,
      reason: "account_too_new",
    };
  }
  return {
    submitted: false,
    canSubmit: true,
    hasQualifyingSession: true,
    accountAgeOk: accountAgeOk || input.allowTrialLink,
    reason: "ok",
  };
}

export function parseFeedbackSubmitSource(
  value: unknown
): FeedbackSource | null {
  if (
    value === "session_end" ||
    value === "days_elapsed" ||
    value === "forced" ||
    value === "trial_end_email" ||
    value === "page"
  ) {
    return value;
  }
  if (value === "trial") return "trial_end_email";
  return null;
}
