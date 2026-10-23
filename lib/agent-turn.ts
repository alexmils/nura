/**
 * Pure helpers for one guided-chat turn (app/api/chat/route.ts):
 * - classify the interpreter's raw output (ok / cut off / unparsable),
 * - a deterministic fallback when the interpreter gives nothing usable,
 * - the authoritative app-state block the guide gets every turn,
 * - the closed-session state after closure.
 *
 * Kept free of DB / fetch so tests can pin the behavior.
 */
import type { ProtocolPhase, Thread } from "./types";
import {
  EMPTY_INTERPRETATION,
  extractJsonObject,
  type SessionInterpretation,
} from "./session-interpreter";

const BLS_PHASES: ProtocolPhase[] = ["desensitization", "installation", "body_scan"];

export type InterpreterOutcome = "ok" | "cutoff" | "unparsable" | "error";

/**
 * Decide whether an interpreter reply can be used. A reply that hit the output
 * cap is a cutoff even if a brace happens to close: the object may be missing
 * the very fields (phase, startSet) the turn depends on.
 */
export function classifyInterpreterOutput(
  text: string,
  finishReason: string | null
): { outcome: InterpreterOutcome; raw: unknown | null } {
  if (finishReason === "length") {
    return { outcome: "cutoff", raw: null };
  }
  const raw = extractJsonObject(text ?? "");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { outcome: "unparsable", raw: null };
  }
  return { outcome: "ok", raw };
}

export function usagePurposeForOutcome(
  outcome: InterpreterOutcome
): "interpreter" | "interpreter_cutoff" | "interpreter_unparsed" {
  if (outcome === "cutoff") return "interpreter_cutoff";
  if (outcome === "unparsable" || outcome === "error") return "interpreter_unparsed";
  return "interpreter";
}

const RISK_RE =
  /\b(suicid\w*|kill (my ?self|me)|end (it|my life)|hurt(ing)? my ?self|self[- ]harm|don'?t want to (be here|live)|not safe|unsafe|can'?t breathe|panic attack|feel(ing)? unreal|dissociat\w*)\b/i;
const PAUSE_RE =
  /^(no|nope|not yet|wait|hold on|pause|stop|break|later|i need a (break|minute|moment))\b/i;
