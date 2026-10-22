import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
} from "@/lib/api-auth";
import {
  countUnreadFeedback,
  deleteFeedbackResponse,
  listFeedbackResponses,
  markAllFeedbackSeen,
  setFeedbackFeatured,
  setFeedbackPublished,
  updateFeedbackResponse,
} from "@/lib/feedback-db";

export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("view") === "unread") {
    return NextResponse.json({ unread: await countUnreadFeedback() });
  }

  const items = await listFeedbackResponses();
  const unread = await countUnreadFeedback();
  return NextResponse.json({ items, unread });
}

export async function POST(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
    published?: boolean;
    featured?: boolean;
    score?: number;
    comment?: string | null;
  };

  if (body.action === "mark_seen") {
    await markAllFeedbackSeen();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update") {
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "Missing review id" }, { status: 400 });
    }
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json({ error: "Score must be 1–10" }, { status: 400 });
    }
    const comment =
      typeof body.comment === "string"
        ? body.comment.trim().slice(0, 2000) || null
        : null;
    const item = await updateFeedbackResponse(body.id, { score, comment });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  }

  if (body.action === "delete") {
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "Missing review id" }, { status: 400 });
    }
    const removed = await deleteFeedbackResponse(body.id);
    if (!removed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "publish" || body.action === "feature") {
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "Missing review id" }, { status: 400 });
    }
    const item =
      body.action === "publish"
        ? await setFeedbackPublished(body.id, Boolean(body.published))
        : await setFeedbackFeatured(body.id, Boolean(body.featured));
    if (!item) {
      return NextResponse.json(
        { error: "Review not found, or not publishable" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, item });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
