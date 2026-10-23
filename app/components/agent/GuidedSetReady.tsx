"use client";

import { Play } from "lucide-react";
import "./session-flow.css";

/**
 * Under the guided chat, once a target and a SUDs rating are known: a manual
 * "Start set" button (safety net for a missed phase advance). No explanatory
 * hint text. Shown in chat and in Voice Mode.
 */
export function GuidedSetReady({
  onStartSet,
  compact = false,
}: {
  onStartSet?: () => void;
  compact?: boolean;
}) {
  if (!onStartSet) return null;
  return (
    <div
      className={`guided-set-ready${compact ? " guided-set-ready--compact" : ""}`}
      role="status"
      aria-live="polite"
      data-testid="guided-set-ready"
    >
      <button
        type="button"
        className="guided-set-ready-start"
        onClick={onStartSet}
        data-testid="guided-start-set"
      >
        <Play size={16} strokeWidth={2.25} aria-hidden />
        <span>Start set</span>
      </button>
    </div>
  );
}
