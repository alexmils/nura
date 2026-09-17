import { NextResponse } from "next/server";
import {
  addMessage,
  clientProfileContextBlock,
  getClientProfile,
  getEnabledMemoryContext,
  getThread,
  listMessages,
  updateMessageContent,
  updateThread,
  upsertClientProfile,
} from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import {
  checkInLine,
  guidedFallbackReply,
  interruptedSetLine,
  openingLine,
  reevaluationOpeningLine,
  systemPromptForPhase,
} from "@/lib/protocol";
import {
  detectSessionLanguage,
  isWelcomeOpening,
  welcomeLineFor,
} from "@/lib/session-languages";
import {
  getLlmRuntimeConfig,
  getPlatformSettings,
} from "@/lib/platform-settings";
import {
  clientProfilePatchFromInterpretation,
  extractJsonObject,
  interpretationContextBlock,
  interpreterSystemPrompt,
  parseSessionInterpretation,
  threadPatchFromInterpretation,
  type SessionInterpretation,
} from "@/lib/session-interpreter";
import { withAuth } from "@/lib/api-auth";
import { getRlsContext } from "@/lib/rls";

async function runInterpreter(opts: {
  settings: Awaited<ReturnType<typeof getLlmRuntimeConfig>>;
  phase: string;
  threadSummary: string;
  recentMessages: { role: string; content: string }[];
  userMessage: string;
  userId: string;
}): Promise<SessionInterpretation | null> {
  try {
    const raw = await chatCompletion(
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
      { userId: opts.userId, purpose: "interpreter" }
    );
    return parseSessionInterpretation(extractJsonObject(raw));
  } catch (err) {
    console.warn("[chat] interpreter failed:", err);
    return null;
  }
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const body = await request.json();
    const { threadId, userMessage, bootstrap, afterSet, setOutcome } =
      body as {
        threadId: string;
        userMessage?: string;
        bootstrap?: boolean;
        afterSet?: boolean;
        setOutcome?: "completed" | "stopped";
      };

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
        : await getEnabledMemoryContext(threadId);
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

    if (userMessage) {
      await addMessage(threadId, "user", userMessage);
    }

    let interpretation: SessionInterpretation | null = null;
    let workingThread = thread;

    // The first recognizable user message decides the session language: pin the
    // guide to it and rewrite the opening welcome so the first bubble matches.
    // Stays open until a language is pinned, so a vague opener is not fatal.
    if (userMessage && !workingThread.agentLanguage) {
      const detected = detectSessionLanguage(userMessage);
      if (detected) {
        const opening = history.find((m) => m.role === "agent");
        if (opening && isWelcomeOpening(opening.content)) {
          await updateMessageContent(opening.id, welcomeLineFor(detected.code));
        }
        const withLanguage = await updateThread(threadId, {
          agentLanguage: detected.code,
        });
        if (withLanguage) workingThread = withLanguage;
      }
    }

    if (userMessage && platform.flags.sessionInterpreter !== false) {
      const recent = (await listMessages(threadId)).slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      interpretation = await runInterpreter({
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
          profileContext ? `profile:\n${profileContext}` : "profile: none",
        ].join("\n"),
        recentMessages: recent,
        userMessage,
        userId,
      });

      if (interpretation) {
        const patch = threadPatchFromInterpretation(thread, interpretation);
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
      // Legacy regex fallbacks when interpreter is disabled
      if (thread.phase === "intake" && userMessage.length > 2) {
        const msgs = await listMessages(threadId);
        const userTurns = msgs.filter((m) => m.role === "user").length;
        // Keep in intake for a few turns, then move to grounding
        if (userTurns >= 3) {
          const updated = await updateThread(threadId, {
            phase: "grounding",
            intakeComplete: true,
            target: thread.target ?? userMessage.slice(0, 120),
          });
          if (updated) workingThread = updated;
          if (!profile?.intakeCompletedAt) {
            await upsertClientProfile(
              {
                presentingProblem: userMessage.slice(0, 280),
                intakeCompletedAt: new Date().toISOString(),
              },
              userId
            );
          }
        }
      }
      if (thread.phase === "grounding" && userMessage.length > 2) {
        const updated = await updateThread(threadId, { phase: "assessment" });
        if (updated) workingThread = updated;
      }
      if (thread.phase === "assessment") {
        const sudsMatch = userMessage.match(/\b(\d{1,2})\b/);
        if (sudsMatch) {
          const suds = parseInt(sudsMatch[1], 10);
          if (suds >= 0 && suds <= 10) {
            const updated = await updateThread(threadId, {
              suds,
              phase: "desensitization",
            });
            if (updated) workingThread = updated;
          }
        }
      }
      if (thread.phase === "desensitization") {
        const sudsMatch = userMessage.match(/\b(\d{1,2})\b/);
        if (sudsMatch) {
          const suds = parseInt(sudsMatch[1], 10);
          if (suds >= 0 && suds <= 1) {
            const updated = await updateThread(threadId, {
              suds,
              phase: "installation",
            });
            if (updated) workingThread = updated;
          } else if (suds >= 0 && suds <= 10) {
            const updated = await updateThread(threadId, { suds });
            if (updated) workingThread = updated;
          }
        }
      }
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
        workingThread.agentLanguage
      ) +
      (adminNotes
        ? `\n\nAdmin protocol notes (platform):\n${adminNotes.slice(0, 4000)}`
        : "") +
      (interpretation
        ? `\n\n${interpretationContextBlock(interpretation)}`
        : "") +
      `\n\nSet state for this thread (the app runs the sets, you do not see them):\n- sets completed: ${workingThread.setCount ?? 0}\n- last set: ${workingThread.lastSetOutcome ?? "none yet"}\nA "stopped" last set means the person was interrupted or cut it short, so nothing was processed: the same set is repeated, and you do not read SUDs or VoC from it.`;

    const messages = [
      {
        role: "system" as const,
        content: system,
      },
      ...(await listMessages(threadId))
        .filter((m) => !isStaleFallbackMessage(m.content))
        .map((m) => ({
          role: (m.role === "agent" ? "assistant" : "user") as
            | "assistant"
            | "user",
          content: m.content,
        })),
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
      const text = reply.trim();
      if (!text) {
        throw new Error("Empty LLM reply");
      }
      const agentMsg = await addMessage(threadId, "agent", text);
      const fresh = await getThread(threadId);

      return NextResponse.json({
        message: agentMsg,
        thread: fresh,
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
          ? "Let's pause and ground. Cross your arms for a butterfly hug, or picture your safe place. When you feel steadier, tell me what you notice. If you are in crisis, please seek professional or emergency help."
          : localizedCheckIn
            ? setLine
            : guidedFallbackReply(workingThread.phase, userMessage);
      const agentMsg = await addMessage(threadId, "agent", fallback);
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
