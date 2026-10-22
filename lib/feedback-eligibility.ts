import {
  FEEDBACK_DAYS_ELAPSED,
  accountAgeEligible,
  type FeedbackSource,
} from "@/lib/feedback";

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
    value === "review_email" ||
    value === "page"
  ) {
    return value;
  }
  if (value === "trial") return "trial_end_email";
  if (value === "review") return "review_email";
  return null;
}
