/**
 * "Wait for the person to finish" before the guide answers (typed guided chat).
 *
 * People often split one thought over 2-3 Enters. Each message shows up in the
 * chat at once, but the guide is only asked after a short quiet window, and
 * everything sent in that window goes as ONE turn (one request, one reply).
 * Typing in the composer keeps the window open, up to a hard cap so a reply
 * never hangs. Crisis words, quick replies, set/check-in flows and Voice Mode
 * skip the wait.
 *
 * No React / DOM / fetch here so node tests can pin the timing.
 */
import { isCrisisText } from "@/lib/crisis-detect";

/** Quiet time after the last sent message before the guide is asked. */
export const REPLY_QUIET_MS = 2500;
/** A keystroke this recent still counts as "still typing". */
export const REPLY_TYPING_GRACE_MS = 1500;
/** Never hold a batch longer than this after the last sent message. */
export const REPLY_MAX_WAIT_MS = 20_000;

/**
 * Crisis words in any supported language (lib/crisis-detect.ts: EN/DE/ES/IT/
 * FR/PT/NL/PL/SR, figures of speech excluded) never wait on the client.
 */
export function isRiskText(text: string): boolean {
  return isCrisisText(text);
}

export type ReplyWaitState = {
  /** When the newest pending message was sent (null: nothing pending). */
  lastSendAt: number | null;
  /** Last composer keystroke. */
  lastKeyAt: number | null;
  /** Composer currently has text in it. */
  draftNonEmpty: boolean;
};

/** Epoch ms when the pending batch should go to the guide, or null. */
export function replyDueAt(s: ReplyWaitState): number | null {
  if (s.lastSendAt == null) return null;
  const cap = s.lastSendAt + REPLY_MAX_WAIT_MS;
  if (s.draftNonEmpty) return cap;
  let due = s.lastSendAt + REPLY_QUIET_MS;
  if (s.lastKeyAt != null && s.lastKeyAt > s.lastSendAt) {
    due = Math.max(due, s.lastKeyAt + REPLY_TYPING_GRACE_MS);
  }
  return Math.min(due, cap);
}

export type ReplySendOptions = {
  /** Quick replies, set / check-in flows: answer now. */
  immediate?: boolean;
  /** Voice Mode keeps its own turn-taking. */
  voice?: boolean;
};

export function shouldReplyImmediately(text: string, opts: ReplySendOptions = {}): boolean {
  return Boolean(opts.immediate || opts.voice || isRiskText(text));
}

export type ReplyBatcherOptions<T> = {
  /** Gets every pending item, oldest first, as one guide turn. */
  onFlush: (items: T[]) => void;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  unschedule?: (handle: unknown) => void;
};

export type ReplyBatcher<T> = {
  /** Queue a sent message; flushes now (with anything pending) if `immediate`. */
  push: (item: T, immediate?: boolean) => void;
  /** Composer changed (keystroke, cleared). */
  noteDraft: (draft: string) => void;
  /** Send whatever is pending now (navigation, unmount, set start). */
  flush: () => void;
  /** Drop pending items without sending (returns them). */
  drain: () => T[];
  pendingCount: () => number;
  dispose: () => void;
};

export function createReplyBatcher<T>(opts: ReplyBatcherOptions<T>): ReplyBatcher<T> {
  const now = opts.now ?? (() => Date.now());
  const schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const unschedule =
    opts.unschedule ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let pending: T[] = [];
  const state: ReplyWaitState = { lastSendAt: null, lastKeyAt: null, draftNonEmpty: false };
  let handle: unknown = null;

  const clearTimer = () => {
    if (handle != null) unschedule(handle);
    handle = null;
  };

  const flush = () => {
    clearTimer();
    if (pending.length === 0) return;
    const items = pending;
    pending = [];
    state.lastSendAt = null;
    opts.onFlush(items);
  };

  const arm = () => {
    clearTimer();
    const due = replyDueAt(state);
    if (due == null) return;
    const wait = due - now();
    if (wait <= 0) {
      flush();
      return;
    }
    handle = schedule(() => {
      handle = null;
      // Re-check: the state may have moved while the timer was pending.
      const d = replyDueAt(state);
      if (d != null && d - now() > 0) arm();
      else flush();
    }, wait);
  };

  return {
    push(item, immediate = false) {
      pending.push(item);
      state.lastSendAt = now();
      // Sending clears the composer.
      state.draftNonEmpty = false;
      if (immediate) flush();
      else arm();
    },
    noteDraft(draft) {
      state.lastKeyAt = now();
      state.draftNonEmpty = draft.trim().length > 0;
      if (pending.length > 0) arm();
    },
    flush,
    drain() {
      clearTimer();
      const items = pending;
      pending = [];
      state.lastSendAt = null;
      return items;
    },
    pendingCount: () => pending.length,
    dispose: clearTimer,
  };
}
/** Most messages one batched turn may carry (a guard, not a UX limit). */
export const MAX_BATCHED_USER_MESSAGES = 12;

/**
 * Server side of a batched turn: `userMessages` (array) wins over the legacy
 * single `userMessage`. Trimmed, empties dropped, order kept.
 */
export function normalizeUserBatch(userMessages: unknown, userMessage: unknown): string[] {
  const raw = Array.isArray(userMessages) ? userMessages : [userMessage];
  return raw
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .slice(0, MAX_BATCHED_USER_MESSAGES);
}

/** The whole turn as one text, for the interpreter, language and safety checks. */
export function batchTurnText(batch: string[]): string | undefined {
  return batch.length > 0 ? batch.join("\n") : undefined;
}
