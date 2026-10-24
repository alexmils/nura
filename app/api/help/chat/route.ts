import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/users";
import { clientIp } from "@/lib/audit-log";
import {
  addHelpMessage,
  countGuestThreadsByIpHashLastHour,
  countGuestUserMessagesByIpHashLastHour,
  countGuestUserMessagesLastHour,
  findOpenGuestThread,
  getHelpSettings,
  getOrCreateGuestThread,
  getOrCreateOpenThread,
  listUserMessages,
  markThreadReadByUser,
} from "@/lib/help-db";
import { toPublicHelpThread } from "@/lib/help-format";
import { buildHelpAiMessages } from "@/lib/help-rag";
import { chatCompletion } from "@/lib/llm";
import { getLlmRuntimeConfig } from "@/lib/platform-settings";
import { notifyAdminsOfHelpMessage } from "@/lib/help-notify";
import {
  applyVisitorCookie,
  GUEST_HELP_MSG_LIMIT_PER_HOUR,
  GUEST_HELP_MSG_LIMIT_PER_IP_HOUR,
  GUEST_HELP_THREADS_PER_IP_HOUR,
  hashIp,
  mintVisitorKey,
  readVisitorKeyFromCookies,
} from "@/lib/help-visitor";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { getPool } from "@/lib/db";
import { noteHelpChatProblem } from "@/lib/help-problem-report";

async function resolveHelpActor(): Promise<
  | { kind: "user"; userId: string; email: string }
  | { kind: "admin"; message: string }
  | { kind: "disabled"; message: string }
  | { kind: "guest" }
> {
  const session = await getSession();
  if (!session) return { kind: "guest" };
  const user = await getUserById(session.sub);
  if (!user) return { kind: "guest" };
  if (user.status === "disabled") {
    return {
      kind: "disabled",
      message: "This account is disabled.",
    };
  }
  if (user.role === "user") {
    return { kind: "user", userId: user.id, email: user.email };
  }
  if (user.role === "platform_admin" || user.role === "support") {
    return {
      kind: "admin",
      message: "Use Admin → Help for support replies.",
    };
  }
  return { kind: "guest" };
}

export async function GET() {
  const settings = await getHelpSettings();
  if (!settings.enabled) {
    return NextResponse.json(
      { error: "Help chat is disabled", enabled: false },
      { status: 503 }
    );
  }

  const actor = await resolveHelpActor();
  if (actor.kind === "admin" || actor.kind === "disabled") {
    return NextResponse.json({ error: actor.message }, { status: 403 });
  }

  if (actor.kind === "user") {
    const thread = await getOrCreateOpenThread(actor.userId);
    const messages = await listUserMessages(thread.id);
    await markThreadReadByUser(thread.id, actor.userId);
    return NextResponse.json({
      enabled: true,
      mode: "user",
      welcomeMessage: settings.welcomeMessage,
      thread: toPublicHelpThread(thread),
      messages,
      hasContact: true,
    });
  }

  // Guest: mint cookie if needed, but do not create a DB thread until first message.
  let visitorKey = await readVisitorKeyFromCookies();
  const minted = !visitorKey;
  if (!visitorKey) visitorKey = mintVisitorKey();

  const thread = await findOpenGuestThread(visitorKey);
  const messages = thread ? await listUserMessages(thread.id) : [];
  const out = NextResponse.json({
    enabled: true,
    mode: "guest" as const,
    welcomeMessage: settings.welcomeMessage,
    thread: thread ? toPublicHelpThread(thread) : null,
    messages,
    hasContact: Boolean(thread?.guestEmail),
    guestName: thread?.guestName ?? null,
    guestEmail: thread?.guestEmail ?? null,
  });
  if (minted) applyVisitorCookie(out, visitorKey);
  return out;
}

