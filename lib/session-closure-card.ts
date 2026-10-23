import type { Thread } from "./types";

export type ClosureCardData = {
  target: string | null;
  sudsStart: number | null;
  sudsEnd: number | null;
  vocStart: number | null;
  vocEnd: number | null;
  setsDone: number;
  /** True when the target was fully processed (SUDs 0-1, and VoC 6+ if rated). */
  complete: boolean;
  headline: string;
  nextStep: string;
  ctaLabel: string;
};

/**
 * Data for the end-of-session card. Pure so tests can pin the copy rules.
 * Start values come from `baselineSuds` / `baselineVoc`, end values from the
 * latest `suds` / `voc` on the thread.
 */
export function closureCardData(
  thread: Pick<
    Thread,
    "target" | "suds" | "voc" | "baselineSuds" | "baselineVoc" | "setCount" | "incomplete"
  >
): ClosureCardData {
  const setsDone = Math.max(0, thread.setCount ?? 0);
  const sudsEnd = thread.suds ?? null;
  const sudsStart = thread.baselineSuds ?? sudsEnd;
  const vocEnd = thread.voc ?? null;
  const vocStart = thread.baselineVoc ?? vocEnd;
  const sudsDone = sudsEnd != null && sudsEnd <= 1;
  const vocDone = vocEnd == null || vocEnd >= 6;
  const complete = setsDone > 0 && sudsDone && vocDone;

  let headline: string;
  let nextStep: string;
  if (setsDone === 0) {
    headline = "Session closed";
    nextStep =
      "We did the groundwork today. Next time we pick up the target and start the first set.";
  } else if (complete) {
    headline = "Well done. This target has settled.";
    nextStep =
      "Come back in about a week. We'll check what changed, then choose the next target.";
  } else {
    headline = "Good work. You can safely pause here.";
    nextStep =
      "This target isn't finished yet. Come back within a few days to continue where we left off. Use your safe place or the butterfly hug if anything stirs.";
  }

  return {
    target: thread.target?.trim() || null,
    sudsStart,
    sudsEnd,
    vocStart,
    vocEnd,
    setsDone,
    complete,
    headline,
    nextStep,
    ctaLabel: setsDone > 0 && !complete ? "Continue in a new session" : "Start next session",
  };
}

/** "6 -> 1" style change line, or null when nothing was rated. */
export function changeLabel(start: number | null, end: number | null): string | null {
  if (start == null && end == null) return null;
  if (start == null || start === end) return String(end);
  return `${start} \u2192 ${end ?? "?"}`;
}
