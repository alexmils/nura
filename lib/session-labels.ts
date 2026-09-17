import type { ProtocolPhase } from "./types";
import type { SessionMode } from "./protocol";

export const PHASE_LABELS: Record<ProtocolPhase, string> = {
  intake: "Getting to know you",
  grounding: "Grounding",
  assessment: "Assessment",
  desensitization: "Desensitization",
  installation: "Installation",
  body_scan: "Body scan",
  closure: "Closure",
};

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  idle: "Ready",
  running: "Set running",
  check_in: "Check-in",
};

export function phaseLabel(phase: ProtocolPhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export type QuickReply = { label: string; value: string };

/**
 * Whether the suggested replies belong on screen right now.
 *
 * Topic starters (Anxiety, Stress, A specific memory) only make sense before
 * the person has said anything. Once the conversation is going they clutter
 * the chat and repeat what was already answered.
 *
 * Rating chips after a set (SUDs, VoC) are the opposite: they only appear
 * during check-in, which happens mid-session by definition.
 */
export function showsSessionQuickReplies(opts: {
  sessionMode: SessionMode;
  phase: ProtocolPhase;
  conversationStarted: boolean;
}): boolean {
  if (opts.sessionMode === "check_in") return true;
  return opts.phase === "intake" && !opts.conversationStarted;
}

/** Suggested replies after a BLS set, by protocol phase. */
export function checkInQuickReplies(phase: ProtocolPhase): QuickReply[] {
  switch (phase) {
    case "intake":
      return [
        { label: "Anxiety", value: "I'd like to work on anxiety." },
        { label: "Stress", value: "I'd like to work on stress." },
        { label: "A specific memory", value: "There's a specific memory I want to work on." },
        { label: "Not sure yet", value: "I'm not sure yet. Can you help me figure it out?" },
      ];
    case "desensitization":
      return [
        { label: "SUDs 0", value: "SUDs is 0" },
        { label: "1", value: "SUDs is 1" },
        { label: "2", value: "SUDs is 2" },
        { label: "3", value: "SUDs is 3" },
        { label: "5", value: "SUDs is 5" },
        { label: "7", value: "SUDs is 7" },
        { label: "10", value: "SUDs is 10" },
        { label: "Something new came up", value: "Something new came up." },
      ];
    case "installation":
      return [
        { label: "VoC 3", value: "VoC is 3" },
        { label: "4", value: "VoC is 4" },
        { label: "5", value: "VoC is 5" },
        { label: "6", value: "VoC is 6" },
        { label: "7", value: "VoC is 7" },
      ];
    case "body_scan":
      return [
        { label: "Body feels clear", value: "My body feels clear." },
        { label: "Tension remains", value: "I still notice tension." },
      ];
    default:
      return [
        { label: "I notice…", value: "I notice " },
        { label: "Safe place", value: "I need my safe place for a moment." },
      ];
  }
}

export function checkInPlaceholder(phase: ProtocolPhase): string {
  switch (phase) {
    case "intake":
      return "Type here…";
    case "desensitization":
      return "What do you notice? Or rate SUDs 0–10…";
    case "installation":
      return "How true is the positive belief? VoC 0–7…";
    case "body_scan":
      return "Any tension left in the body?";
    default:
      return "What do you notice now?";
  }
}
