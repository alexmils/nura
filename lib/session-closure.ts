import type { ProtocolPhase, Thread } from "@/lib/types";

/** Phases where stopping mid-work risks incomplete processing. */
export const CLOSURE_REQUIRED_PHASES: ProtocolPhase[] = [
  "desensitization",
  "installation",
  "body_scan",
];

export function phaseNeedsClosureGate(phase: ProtocolPhase): boolean {
  return CLOSURE_REQUIRED_PHASES.includes(phase);
}

type ThreadGate = Pick<
  Thread,
  "mode" | "phase" | "incomplete" | "intakeComplete"
>;

/**
 * True when leaving the session should prompt containment / closure first.
 * Empty tabs (pending, or intake with no user reply) do not prompt.
 * Self-guided never prompts — user runs their own sets.
 */
export function shouldPromptSessionClosure(opts: {
  thread: ThreadGate | null | undefined;
  setRunning?: boolean;
  hasUserMessage?: boolean;
}): boolean {
  const { thread, setRunning, hasUserMessage = false } = opts;
  if (!thread || thread.mode === "pending" || thread.mode === "free") {
    return false;
  }
  if (setRunning) return true;
  if (phaseNeedsClosureGate(thread.phase)) return true;
  if (
    thread.incomplete &&
    hasUserMessage &&
    thread.phase !== "closure"
  ) {
    return true;
  }
  return false;
}

export function shouldOfferResumeClosure(
  thread: Pick<Thread, "mode" | "phase" | "incomplete"> | null | undefined
): boolean {
  if (!thread || thread.mode === "pending" || thread.mode === "free") {
    return false;
  }
  // New threads default incomplete=true in DB — only prompt when left mid-processing.
  return thread.incomplete === true && phaseNeedsClosureGate(thread.phase);
}

/**
 * Unused session chrome: pending picker, or intake with no user message and
 * no Free set started (`intakeComplete` marks Free activity).
 * Safe to delete instead of prompting on leave / refresh.
 */
export function isEmptyDisposableSession(opts: {
  thread: ThreadGate | null | undefined;
  hasUserMessage: boolean;
  setRunning?: boolean;
}): boolean {
  const { thread, hasUserMessage, setRunning } = opts;
  if (!thread || setRunning) return false;
  if (thread.mode === "pending") return true;
  if (hasUserMessage) return false;
  if (thread.intakeComplete) return false;
  if (phaseNeedsClosureGate(thread.phase)) return false;
  if (thread.phase === "closure") return false;
  return thread.phase === "intake";
}
