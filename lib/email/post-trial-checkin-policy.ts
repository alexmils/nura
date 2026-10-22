/**
 * The schedule rule for the post-trial check-in, kept pure so it can be tested
 * without a database or an email provider.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * How long after the trial ends a first app visit still counts as "just
 * converted". Without this, deploying the feature would anchor every paying
 * member whose trial ended months ago and mail the whole base.
 */
export const POST_TRIAL_ANCHOR_WINDOW_DAYS = 30;

export function isWithinPostTrialAnchorWindow(
  trialEndsAt: Date,
  now: Date = new Date()
): boolean {
  const ended = trialEndsAt.getTime();
  return (
    ended < now.getTime() &&
    now.getTime() - ended <= POST_TRIAL_ANCHOR_WINDOW_DAYS * DAY
  );
}

export function isPostTrialCheckinDue(
  seenAt: Date,
  delayHours: number,
  now: Date = new Date()
): boolean {
  if (!Number.isFinite(delayHours) || delayHours < 0) return false;
  return now.getTime() >= seenAt.getTime() + delayHours * HOUR;
}
