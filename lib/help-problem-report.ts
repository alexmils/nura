/**
 * Help chat -> Problem reports. When someone tells the help chat (the help
 * bubble) that the app is not working, a problem report is created or merged
 * for their account with source "help_chat", and the help reply gets a short
 * confirmation line in their language.
 *
 * The help AI is a plain completion (no tool calling), so detection uses the
 * same deterministic matcher as guided sessions (lib/problem-report-rules.ts).
 * Crisis messages are never turned into reports. Only signed-in users (session
 * user id) count: signed-out visitors get no report and no confirmation line.
 * Never throws: any failure just means no report and no extra line.
 */
import { recordProblemReportFromChat } from "@/lib/problem-reports";
import { helpChatProblemDecision } from "@/lib/problem-report-rules";

export async function noteHelpChatProblem(input: {
  userId: string | null | undefined;
  helpThreadId: string;
  text: string;
}): Promise<{ ackLine: string } | null> {
  try {
    if (!input.userId) return null;
    const decision = helpChatProblemDecision(input.text);
    if (!decision) return null;
    const userId = input.userId;
    void recordProblemReportFromChat({
      userId,
      helpThreadId: input.helpThreadId,
      source: "help_chat",
      text: input.text,
      languageHint: decision.language,
    }).catch(() => {});
    return { ackLine: decision.ackLine };
  } catch (err) {
    console.error("[help/problem-report]", err);
    return null;
  }
}
