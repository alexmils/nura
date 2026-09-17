"use client";

import type { ProtocolPhase } from "@/lib/types";
import type { SessionMode } from "@/lib/protocol";
import { PHASE_LABELS, SESSION_MODE_LABELS } from "@/lib/session-labels";

type SessionStatusBarProps = {
  phase: ProtocolPhase;
  mode: SessionMode;
  suds?: number;
  voc?: number;
  target?: string;
  compact?: boolean;
};

export function SessionStatusBar({
  phase,
  mode,
  suds,
  voc,
  target,
  compact = false,
}: SessionStatusBarProps) {
  return (
    <div
      className={`session-status ${compact ? "session-status--compact" : ""}`}
      aria-live="polite"
    >
      {/* Chips stay on one line; the target reads as a caption underneath. */}
      <div className="session-status-chips">
        <span
          className={`session-status-chip session-status-chip--mode session-status-chip--${mode}`}
        >
          {SESSION_MODE_LABELS[mode]}
        </span>
        <span className="session-status-chip session-status-chip--phase">
          {PHASE_LABELS[phase]}
        </span>
        {suds != null && (
          <span
            className="session-status-chip"
            title="Subjective Units of Disturbance"
          >
            SUDs {suds}
          </span>
        )}
        {voc != null && (
          <span className="session-status-chip" title="Validity of Cognition">
            VoC {voc}
          </span>
        )}
      </div>
      {target && !compact && (
        <span className="session-status-target" title={target}>
          {target}
        </span>
      )}
    </div>
  );
}
