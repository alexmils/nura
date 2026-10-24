import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
  requirePlatformAdminWrite,
} from "@/lib/api-auth";
import {
  createReactivationOffer,
  listReactivationCandidates,
  markReactivationSent,
} from "@/lib/reactivation";
import { reactivationLink } from "@/lib/reactivation-rules";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { writeAuditEvent } from "@/lib/audit-log";
import {
  generateUserWinback,
  getUserWinback,
  sendUserWinbackEmail,
  WinbackError,
} from "@/lib/winback-email";

/**
 * Win-back candidates: guided mode, zero sets, no longer paying.
 * ?userId=... -> that person's win-back status + sent emails (user page).
 */
export async function GET(request: Request) {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;
  const userId = new URL(request.url).searchParams.get("userId");
  try {
    if (userId) {
      const winback = await getUserWinback(userId);
      if (!winback) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ winback });
    }
    return NextResponse.json({ candidates: await listReactivationCandidates() });
  } catch (err) {
    console.error("[admin/reactivation]", err);
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }
}

/**
 * { action: "generate", userId } -> fresh link (replaces an unused old one).
 * { action: "mark_sent", offerId } -> status "sent" (set when the link is copied).
 * The raw link is only returned here, once; the database keeps a hash.
 */
export async function POST(request: Request) {
  const auth = await requirePlatformAdminWrite();
  if (!isAuthContext(auth)) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    userId?: string;
    offerId?: string;
    subject?: string;
    body?: string;
  };
  try {
    if (body.action === "generate" && typeof body.userId === "string") {
      // One free month per person: a redeemed link is final.
      const eligible = (await listReactivationCandidates()).some(
        (c) => c.userId === body.userId && c.linkStatus !== "used"
      );
      if (!eligible) {
        return NextResponse.json({ error: "User is not eligible" }, { status: 400 });
      }
      const { token, offer } = await createReactivationOffer({
        userId: body.userId,
        createdBy: auth.user.id,
        source: "winback_tab",
      });
      await writeAuditEvent({
        actorUserId: auth.user.id,
        targetUserId: body.userId,
        action: "reactivation.link_generated",
        detail: { offerId: offer.id, plan: offer.plan, expiresAt: offer.expiresAt },
      }).catch(() => {});
      return NextResponse.json({
        link: reactivationLink(await getPublicAppUrl(), token),
        offer,
      });
    }
    // Admin single-user page: any person (admin decision), one redemption each.
    if (body.action === "user_generate" && typeof body.userId === "string") {
      return NextResponse.json(await generateUserWinback({ userId: body.userId, actorUserId: auth.user.id }));
    }
    if (body.action === "user_send" && typeof body.userId === "string") {
      const winback = await sendUserWinbackEmail({
        userId: body.userId,
        subject: body.subject,
        body: body.body,
        actorUserId: auth.user.id,
      });
      return NextResponse.json({ ok: true, winback });
    }
    if (body.action === "mark_sent" && typeof body.offerId === "string") {
      await markReactivationSent(body.offerId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof WinbackError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/reactivation] POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
