import type { ProtocolPhase, ThreadPhaseChange } from "./types";

/**
 * Phase badges in the guided chat transcript: a quiet centred pill each time
 * the protocol phase changes, so the conversation reads as a phase timeline.
 *
 * Messages carry no phase, so the server records each change in
 * thread_phase_changes (anchored to the latest message at that moment) and
 * returns it with the thread, so every device shows the same timeline.
 * Threads from before that table have no rows: every session opens in intake,
 * and the current phase is shown just before the latest guide message.
 */
export type PhaseMarker = {
  phase: ProtocolPhase;
  /** Message the phase began after; null = before the first message. */
  afterId: string | null;
  /** Message count when it changed; used if `afterId` is no longer in the list. */
  index?: number;
};

/** Server writes a row only when the phase really changes. */
export function shouldRecordPhaseChange(prev: ProtocolPhase | undefined | null, next: ProtocolPhase): boolean {
  return Boolean(next) && prev !== next;
}

/** Server rows (oldest first) to badge markers. */
export function markersFromPhaseChanges(changes: ThreadPhaseChange[] | undefined | null): PhaseMarker[] {
  return (changes ?? []).map((c) => ({ phase: c.phase, afterId: c.afterMessageId, index: c.messageIndex }));
}

export type TimelineMessage = { id: string; role: "agent" | "user" };

export type PhaseBadges = {
  /** Badges to render before messages[index]. */
  before: Map<number, ProtocolPhase[]>;
  /** Badges after the last message. */
  end: ProtocolPhase[];
};

/**
 * Where a phase that starts now begins: before the latest guide message when
 * it closes the list (the reply that came with the change), else at the end.
 */
export function phaseAnchor(messages: TimelineMessage[]): string | null {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  if (last.role === "agent") {
    return messages.length > 1 ? messages[messages.length - 2].id : null;
  }
  return last.id;
}

function insertIndex(messages: TimelineMessage[], afterId: string | null): number {
  if (afterId === null) return 0;
  const i = messages.findIndex((m) => m.id === afterId);
  return i < 0 ? -1 : i + 1;
}

export function phaseBadges(
  messages: TimelineMessage[],
  current: ProtocolPhase,
  stored: PhaseMarker[] = [],
): PhaseBadges {
  const before = new Map<number, ProtocolPhase[]>();
  const end: ProtocolPhase[] = [];
  if (messages.length === 0) return { before, end };

  const placed: { index: number; phase: ProtocolPhase }[] = [];
  for (const m of stored) {
    let index = insertIndex(messages, m.afterId);
    if (index < 0 && typeof m.index === "number") index = Math.min(Math.max(0, m.index), messages.length);
    if (index >= 0) placed.push({ index, phase: m.phase });
  }
  // Stable: rows at the same spot keep their recorded order.
  placed.sort((a, b) => a.index - b.index);
  // Every session opens in intake.
  if (placed[0]?.index !== 0) placed.unshift({ index: 0, phase: "intake" });
  // The current phase must show; derive where it began if never recorded.
  if (placed[placed.length - 1].phase !== current) {
    const at = insertIndex(messages, phaseAnchor(messages));
    const lastIndex = placed[placed.length - 1].index;
    placed.push({ index: Math.max(at, lastIndex), phase: current });
  }

  let prev: ProtocolPhase | null = null;
  for (const { index, phase } of placed) {
    if (phase === prev) continue;
    prev = phase;
    if (index >= messages.length) end.push(phase);
    else before.set(index, [...(before.get(index) ?? []), phase]);
  }
  return { before, end };
}
