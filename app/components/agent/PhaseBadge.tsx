import type { ProtocolPhase } from "@/lib/types";
import { phaseLabel } from "@/lib/session-labels";
import "./session-flow.css";

/** Quiet centred pill in the transcript where a protocol phase begins. */
export function PhaseBadge({ phase }: { phase: ProtocolPhase }) {
  return (
    <div className="agent-phase-badge" role="note" data-testid="phase-badge" data-phase={phase}>
      <span className="agent-phase-badge-pill">{phaseLabel(phase)}</span>
    </div>
  );
}
