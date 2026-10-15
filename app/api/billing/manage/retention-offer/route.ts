import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";
import {
  isSubscriptionCancelReasonId,
  type SubscriptionCancelReasonId,
} from "@/lib/subscription-cancel-reasons";
import {
  applyRetentionDiscount,
  halfDisplayPrice,
  recordRetentionEvent,
  retentionOfferEligible,
  RETENTION_DISCOUNT_PERCENT,
  RETENTION_ELIGIBLE_PLAN,
} from "@/lib/subscription-retention";
import { loadBillingManageSnapshot } from "@/lib/billing-manage-server";
import { getStripeConfig, resolveBillingPlans } from "@/lib/stripe";

type Body = {
  action?: unknown;
  reasons?: unknown;
  comment?: unknown;
};

function parseReasons(raw: unknown): SubscriptionCancelReasonId[] {
  if (!Array.isArray(raw)) return [];
  const out: SubscriptionCancelReasonId[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isSubscriptionCancelReasonId(item)) {
      if (!out.includes(item)) out.push(item);
    }
  }
  return out;
}

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const sub = await getSubscriptionByUserId(auth.user.id);
  const stripeCfg = await getStripeConfig();
  const plans = resolveBillingPlans(stripeCfg);
  const displayPrice = plans.monthly?.displayPrice ?? "$14.99";

  return NextResponse.json({
    percentOff: RETENTION_DISCOUNT_PERCENT,
    eligiblePlan: RETENTION_ELIGIBLE_PLAN,
    displayPrice,
    discountedPrice: halfDisplayPrice(displayPrice),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "offered" && action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const reasonIds = parseReasons(body.reasons);
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : null;

  const sub = await getSubscriptionByUserId(auth.user.id);
  const plan = sub?.plan ?? "free";

  if (action === "offered") {
    const eligible = await retentionOfferEligible({
      userId: auth.user.id,
      plan,
      reasonIds,
    });
    if (!eligible) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    await recordRetentionEvent({
      userId: auth.user.id,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
      plan,
      action: "offered",
      reasonIds,
      comment,
    });
    return NextResponse.json({ ok: true });
  }

  const eligible = await retentionOfferEligible({
    userId: auth.user.id,
    plan,
    reasonIds,
  });
  if (!eligible && action === "accept") {
    return NextResponse.json(
      { error: "This offer is not available" },
      { status: 400 }
    );
  }

  if (action === "accept") {
    const applied = await applyRetentionDiscount({ userId: auth.user.id });
    if (!applied.ok) {
      return NextResponse.json({ error: applied.error }, { status: 500 });
    }
    await recordRetentionEvent({
      userId: auth.user.id,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
      plan,
      action: "accepted",
      reasonIds,
      comment,
    });
    const snapshot = await loadBillingManageSnapshot(auth.user.id);
    return NextResponse.json({
      ok: true,
      manage: snapshot.ok ? snapshot.snapshot : null,
    });
  }

  await recordRetentionEvent({
    userId: auth.user.id,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    plan,
    action: "declined",
    reasonIds,
    comment,
  });
  return NextResponse.json({ ok: true });
}
