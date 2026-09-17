import type { ProtocolPhase } from "./types";
import {
  knowledgeBlockForPhase,
  PROTOCOL_KNOWLEDGE_VERSION,
} from "./protocol-knowledge";
import { ENGLISH_WELCOME, languageInstruction } from "./session-languages";

export type SessionMode = "idle" | "running" | "check_in";

export interface ProtocolState {
  phase: ProtocolPhase;
  mode: SessionMode;
  setCount: number;
}

export const PHASE_ORDER: ProtocolPhase[] = [
  "intake",
  "grounding",
  "assessment",
  "desensitization",
  "installation",
  "body_scan",
  "closure",
];

export function nextPhaseAfterDesensitization(
  suds: number | undefined
): ProtocolPhase {
  if (suds === undefined || suds > 1) return "desensitization";
  return "installation";
}

export function systemPromptForPhase(
  phase: ProtocolPhase,
  memoryContext: string,
  profileContext = "",
  languageCode = ""
): string {
  const knowledge = knowledgeBlockForPhase(phase);
  const language = languageInstruction(languageCode);
  const languageBlock = language ? `\n\nLanguage for this session:\n${language}` : "";
  const memory = memoryContext
    ? `\n\nEnabled memory sets for this session (user-owned context only):\n${memoryContext}`
    : "";
  const profile = profileContext
    ? `\n\nClient profile (persistent across sessions — use for continuity):\n${profileContext}`
    : "";

  return `${knowledge}\n\n(Knowledge version: ${PROTOCOL_KNOWLEDGE_VERSION})${languageBlock}${memory}${profile}`;
}

export function checkInLine(phase: ProtocolPhase): string {
  switch (phase) {
    case "intake":
      return "Take a breath. What else feels important for me to know before we continue?";
    case "desensitization":
      return "Let it go, take a deep breath. What do you notice now?";
    case "installation":
      return "Take a breath. How true does the positive belief feel now, from 0 to 7?";
    case "body_scan":
      return "Scan your body from head to toe. What do you notice now?";
    default:
      return "Take a deep breath. What do you notice now?";
  }
}

/**
 * Post-set line when the set did not run to completion: the person stopped it,
 * got distracted, or something interrupted them. Nothing was processed, so this
 * never reads a scale. It only teaches the two words the guide needs next
 * ("again" to rerun the same set, "done" when it really finished).
 */
export function interruptedSetLine(phase: ProtocolPhase): string {
  switch (phase) {
    case "installation":
      return 'Set stopped early. Nothing is lost. Take a breath, then say "again" to rerun it with your positive belief.';
    case "body_scan":
      return 'Set stopped early. Take a breath, then say "again" to rerun that short set.';
    default:
      return 'Set stopped early. Nothing is lost. Take a breath, then say "again" to rerun it or "done" if you finished it.';
  }
}

export function openingLine(phase: ProtocolPhase): string {
  switch (phase) {
    case "intake":
      return ENGLISH_WELCOME;
    case "grounding":
      return "Welcome. Before we work a target, let's ground. Notice your breath. When you're ready, describe your safe place in a few words (real or imagined).";
    case "assessment":
      return "Bring up the target as a picture, or the strongest body sensation if there's no clear image. What is the worst part, and what negative belief about yourself goes with it?";
    case "desensitization":
      return "Hold the target in mind: image, belief, and body sensation. I'll start the set now. Follow the ball. I'll stay quiet while it moves.";
    case "installation":
      return "Focus on your positive belief together with the target. Notice how true it feels now, from 0 to 7.";
    case "body_scan":
      return "Think of the original target and slowly scan your body from head to toe. Tell me if any tension remains.";
    case "closure":
      return "You did meaningful work. Take a deep breath. Processing may continue after the session; that's normal. Use your safe place or butterfly hug if anything stirs.";
  }
}

/** Short opener for returning users who already completed intake. */
export function reevaluationOpeningLine(presentingProblem?: string): string {
  const prior = presentingProblem?.trim()
    ? ` Last time we noted: ${presentingProblem.trim().slice(0, 120)}.`
    : "";
  return `Welcome back.${prior} Before we continue, what has changed since last time, and what would you like to work on today?`;
}

/**
 * Protocol-faithful reply when the LLM is unavailable — never a generic chatbot line.
 * Never paste the user's words back in parentheses (reads as a broken bot).
 */
export function guidedFallbackReply(
  phase: ProtocolPhase,
  userMessage?: string
): string {
  const hasContent = (userMessage ?? "").trim().length > 1;

  switch (phase) {
    case "intake":
      if (hasContent) {
        return "Thank you. When did this start to feel most present, and how does it show up in daily life now?";
      }
      return "In a few words, what would you like to work on today?";
    case "grounding":
      if (hasContent) {
        return "Good. Hold that safe place. Notice one calm detail: a color, sound, or feeling. When you feel a bit steadier, say \"ready\" and we'll choose a target.";
      }
      return "Describe your safe place in a few words (real or imagined), somewhere that feels calm.";
    case "assessment":
      if (hasContent) {
        return "Thank you. Next: what negative belief about yourself goes with that (present-tense \"I …\")?";
      }
      return "What is the worst part of the target: an image, sensation, or feeling? One short phrase is enough.";
    case "desensitization":
      return "Let it go, take a deep breath. What do you notice now? Then we'll go with that on the next set.";
    case "installation":
      return "Hold your positive belief with the target. How true does it feel from 0 to 7?";
    case "body_scan":
      return "Scan slowly from head to toe while thinking of the target. Tell me if any tension remains.";
    case "closure":
      return "We're closing for now. Use your safe place or a butterfly hug if anything stirs later; that's normal.";
  }
}
