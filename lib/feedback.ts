/** Private NPS feedback — product only, never public Stories. */

export const FEEDBACK_SNOOZE_DAYS = 7;
/** In-app / organic feedback only after this many days on the account. */
export const FEEDBACK_DAYS_ELAPSED = 4;
export const FEEDBACK_SCORE_MIN = 1;
export const FEEDBACK_SCORE_MAX = 10;

/** CSS selector for an active immersive set — class is on `.app-shell`, not body. */
export const FEEDBACK_IMMERSIVE_SELECTOR = ".app-shell.session-immersive";

export type FeedbackSource =
  | "session_end"
  | "days_elapsed"
  | "forced"
  | "trial_end_email"
  | "review_email"
  | "page";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidFeedbackScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= FEEDBACK_SCORE_MIN &&
    value <= FEEDBACK_SCORE_MAX
  );
}

export function isSnoozeActive(
  snoozeUntil: string | null | undefined,
  now = Date.now()
): boolean {
  if (!snoozeUntil) return false;
  const t = new Date(snoozeUntil).getTime();
  if (Number.isNaN(t)) return false;
  return t > now;
}

export function accountAgeEligible(
  createdAt: string,
  days = FEEDBACK_DAYS_ELAPSED,
  now = Date.now()
): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t >= days * DAY_MS;
}

export function snoozeUntilIso(
  days = FEEDBACK_SNOOZE_DAYS,
  now = Date.now()
): string {
  return new Date(now + days * DAY_MS).toISOString();
}

/**
 * Resolve attribution for a submit from server prompt state (never trust client).
 */
export function resolveFeedbackSubmitSource(input: {
  forceShow: boolean;
  pendingSource: FeedbackSource | null;
  userCreatedAt: string;
  sourceOverride?: FeedbackSource | null;
  now?: number;
}): FeedbackSource {
  if (input.sourceOverride) return input.sourceOverride;
  if (input.forceShow) return "forced";
  if (input.pendingSource === "trial_end_email") return "trial_end_email";
  if (input.pendingSource === "page") return "page";
  if (input.pendingSource === "session_end") return "session_end";
  if (
    accountAgeEligible(input.userCreatedAt, FEEDBACK_DAYS_ELAPSED, input.now)
  ) {
    return "days_elapsed";
  }
  if (input.pendingSource === "days_elapsed") return "days_elapsed";
  return "page";
}

/**
 * In-app popup eligibility (disabled in product UI; trial email + /app/feedback).
 * Force overrides prior submit + snooze (demo / support).
 */
export function shouldOfferPrompt(input: {
  hasResponse: boolean;
  forceShow: boolean;
  snoozeUntil: string | null;
  pendingSource: FeedbackSource | null;
  userCreatedAt: string;
  hasQualifyingSession: boolean;
  now?: number;
}): { show: boolean; source: FeedbackSource | null } {
  const now = input.now ?? Date.now();

  if (input.forceShow) {
    return { show: true, source: "forced" };
  }

  if (input.hasResponse) {
    return { show: false, source: null };
  }

  if (!input.hasQualifyingSession) {
    return { show: false, source: null };
  }

  if (isSnoozeActive(input.snoozeUntil, now)) {
    return { show: false, source: null };
  }

  if (!accountAgeEligible(input.userCreatedAt, FEEDBACK_DAYS_ELAPSED, now)) {
    return { show: false, source: null };
  }

  return { show: false, source: null };
}
