import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
} from "@/lib/api-auth";
import {
  countUnreadFeedback,
  listFeedbackResponses,
  markAllFeedbackSeen,
  setFeedbackFeatured,
  setFeedbackPublished,
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
  };

  if (body.action === "mark_seen") {
    await markAllFeedbackSeen();
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
