/** Self-service password reset requests from the signed-in app. */

/** How long to wait between reset emails for the same account. */
export const RESET_EMAIL_THROTTLE_SECONDS = 60;

export const RESET_EMAIL_SENT =
  "Reset link sent to your email. It expires in 1 hour.";

export const RESET_EMAIL_ALREADY_SENT =
  "A reset link was just sent. Check your email, or try again in a minute.";

export const RESET_EMAIL_FAILED =
  "Could not send the reset email. Try again later.";

/** True when a usable reset link was requested too recently to send another. */
export function resetEmailThrottled(
  lastRequestAt: string | null | undefined,
  now: Date = new Date(),
  windowSeconds: number = RESET_EMAIL_THROTTLE_SECONDS
): boolean {
  if (!lastRequestAt) return false;
  const last = new Date(lastRequestAt).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < windowSeconds * 1000;
}
