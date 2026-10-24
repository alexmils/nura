/**
 * Closed guided session guard for the chat turn route.
 *
 * A guided thread in the `closure` phase is finished: the summary card is on
 * screen and the composer is disabled. Any further turn is refused before the
 * message is saved and before the interpreter, guide model or TTS run, so a
 * stray "bye" (another tab, an old client, voice mode) costs nothing.
 */

export const SESSION_CLOSED_ERROR = "session_closed";
export const SESSION_CLOSED_STATUS = 409;

export function isGuidedSessionClosed(
  thread: { mode: string; phase: string } | null | undefined
): boolean {
  return thread != null && thread.mode === "guided" && thread.phase === "closure";
}

/** JSON body for the 409; carries the thread so the client can sync state. */
export function sessionClosedBody<T>(thread: T): { error: string; thread: T } {
  return { error: SESSION_CLOSED_ERROR, thread };
}

/** Client side: true when a failed chat request was the closed-session refusal. */
export function isSessionClosedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; message?: unknown };
  return e.status === SESSION_CLOSED_STATUS && e.message === SESSION_CLOSED_ERROR;
}