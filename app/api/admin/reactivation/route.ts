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

/** Win-back candidates: guided mode, zero sets, no longer paying. */
export async function GET() {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;
  try {
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
    if (body.action === "mark_sent" && typeof body.offerId === "string") {
      await markReactivationSent(body.offerId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[admin/reactivation] POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
