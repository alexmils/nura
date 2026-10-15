/** Private NPS feedback — product only, never public Stories. */

export const FEEDBACK_SNOOZE_DAYS = 7;
export const FEEDBACK_DAYS_ELAPSED = 4;
/** Earliest day count before a post-session NPS prompt (avoids onboarding / guide). */
export const FEEDBACK_SESSION_END_MIN_DAYS = 1;
export const FEEDBACK_SCORE_MIN = 1;
export const FEEDBACK_SCORE_MAX = 10;

/** CSS selector for an active immersive set — class is on `.app-shell`, not body. */
export const FEEDBACK_IMMERSIVE_SELECTOR = ".app-shell.session-immersive";

export type FeedbackSource = "session_end" | "days_elapsed" | "forced";

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
  now?: number;
}): FeedbackSource {
  if (input.forceShow) return "forced";
  if (input.pendingSource === "session_end") return "session_end";
  if (
    accountAgeEligible(input.userCreatedAt, FEEDBACK_DAYS_ELAPSED, input.now)
  ) {
    return "days_elapsed";
  }
  if (input.pendingSource === "days_elapsed") return "days_elapsed";
  return "days_elapsed";
}

/**
 * Pure eligibility for the soft NPS popup.
 * Force overrides prior submit + snooze (demo / support).
 */
export function shouldOfferPrompt(input: {
  hasResponse: boolean;
  forceShow: boolean;
  snoozeUntil: string | null;
  pendingSource: FeedbackSource | null;
  userCreatedAt: string;
  now?: number;
}): { show: boolean; source: FeedbackSource | null } {
  const now = input.now ?? Date.now();

  if (input.forceShow) {
    return { show: true, source: "forced" };
  }

  if (input.hasResponse) {
    return { show: false, source: null };
  }

  if (isSnoozeActive(input.snoozeUntil, now)) {
    return { show: false, source: null };
  }

  if (input.pendingSource === "session_end") {
    if (
      !accountAgeEligible(
        input.userCreatedAt,
        FEEDBACK_SESSION_END_MIN_DAYS,
        now
      )
    ) {
      return { show: false, source: null };
    }
    return { show: true, source: "session_end" };
  }

  if (accountAgeEligible(input.userCreatedAt, FEEDBACK_DAYS_ELAPSED, now)) {
    return { show: true, source: "days_elapsed" };
  }

  if (input.pendingSource === "days_elapsed") {
    return { show: true, source: "days_elapsed" };
  }

  return { show: false, source: null };
}