export async function POST(request: Request) {
  const settings = await getHelpSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Help chat is disabled" }, { status: 503 });
  }

  const actor = await resolveHelpActor();
  if (actor.kind === "admin" || actor.kind === "disabled") {
    return NextResponse.json({ error: actor.message }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const text =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!text || text.length > 4000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  if (actor.kind === "user") {
    return handleUserPost({
      userId: actor.userId,
      email: actor.email,
      text,
      settings,
    });
  }

  const gate = await verifyTurnstileToken({
    token: extractTurnstileToken(body),
    expectedAction: "help-guest",
    remoteip: clientIp(request),
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let visitorKey = await readVisitorKeyFromCookies();
  const minted = !visitorKey;
  if (!visitorKey) visitorKey = mintVisitorKey();

  const ipHash = hashIp(clientIp(request));
  if (ipHash) {
    const threadsFromIp = await countGuestThreadsByIpHashLastHour(ipHash);
    const existing = await findOpenGuestThread(visitorKey);
    if (!existing && threadsFromIp >= GUEST_HELP_THREADS_PER_IP_HOUR) {
      return NextResponse.json(
        { error: "Too many chats from this network. Try again later." },
        { status: 429 }
      );
    }
    const msgsFromIp = await countGuestUserMessagesByIpHashLastHour(ipHash);
    if (msgsFromIp >= GUEST_HELP_MSG_LIMIT_PER_IP_HOUR) {
      return NextResponse.json(
        { error: "Too many messages. Try again in a bit." },
        { status: 429 }
      );
    }
  }

  const thread = await getOrCreateGuestThread(visitorKey, { ipHash });
  if (ipHash) {
    await getPool().query(
      `UPDATE help_threads SET guest_ip_hash = COALESCE(guest_ip_hash, $2)
       WHERE id = $1`,
      [thread.id, ipHash]
    );
  }

  const recent = await countGuestUserMessagesLastHour(thread.id);
  if (recent >= GUEST_HELP_MSG_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: "Too many messages. Try again in a bit." },
      { status: 429 }
    );
  }

  const history = await listUserMessages(thread.id);
  const userMsg = await addHelpMessage({
    threadId: thread.id,
    role: "user",
    content: text,
    authorUserId: null,
    forAdminUnread: true,
  });

  const fromLabel =
    thread.guestEmail?.trim() ||
    thread.guestName?.trim() ||
    `guest:${visitorKey.slice(0, 8)}`;

  const priorUserMessageCount = history.filter((m) => m.role === "user").length;
  void notifyAdminsOfHelpMessage({
    fromLabel,
    preview: text.slice(0, 200),
    threadId: thread.id,
    priorUserMessageCount,
    ipHash,
    sendEmailEnabled: settings.notifyAdminsByEmail,
  }).catch((err) => console.error("[help/notify]", err));

  const assistantMsg = await maybeAiReply({
    threadId: thread.id,
    history,
    text,
    userId: null,
    settings,
  });

  const messages = await listUserMessages(thread.id);
  const out = NextResponse.json({
    mode: "guest",
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    messages,
    hasContact: Boolean(thread.guestEmail),
  });
  if (minted) applyVisitorCookie(out, visitorKey);
  return out;
}

async function handleUserPost(input: {
  userId: string;
  email: string;
  text: string;
  settings: Awaited<ReturnType<typeof getHelpSettings>>;
}) {
  const thread = await getOrCreateOpenThread(input.userId);
  const history = await listUserMessages(thread.id);

  const userMsg = await addHelpMessage({
    threadId: thread.id,
    role: "user",
    content: input.text,
    authorUserId: input.userId,
    forAdminUnread: true,
  });
  // "The app isn't working" -> problem report for this account (source help_chat).
  const problemAck = await noteHelpChatProblem({
    userId: input.userId,
    helpThreadId: thread.id,
    text: input.text,
  });

  const priorUserMessageCount = history.filter((m) => m.role === "user").length;
  void notifyAdminsOfHelpMessage({
    fromLabel: input.email,
    preview: input.text.slice(0, 200),
    threadId: thread.id,
    priorUserMessageCount,
    ipHash: null,
    sendEmailEnabled: input.settings.notifyAdminsByEmail,
  }).catch((err) => console.error("[help/notify]", err));

  const assistantMsg = await maybeAiReply({
    threadId: thread.id,
    history,
    text: input.text,
    userId: input.userId,
    settings: input.settings,
    ackLine: problemAck?.ackLine ?? null,
  });

  const messages = await listUserMessages(thread.id);
  return NextResponse.json({
    mode: "user",
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    messages,
    hasContact: true,
  });
}

async function maybeAiReply(input: {
  threadId: string;
  history: Awaited<ReturnType<typeof listUserMessages>>;
  text: string;
  userId: string | null;
  settings: Awaited<ReturnType<typeof getHelpSettings>>;
  /** Problem-report confirmation, added after the reply in the user's language. */
  ackLine?: string | null;
}) {
  const withAck = (content: string) => (input.ackLine ? `${content}\n\n${input.ackLine}` : content);
  if (!input.settings.aiFirstReply) {
    if (!input.ackLine) return null;
    return addHelpMessage({
      threadId: input.threadId,
      role: "assistant",
      content: input.ackLine,
      forUserUnread: false,
    });
  }
  try {
    const llm = await getLlmRuntimeConfig();
    const messages = await buildHelpAiMessages({
      history: input.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      latestUserMessage: input.text,
    });
    const reply = (
      await chatCompletion(llm, messages, {
        userId: input.userId ?? undefined,
        purpose: "help",
        provider: input.settings.aiProvider || null,
        model: input.settings.aiModel || null,
      })
    ).trim();
    if (!reply && !input.ackLine) return null;
    return addHelpMessage({
      threadId: input.threadId,
      role: "assistant",
      content: reply ? withAck(reply) : input.ackLine!,
      forUserUnread: false,
    });
  } catch (err) {
    console.error("[help/ai]", err);
    return addHelpMessage({
      threadId: input.threadId,
      role: "assistant",
      content: withAck(
        "Thanks — I couldn’t generate an automatic reply right now. A teammate will follow up soon."
      ),
    });
  }
}
