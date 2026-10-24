import { NextResponse } from "next/server";
import {
  addMessage,
  clientProfileContextBlock,
  getClientProfile,
  getAccountMemoryContext,
  getThread,
  listMessages,
  updateThread,
  upsertClientProfile,
} from "@/lib/db";
import {
  chatCompletion,
  chatCompletionDetailed,
  recordCompletionUsage,
} from "@/lib/llm";
import {
  baselinePatch,
  guardSetEntry,
  classifyInterpreterOutput,
  closedSessionReply,
  CLOSED_SESSION_GUIDE_RULE,
  consecutiveMessagesRule,
  guardRepeatedReply,
  guideAppStateBlock,
  heuristicTurn,
  isNearDuplicateReply,
  lastAgentMessage,
  repeatRetryInstruction,
  trailingUserMessages,
  usagePurposeForOutcome,
  type InterpreterOutcome,
} from "@/lib/agent-turn";
import { canStartBls } from "@/lib/session-mode";
import { batchTurnText, normalizeUserBatch } from "@/lib/reply-debounce";
import {
  checkInLine,
  guidedFallbackReply,
  interruptedSetLine,
  openingLine,
  reevaluationOpeningLine,
  systemPromptForPhase,
} from "@/lib/protocol";
import { detectCrisis, groundingFallbackLine } from "@/lib/crisis-detect";
import {
  dissociationFallbackLine,
  dissociationGuideBlock,
  dissociationPatch,
  screenDissociationTurn,
  type DissociationScreen,
} from "@/lib/dissociation-screen";
import {
  resolveTurnLanguage,
  turnLanguageBlock,
  type TurnLanguage,
} from "@/lib/session-languages";
import {
  getLlmRuntimeConfig,
  getPlatformSettings,
} from "@/lib/platform-settings";
import {
  clientProfilePatchFromInterpretation,
  interpretationContextBlock,
  interpreterSystemPrompt,
  parseSessionInterpretation,
  threadPatchFromInterpretation,
  type SessionInterpretation,
} from "@/lib/session-interpreter";
import { withAuth } from "@/lib/api-auth";
import {
  isGuidedSessionClosed,
  sessionClosedBody,
  SESSION_CLOSED_STATUS,
} from "@/lib/session-closed-guard";
import { getRlsContext } from "@/lib/rls";
import { recordProblemReportFromChat } from "@/lib/problem-reports";
import {
  scheduleSessionMemoryExtract,
  shouldScheduleMemoryExtract,
} from "@/lib/memory-extract";

