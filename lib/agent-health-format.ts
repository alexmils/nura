/**
 * Guided-session health for admin screens: sets per thread, threads that stall
 * without a set, and how often the session interpreter fails. Pure + client-safe.
 */

/** A guided thread with this many messages and no completed set is flagged. */
export const STUCK_MESSAGE_THRESHOLD = 30;

/** Old interpreter cap: replies at ~512 output tokens were cut off JSON. */
const LEGACY_CAP_MIN = 505;
const LEGACY_CAP_MAX = 512;

export type AgentThreadHealth = {
  threadId: string;
  title: string;
  phase: string;
  messageCount: number;
  setCount: number;
  createdAt: string;
  lastMessageAt: string | null;
  /** 30+ messages and no completed set: the person never got the ball. */
  stuck: boolean;
  userEmail?: string;
  userId?: string;
};

export type InterpreterHealth = {
  calls: number;
  ok: number;
  cutoff: number;
  unparsed: number;
  /** Pre-fix rows (purpose "interpreter") that ended at the old 512 cap. */
  legacyCapHits: number;
  /** (cutoff + unparsed + legacyCapHits) / calls, 0..1; null when no calls. */
  failureRate: number | null;
};

export function isStuckThread(t: {
  mode?: string;
  messageCount: number;
  setCount: number;
}): boolean {
  return (
    (t.mode ?? "guided") === "guided" &&
    t.messageCount >= STUCK_MESSAGE_THRESHOLD &&
    t.setCount === 0
  );
}

/**
 * Rows grouped by (purpose, completion_tokens bucket). `atLegacyCap` marks
 * rows whose completion_tokens landed on the old 512-token cap.
 */
export function summarizeInterpreterHealth(
  rows: { purpose: string; atLegacyCap?: boolean; count: number }[]
): InterpreterHealth {
  const out: InterpreterHealth = {
    calls: 0,
    ok: 0,
    cutoff: 0,
    unparsed: 0,
    legacyCapHits: 0,
    failureRate: null,
  };
  for (const r of rows) {
    const n = Math.max(0, Number(r.count) || 0);
    if (r.purpose === "interpreter") {
      out.calls += n;
      if (r.atLegacyCap) out.legacyCapHits += n;
      else out.ok += n;
    } else if (r.purpose === "interpreter_cutoff") {
      out.calls += n;
      out.cutoff += n;
    } else if (r.purpose === "interpreter_unparsed") {
      out.calls += n;
      out.unparsed += n;
    }
  }
  if (out.calls > 0) {
    out.failureRate = (out.cutoff + out.unparsed + out.legacyCapHits) / out.calls;
  }
  return out;
}

export function legacyCapBounds(): [number, number] {
  return [LEGACY_CAP_MIN, LEGACY_CAP_MAX];
}

export function formatRate(rate: number | null): string {
  if (rate == null) return "\u2013";
  return `${Math.round(rate * 100)}%`;
}

export function setsPerThreadSummary(threads: { setCount: number }[]): {
  threads: number;
  withSets: number;
  avgSets: number | null;
} {
  const n = threads.length;
  const withSets = threads.filter((t) => t.setCount > 0).length;
  const total = threads.reduce((s, t) => s + Math.max(0, t.setCount), 0);
  return { threads: n, withSets, avgSets: n ? Math.round((total / n) * 10) / 10 : null };
}
