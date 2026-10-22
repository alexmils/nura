import { NextResponse } from "next/server";
import { isAuthContext, requireAuth } from "@/lib/api-auth";
import { parseFeedbackSubmitSource } from "@/lib/feedback-eligibility";
import {
  getFeedbackPageState,
  getFeedbackPromptForUser,
  markFeedbackSessionEnd,
  recordFeedbackShown,
  snoozeFeedbackPrompt,
  submitFeedbackResponse,
} from "@/lib/feedback-db";
import { isValidFeedbackScore } from "@/lib/feedback";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const fromEmail =
    source === "trial" || source === "review" || source === "review_email";

  const page = await getFeedbackPageState({
    userId: auth.user.id,
    userCreatedAt: auth.user.createdAt,
    allowTrialLink: fromEmail,
  });

  const prompt = await getFeedbackPromptForUser({
    userId: auth.user.id,
    userCreatedAt: auth.user.createdAt,
  });

  return NextResponse.json({ ...page, show: prompt.show, source: prompt.source });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    score?: number;
    comment?: string | null;
    source?: string;
  };

  if (body.action === "session_end") {
    const result = await markFeedbackSessionEnd(auth.user.id);
    return NextResponse.json(result);
  }

  if (body.action === "snooze") {
    await snoozeFeedbackPrompt(auth.user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "shown") {
    await recordFeedbackShown(auth.user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "submit") {
    if (!isValidFeedbackScore(body.score)) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }
    const sourceOverride = parseFeedbackSubmitSource(body.source);
    const allowTrialLink =
      sourceOverride === "trial_end_email" ||
      sourceOverride === "review_email";
    const result = await submitFeedbackResponse({
      userId: auth.user.id,
      userCreatedAt: auth.user.createdAt,
      score: body.score,
      comment: body.comment,
      sourceOverride,
      allowTrialLink,
    });
    if (!result.ok) {
      const status =
        result.error === "already_submitted"
          ? 409
          : result.error === "not_eligible"
            ? 403
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, feedback: result.feedback });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
