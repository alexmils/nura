"use client";

import { useMemo } from "react";
import type { Message, ProtocolPhase, ThreadPhaseChange } from "@/lib/types";
import { markersFromPhaseChanges, phaseBadges, type PhaseBadges } from "@/lib/phase-timeline";

/**
 * Phase badges for the guided transcript, from the server-recorded phase
 * changes (same on every device). Threads without rows fall back to the
 * opening badge plus the current phase (see lib/phase-timeline).
 */
export function usePhaseTimeline(
  messages: Message[],
  phase: ProtocolPhase,
  phaseChanges?: ThreadPhaseChange[] | null,
): PhaseBadges {
  return useMemo(
    () => phaseBadges(messages, phase, markersFromPhaseChanges(phaseChanges)),
    [messages, phase, phaseChanges],
  );
}