async function runInterpreter(opts: {
  settings: Awaited<ReturnType<typeof getLlmRuntimeConfig>>;
  phase: string;
  threadSummary: string;
  recentMessages: { role: string; content: string }[];
  userMessage: string;
  userId: string;
}): Promise<{
  interpretation: SessionInterpretation | null;
  outcome: InterpreterOutcome;
}> {
  try {
    // Own budget, JSON mode, and no hidden reasoning: with the guide's 512-token
    // cap DeepSeek V4 spent most of the budget thinking and the JSON was cut
    // off on ~85% of turns, so the phase never advanced and no set started.
    const result = await chatCompletionDetailed(
      opts.settings,
      [
        {
          role: "system",
          content: interpreterSystemPrompt(
            opts.phase as Parameters<typeof interpreterSystemPrompt>[0]
          ),
        },
        {
          role: "user",
          content: [
            `Thread state:\n${opts.threadSummary}`,
            "",
            "Recent messages:",
            ...opts.recentMessages.map(
              (m) => `${m.role === "agent" ? "assistant" : "user"}: ${m.content}`
            ),
            "",
            `Latest user message: ${opts.userMessage}`,
          ].join("\n"),
        },
      ],
      { userId: opts.userId, purpose: "interpreter" },
      { maxTokens: 2048, json: true, disableThinking: true, deferUsage: true }
    );
    const { outcome, raw } = classifyInterpreterOutput(
      result.text,
      result.finishReason
    );
    recordCompletionUsage(
      { userId: opts.userId, purpose: usagePurposeForOutcome(outcome) },
      result
    );
    if (outcome !== "ok") {
      console.warn(
        `[chat] interpreter ${outcome} (finish=${result.finishReason ?? "?"}, chars=${result.text.length}); using heuristic fallback`
      );
      return { interpretation: null, outcome };
    }
    return { interpretation: parseSessionInterpretation(raw), outcome };
  } catch (err) {
    console.warn("[chat] interpreter failed:", err);
    return { interpretation: null, outcome: "error" };
  }
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const body = await request.json();
    const {
      threadId,
      userMessage: singleUserMessage,
      userMessages,
      bootstrap,
      afterSet,
      setOutcome,
    } =
      body as {
        threadId: string;
        userMessage?: string;
        /** Messages sent in one quiet window (lib/reply-debounce.ts): one turn. */
        userMessages?: string[];
        bootstrap?: boolean;
        afterSet?: boolean;
        setOutcome?: "completed" | "stopped";
      };
    // Each message is saved in order; the guide answers the batch once, and
    // the interpreter / language / safety checks read it as one text.
    const userBatch = normalizeUserBatch(userMessages, singleUserMessage);
    const userMessage = batchTurnText(userBatch);

    let thread = await getThread(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    if (thread.mode !== "guided") {
      return NextResponse.json(
        { error: "Chat is only available in guided sessions" },
        { status: 400 }
      );
    }

    // Closed session (summary card shown, composer disabled): refuse every
    // further turn BEFORE saving the message or calling the interpreter /
    // guide model, so nothing after closure costs an LLM call.
    if (isGuidedSessionClosed(thread)) {
      return NextResponse.json(sessionClosedBody(thread), {
        status: SESSION_CLOSED_STATUS,
      });
    }

    // How the set the app just ran actually ended. The guide cannot see the
    // ball, so without this it has no way to tell a finished set from one the
    // person cut short, and would treat both as processed material.
    if (afterSet && setOutcome) {
      const updated = await updateThread(threadId, {
        lastSetOutcome: setOutcome,
        ...(setOutcome === "completed"
          ? { setCount: (thread.setCount ?? 0) + 1 }
          : {}),
      });
      if (updated) thread = updated;
    }

    const { userId } = getRlsContext();
    const settings = await getLlmRuntimeConfig();
    const platform = await getPlatformSettings();
    const memoryContext =
      platform.flags.memory === false
        ? ""
        : await getAccountMemoryContext();
    const profile = await getClientProfile(userId);
    const profileContext = clientProfileContextBlock(profile);
    const history = await listMessages(threadId);

    if (bootstrap && history.length === 0) {
      const line =
        profile?.intakeCompletedAt && thread.phase === "intake"
          ? reevaluationOpeningLine(profile.presentingProblem)
          : openingLine(thread.phase);
      const msg = await addMessage(threadId, "agent", line);
      return NextResponse.json({ message: msg });
    }

    // A stopped set did not process anything, so it gets the "nothing is lost,
    // say again" line instead of the scale reading. A completed set keeps the
    // normal check-in.
    const setLine =
      setOutcome === "stopped"
        ? interruptedSetLine(thread.phase)
        : checkInLine(thread.phase);

    // A pinned non-English session gets its post-set check-in from the guide so
    // the line matches the user's language. English keeps the canned line (and
    // the canned line stays the fallback if the model is unavailable).
    const localizedCheckIn =
      afterSet &&
      Boolean(thread.agentLanguage) &&
      thread.agentLanguage !== "en";

    if (afterSet && !localizedCheckIn) {
      const msg = await addMessage(threadId, "agent", setLine);
      return NextResponse.json({ message: msg, thread });
    }

    for (const text of userBatch) {
      await addMessage(threadId, "user", text);
    }

    // Problem reports (lib/problem-reports.ts): the person says the APP is not
    // working (no ball, no sound...). Fire-and-forget and fail-safe: it never
    // changes or delays the reply, and crisis turns are left to crisis handling.
    if (userMessage && !detectCrisis(userMessage)) {
      void recordProblemReportFromChat({
        userId,
        threadId,
        text: userMessage,
        languageHint: thread.agentLanguage ?? null,
      }).catch(() => {});
    }

    // Closed session: a bare goodbye gets one closing line, then silence, so
    // the chat does not loop on farewells after the work is done.
    if (userMessage) {
      const lastAgent =
        [...history].reverse().find((m) => m.role === "agent")?.content ?? null;
      const closed = closedSessionReply({
        phase: thread.phase,
        userMessage,
        lastAgentMessage: lastAgent,
      });
      if (closed) {
        const msg = closed.reply
          ? await addMessage(threadId, "agent", closed.reply)
          : null;
        return NextResponse.json({
          message: msg,
          thread: await getThread(threadId),
          interpretation: null,
          closed: true,
        });
      }
    }

    let interpretation: SessionInterpretation | null = null;
    let workingThread = thread;

    // Reply language, decided every turn from what the user writes in THIS
    // session (lib/session-languages.ts resolveTurnLanguage): a clear message in
    // another language or an explicit request switches, "I don't understand"
    // and short replies keep the current language, and an unpinned session
    // defaults to English. Memory, profile, browser and country never decide it.
    let turnLanguage: TurnLanguage | null = null;
    if (userMessage) {
      turnLanguage = resolveTurnLanguage({
        current: workingThread.agentLanguage,
        userMessage,
      });
      if (
        turnLanguage.pin &&
        turnLanguage.code !== workingThread.agentLanguage
      ) {
        // The English opening welcome is app UI and stays English (UI is never
        // localized); only the guide's replies follow the session language.
        const withLanguage = await updateThread(threadId, {
          agentLanguage: turnLanguage.code,
        });
        if (withLanguage) workingThread = withLanguage;
      }
    }

    // Dissociation screening (lib/dissociation-screen.ts): read from the user's
    // answer to the guide's last line, before the phase patch is built.
    let dissociationScreen: DissociationScreen | null = null;
    const answeredLine = lastAgentMessage(history);

    let interpreterOutcome: InterpreterOutcome | "disabled" | null = null;
    if (userMessage && platform.flags.sessionInterpreter !== false) {
      const recent = (await listMessages(threadId)).slice(-16).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const run = await runInterpreter({
        settings,
        phase: thread.phase,
        threadSummary: [
          `phase=${thread.phase}`,
          `target=${thread.target ?? ""}`,
          `NC=${thread.negativeCognition ?? ""}`,
          `PC=${thread.positiveCognition ?? ""}`,
          `suds=${thread.suds ?? ""}`,
          `voc=${thread.voc ?? ""}`,
          `intakeComplete=${thread.intakeComplete ?? false}`,
          `setsCompleted=${thread.setCount ?? 0}`,
          `lastSetOutcome=${thread.lastSetOutcome ?? "none"}`,
          `dissociation=${thread.dissociation ?? "none"}`,
          profileContext ? `profile:\n${profileContext}` : "profile: none",
        ].join("\n"),
        recentMessages: recent,
        userMessage,
        userId,
      });
      interpretation = run.interpretation;
      interpreterOutcome = run.outcome;

      if (interpretation) {
        const screened = screenDissociationTurn({
          thread,
          userMessage,
          lastAgentMessage: answeredLine,
          interpretation,
        });
        interpretation = screened.interpretation;
        dissociationScreen = screened.screen;
        const guarded = guardSetEntry(
          thread,
          dissociationPatch(
            thread,
            screened.screen,
            threadPatchFromInterpretation(thread, interpretation)
          )
        );
        const patch = guarded.patch;
        if (guarded.blocked) {
          interpretation = { ...interpretation, startSet: false };
          console.warn(
            `[chat] interpreter tried to enter sets without target+SUDs thread=${threadId}; held in assessment`
          );
        }
        Object.assign(patch, baselinePatch(thread, patch));
        if (Object.keys(patch).length > 0) {
          const updated = await updateThread(threadId, patch);
          if (updated) workingThread = updated;
        }

        // The advance out of assessment is deterministic, so the start has to
        // be too. Otherwise a model that forgets startSet leaves the phase in
        // desensitization with the ball waiting on the person to press
        // something, which is exactly the gap this closes.
        if (thread.phase === "assessment" && patch.phase === "desensitization") {
          interpretation = { ...interpretation, startSet: true };
        }

        const profilePatch = clientProfilePatchFromInterpretation(
          interpretation,
          Boolean(profile?.intakeCompletedAt)
        );
        if (Object.keys(profilePatch).length > 0) {
          await upsertClientProfile(profilePatch, userId);
        }
      }
    } else if (userMessage) {
      interpreterOutcome = "disabled";
    }

    // Interpreter disabled, errored, cut off, or unparsable: never leave the
    // turn without a decision. The deterministic heuristic still advances a
    // known target + SUDs into the first set, and keeps sets running.
    if (userMessage && !interpretation) {
      const msgs = await listMessages(threadId);
      const userMsgs = msgs.filter((m) => m.role === "user");
      const firstUserMessage =
        userMsgs.find((m) => m.content.trim().length > 12)?.content ?? null;
      const fallback = heuristicTurn({
        thread: workingThread,
        userMessage,
        userTurns: userMsgs.length,
        firstUserMessage,
      });
      const screened = screenDissociationTurn({
        thread: workingThread,
        userMessage,
        lastAgentMessage: answeredLine,
        interpretation: fallback.interpretation,
      });
      interpretation = screened.interpretation;
      dissociationScreen = screened.screen;
      const screenedPatch = dissociationPatch(
        workingThread,
        screened.screen,
        fallback.patch
      );
      const patch = {
        ...screenedPatch,
        ...baselinePatch(workingThread, screenedPatch),
      };
      if (Object.keys(patch).length > 0) {
        const updated = await updateThread(threadId, patch);
        if (updated) workingThread = updated;
      }
      if (
        thread.phase === "intake" &&
        patch.intakeComplete &&
        !profile?.intakeCompletedAt
      ) {
        await upsertClientProfile(
          {
            presentingProblem: (firstUserMessage ?? userMessage).slice(0, 280),
            intakeCompletedAt: new Date().toISOString(),
          },
          userId
        );
      }
    }

    // The set only starts if the client will actually be able to start it.
    const setStartsNow = Boolean(
      interpretation?.startSet &&
        !interpretation.riskFlag &&
        !interpretation.outOfWindow &&
        canStartBls({
          sessionKind: workingThread.mode,
          phase: workingThread.phase,
          sessionMode: "idle",
        })
    );
    if (interpretation && interpretation.startSet !== setStartsNow) {
      interpretation = { ...interpretation, startSet: setStartsNow };
    }

    if (
      shouldScheduleMemoryExtract({
        memoryFlagEnabled: platform.flags.memory !== false,
        mode: workingThread.mode,
        previousPhase: thread.phase,
        previousIncomplete: thread.incomplete,
        nextPhase: workingThread.phase,
        nextIncomplete: workingThread.incomplete,
        alreadyExtracted: Boolean(thread.memoryExtractedAt),
      })
    ) {
      const rls = getRlsContext();
      scheduleSessionMemoryExtract({
        userId: rls.userId,
        role: rls.role,
        threadId,
      });
    }

    const freshProfile =
      interpretation != null ? await getClientProfile(userId) : profile;
    const freshProfileContext = clientProfileContextBlock(freshProfile);

    const adminNotes = platform.agentKnowledgeNotes?.trim();
    const system =
      systemPromptForPhase(
        workingThread.phase,
        memoryContext,
        freshProfileContext,
        turnLanguage?.code ?? workingThread.agentLanguage
      ) +
      (adminNotes
        ? `\n\nAdmin protocol notes (platform):\n${adminNotes.slice(0, 4000)}`
        : "") +
      (interpretation
        ? `\n\n${interpretationContextBlock(interpretation)}`
        : "") +
      `\n\nSet state for this thread (the app runs the sets, you do not see them):\n- sets completed: ${workingThread.setCount ?? 0}\n- last set: ${workingThread.lastSetOutcome ?? "none yet"}\nA "stopped" last set means the person was interrupted or cut it short, so nothing was processed: the same set is repeated, and you do not read SUDs or VoC from it.` +
      `\n\n${guideAppStateBlock({ thread: workingThread, setStartsNow })}` +
      (dissociationGuideBlock(workingThread.dissociation)
        ? `\n\n${dissociationGuideBlock(workingThread.dissociation)}`
        : "") +
      (workingThread.phase === "closure"
        ? `\n\n${CLOSED_SESSION_GUIDE_RULE}`
        : "");

    const promptHistory = await listMessages(threadId);
    const lateMessagesRule = consecutiveMessagesRule(
      trailingUserMessages(promptHistory)
    );
    // Language goes last so memory, profile and admin notes cannot outweigh it.
    const systemFinal =
      system +
      (lateMessagesRule ? `\n\n${lateMessagesRule}` : "") +
      (turnLanguage ? `\n\n${turnLanguageBlock(turnLanguage)}` : "");

    const toChat = (rows: { role: string; content: string }[]) =>
      rows
        .filter((m) => !isStaleFallbackMessage(m.content))
        .map((m) => ({
          role: (m.role === "agent" ? "assistant" : "user") as
            | "assistant"
            | "user",
          content: m.content,
        }));

    const messages = [
      {
        role: "system" as const,
        content: systemFinal,
      },
      ...toChat(promptHistory),
      // A set just ended in a session pinned to another language: instead of the
      // canned English line, have the guide say it in the user's language. This
      // control turn is only sent to the model, never stored.
      ...(localizedCheckIn
        ? [
            {
              role: "user" as const,
              content: `(The set just ended. Reply with nothing but this line, translated into the language of this session: "${setLine}")`,
            },
          ]
        : []),
    ];

    try {
      const reply = await chatCompletion(settings, messages, {
        userId,
        purpose: "guided_chat",
      });
      let text = reply.trim();
      if (!text) {
        throw new Error("Empty LLM reply");
      }

      // Never post the previous guide line again. Two messages sent in a row
      // used to run as two parallel turns that both asked the same question;
      // the client now serializes sends, and this catches any repeat that is
      // left (another tab, a model that loops on an unanswered question).
      if (!localizedCheckIn) {
        const latest = await listMessages(threadId);
        let verdict = guardRepeatedReply({
          reply: text,
          history: latest,
          retried: false,
        });
        if (verdict === "retry") {
          const second = (
            await chatCompletion(
              settings,
              [
                { role: "system" as const, content: systemFinal },
                ...toChat(latest),
                {
                  role: "user" as const,
                  content: repeatRetryInstruction(
                    lastAgentMessage(latest) ?? text
                  ),
                },
              ],
              { userId, purpose: "guided_chat" }
            )
          ).trim();
          verdict = second
            ? guardRepeatedReply({ reply: second, history: latest, retried: true })
            : "drop";
          if (verdict === "use") text = second;
        }
        if (verdict === "drop") {
          console.warn(
            `[chat] guide repeated its previous line twice thread=${threadId}; reply suppressed`
          );
          return NextResponse.json({
            message: null,
            thread: await getThread(threadId),
            interpreterOutcome,
            interpretation: null,
            duplicateSuppressed: true,
          });
        }
      }

      const agentMsg = await addMessage(threadId, "agent", text);
      const fresh = await getThread(threadId);

      return NextResponse.json({
        message: agentMsg,
        thread: fresh,
        interpreterOutcome,
        interpretation: interpretation
          ? {
              suds: interpretation.suds,
              voc: interpretation.voc,
              suggestedPhase: interpretation.suggestedPhase,
              distress: interpretation.distress,
              outOfWindow: interpretation.outOfWindow,
              setReport: interpretation.setReport,
              needsGrounding: interpretation.needsGrounding,
              intakeComplete: interpretation.intakeComplete,
              riskFlag: interpretation.riskFlag,
              startSet: interpretation.startSet,
            }
          : null,
      });
    } catch (e) {
      console.warn("[chat] LLM failed:", e);
      const fallback =
        interpretation?.outOfWindow ||
        interpretation?.needsGrounding ||
        interpretation?.riskFlag
          ? groundingFallbackLine(
              detectCrisis(userMessage)?.language ??
                turnLanguage?.code ??
                workingThread.agentLanguage
            )
          : localizedCheckIn
            ? setLine
            : ((dissociationScreen?.changed
                ? dissociationFallbackLine(workingThread.dissociation)
                : null) ??
              guidedFallbackReply(workingThread.phase, userMessage));
      // The canned lines are fixed per phase, so a second failure in a row
      // would post the same line twice. Say something different instead.
      const previousLine = lastAgentMessage(await listMessages(threadId));
      const fallbackText = isNearDuplicateReply(fallback, previousLine)
        ? "Take your time. Tell me a little more in your own words, and we'll go on from there."
        : fallback;
      const agentMsg = await addMessage(threadId, "agent", fallbackText);
      return NextResponse.json({
        message: agentMsg,
        thread: await getThread(threadId),
        interpretation: interpretation
          ? {
              suds: interpretation.suds,
              voc: interpretation.voc,
              suggestedPhase: interpretation.suggestedPhase,
              distress: interpretation.distress,
              outOfWindow: interpretation.outOfWindow,
              setReport: interpretation.setReport,
              needsGrounding: interpretation.needsGrounding,
              intakeComplete: interpretation.intakeComplete,
              riskFlag: interpretation.riskFlag,
              startSet: interpretation.startSet,
            }
          : null,
        warning: e instanceof Error ? e.message : "LLM error",
      });
    }
  });
}

/** Old generic LLM-failure lines that should not poison the guide context. */
function isStaleFallbackMessage(content: string): boolean {
  const t = content.trim();
  return (
    t.startsWith("I'm here with you. Take a breath.") ||
    t.includes("Configure an AI provider in Settings")
  );
}