const AGAIN_RE = /\b(again|repeat|redo|one more|missed it|wasn'?t focused|distracted)\b/i;
const READY_RE =
  /^(ok(ay)?|ready|yes|yeah|yep|sure|go|let'?s go|start|begin|continue|done|good|fine|i'?m ready|k)\b/i;

/** First number 0-10 in the message, as a SUDs reading. */
export function sudsFromText(text: string): number | null {
  const m = text.match(/\b(10|[0-9])\b/);
  return m ? Number(m[1]) : null;
}

/** First number 0-7 in the message, as a VoC reading. */
export function vocFromText(text: string): number | null {
  const m = text.match(/\b([0-7])\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Deterministic turn result when the interpreter is disabled, errored, cut off,
 * or returned something unparsable. Mirrors the legacy regex path and adds
 * `startSet`, so a known target + SUDs still advances to the first set and
 * sets keep running in the processing phases.
 */
export function heuristicTurn(input: {
  thread: Pick<Thread, "phase" | "target" | "suds" | "voc" | "intakeComplete">;
  userMessage: string;
  /** User messages in the thread including this one. */
  userTurns: number;
  /** First substantive user message, used as the target when none is set. */
  firstUserMessage?: string | null;
}): { patch: Partial<Thread>; interpretation: SessionInterpretation } {
  const { thread } = input;
  const text = input.userMessage.trim();
  const patch: Partial<Thread> = {};
  const interp: SessionInterpretation = { ...EMPTY_INTERPRETATION };

  if (RISK_RE.test(text)) {
    interp.riskFlag = true;
    interp.needsGrounding = true;
    interp.distress = "overwhelm";
    patch.phase = "grounding";
    patch.incomplete = true;
    return { patch, interpretation: interp };
  }

  switch (thread.phase) {
    case "intake": {
      if (input.userTurns >= 3 && text.length > 1) {
        patch.phase = "grounding";
        patch.intakeComplete = true;
        const target =
          thread.target ?? (input.firstUserMessage ?? text).slice(0, 120);
        patch.target = target;
        interp.intakeComplete = true;
        interp.target = target;
      }
      break;
    }
    case "grounding": {
      if (text.length > 2 && !PAUSE_RE.test(text)) patch.phase = "assessment";
      break;
    }
    case "assessment": {
      const suds = sudsFromText(text);
      if (suds != null && (thread.target || input.firstUserMessage)) {
        patch.suds = suds;
        if (!thread.target && input.firstUserMessage) {
          patch.target = input.firstUserMessage.slice(0, 120);
        }
        patch.phase = "desensitization";
        interp.suds = suds;
        interp.startSet = true;
      }
      break;
    }
    case "desensitization": {
      const suds = sudsFromText(text);
      if (suds != null) {
        patch.suds = suds;
        interp.suds = suds;
        if (suds <= 1) {
          patch.phase = "installation";
          break;
        }
      }
      interp.startSet = !PAUSE_RE.test(text);
      if (AGAIN_RE.test(text)) interp.setReport = "repeat";
      break;
    }
    case "installation": {
      const voc = vocFromText(text);
      if (voc != null) {
        patch.voc = voc;
        interp.voc = voc;
        if (voc >= 7) {
          patch.phase = "body_scan";
          break;
        }
      }
      interp.startSet = !PAUSE_RE.test(text);
      break;
    }
    case "body_scan": {
      if (/\b(nothing|clear|relaxed|calm|no tension|fine|good)\b/i.test(text)) {
        patch.phase = "closure";
      } else {
        interp.startSet = !PAUSE_RE.test(text);
      }
      break;
    }
    default:
      break;
  }
  return { patch, interpretation: interp };
}

/**
 * The interpreter may jump straight into desensitization (seen in the browser
 * run: grounding -> desensitization with no SUDs). A first set needs a target
 * and a starting SUDs, otherwise there is no baseline to measure against and
 * the closure card has nothing to show. Hold the thread in assessment instead.
 */
export function guardSetEntry(
  thread: Pick<Thread, "phase" | "target" | "suds">,
  patch: Partial<Thread>
): { patch: Partial<Thread>; blocked: boolean } {
  const next = patch.phase ?? thread.phase;
  const enteringSets =
    BLS_PHASES.includes(next) && !BLS_PHASES.includes(thread.phase);
  if (!enteringSets) return { patch, blocked: false };
  const target = (patch.target ?? thread.target ?? "").trim();
  const suds = patch.suds !== undefined ? patch.suds : thread.suds;
  if (target && suds != null) return { patch, blocked: false };
  return { patch: { ...patch, phase: "assessment" }, blocked: true };
}

/** Record the first SUDs / VoC as the closure card's start values. */
export function baselinePatch(
  thread: Pick<Thread, "baselineSuds" | "baselineVoc">,
  patch: Partial<Thread>
): Partial<Thread> {
  const out: Partial<Thread> = {};
  if (thread.baselineSuds == null && patch.suds != null) out.baselineSuds = patch.suds;
  if (thread.baselineVoc == null && patch.voc != null) out.baselineVoc = patch.voc;
  return out;
}

/** What has to happen before the moving ball can run, in guide language. */
export function nextStepBeforeSet(
  thread: Pick<Thread, "phase" | "target" | "suds">
): string {
  switch (thread.phase) {
    case "intake":
      return "finish getting to know them and the brief safety check, then agree ONE short starting target (the app then moves to grounding)";
    case "grounding":
      return "a safe place and a stop signal; once they have those, move on to the target (the app then moves to assessment)";
    case "assessment": {
      const missing: string[] = [];
      if (!thread.target) missing.push("the target (image or worst part)");
      if (thread.suds == null) missing.push("a SUDs rating from 0 to 10");
      return missing.length
        ? `collect ${missing.join(" and ")}. The first set starts automatically as soon as the target and the SUDs number are known`
        : "a SUDs rating from 0 to 10 for the target. The first set starts automatically right after it";
    }
    case "closure":
      return "nothing: the session is closed, no more sets today";
    default:
      return "the person telling you they are ready (or saying \"again\" to repeat the set)";
  }
}

/**
 * Authoritative app state for the guide. The guide reads the whole chat and
 * can run ahead of the app; this pins what the app will actually do after the
 * reply, so the guide never promises a ball that is not coming.
 */
export function guideAppStateBlock(input: {
  thread: Pick<Thread, "phase" | "target" | "suds" | "voc" | "setCount" | "lastSetOutcome">;
  /** True when the app will start a set right after this reply. */
  setStartsNow: boolean;
}): string {
  const { thread, setStartsNow } = input;
  const inBlsPhase = BLS_PHASES.includes(thread.phase);
  const lines = [
    "App state (authoritative: the app, not you, runs the moving ball):",
    `- current app phase: ${thread.phase}`,
    `- target: ${thread.target ?? "not set yet"}`,
    `- SUDs: ${thread.suds ?? "not rated yet"}; VoC: ${thread.voc ?? "not rated yet"}`,
    `- sets completed: ${thread.setCount ?? 0}; last set: ${thread.lastSetOutcome ?? "none yet"}`,
    `- a set can start in this phase: ${inBlsPhase ? "yes" : "no"}`,
    `- a set starts right after this reply: ${setStartsNow ? "YES" : "NO"}`,
  ];
  if (setStartsNow) {
    lines.push(
      "Rule: the set starts automatically when your reply ends. Give one short line (for example: hold the target in mind and follow the ball). Do not ask a question and do not ask them to press anything."
    );
  } else {
    lines.push(
      "Rule: NO set starts after this reply. Never say \"follow the ball\", \"I'll start the set\", \"starting the set now\", \"the ball will move\" or anything that implies a set or a moving ball is about to run, in any language. Do not teach tapping as a replacement for the set.",
      `Instead, work toward what is needed next: ${nextStepBeforeSet(thread)}.`
    );
  }
  return lines.join("\n");
}

const FAREWELL_RE =
  /^(thanks?( you)?( a lot| so much)?|thank u|thx|ty|bye+|goodbye|good night|see (you|ya)|talk (soon|later)|take care|cheers|ok(ay)?|great|perfect|cool|👋|🙏|❤️|:\)|[\s.,!])+[!.\s😄🙂😊]*$/iu;

/** True for a pure goodbye / thanks with nothing new to work on. */
export function isFarewell(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 80) return false;
  return FAREWELL_RE.test(t);
}

export const CLOSED_SESSION_LINE =
  "Take care. This session is closed and saved. When you want to continue, start a new session and we'll check in on what changed.";

/** Closure-phase guidance appended to the guide prompt. */
export const CLOSED_SESSION_GUIDE_RULE =
  "The session is closed. Do not start new processing, do not ask new questions, and do not say goodbye more than once. If they share something new, acknowledge it in one short sentence and suggest bringing it to the next session.";

/**
 * Closed-state reply: after closure a bare goodbye gets the closed line once,
 * and nothing at all after that, so the chat does not loop on farewells.
 * `null` means "let the guide answer normally".
 */
export function closedSessionReply(input: {
  phase: ProtocolPhase;
  userMessage: string;
  lastAgentMessage: string | null;
}): { reply: string | null; silent: boolean } | null {
  if (input.phase !== "closure") return null;
  if (!isFarewell(input.userMessage)) return null;
  if (input.lastAgentMessage?.trim() === CLOSED_SESSION_LINE) {
    return { reply: null, silent: true };
  }
  return { reply: CLOSED_SESSION_LINE, silent: false };
}
