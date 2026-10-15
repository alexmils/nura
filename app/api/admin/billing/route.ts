import { NextResponse } from "next/server";
import {
  requireAdminAccess,
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import { listAdminBilling } from "@/lib/stripe-admin";
import {
  getPlatformSettings,
  savePlatformSettings,
} from "@/lib/platform-settings";
import { resetStripeClient } from "@/lib/stripe";
import {
  mergeStripeConfigPatch,
  stripeAdminStatus,
  toStripeAdminView,
  type StripeConfigPatch,
} from "@/lib/stripe-admin-settings";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import { getRetentionOfferStats } from "@/lib/subscription-retention";

export async function GET() {
  const auth = await requireAdminAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const [rows, settings, retentionStats] = await Promise.all([
      listAdminBilling(),
      getPlatformSettings(),
      getRetentionOfferStats(),
    ]);
    const canEdit = auth.user.role === "platform_admin";
    const status = stripeAdminStatus(settings.stripe);
    return NextResponse.json({
      rows,
      stripeConfigured: status.stripeConfigured,
      catalogReady: status.catalogReady,
      webhookReady: status.webhookReady,
      demoMode: status.demoMode,
      activeEnv: status.activeEnv,
      stripe: toStripeAdminView(settings.stripe, canEdit),
      canEdit,
      retentionStats,
    });
  } catch (err) {
    console.error("[admin/billing]", err);
    return NextResponse.json({ error: "Failed to load billing" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const body = (await request.json()) as { stripe?: StripeConfigPatch };
    if (!body.stripe || typeof body.stripe !== "object") {
      return NextResponse.json({ error: "Missing stripe settings" }, { status: 400 });
    }
    const current = await getPlatformSettings();
    const merged = mergeStripeConfigPatch(current.stripe, body.stripe);
    const next = await savePlatformSettings({
      ...current,
      stripe: merged,
    });
    resetStripeClient();

    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "settings.stripe_updated",
      detail: {
        demoMode: next.stripe.demoMode,
        sandboxHasSecret: Boolean(next.stripe.sandbox.secretKey),
        liveHasSecret: Boolean(next.stripe.live.secretKey),
        sandboxPrices: {
          weekly: next.stripe.sandbox.priceIdWeekly || null,
          monthly: next.stripe.sandbox.priceIdMonthly || null,
          yearly: next.stripe.sandbox.priceIdYearly || null,
        },
        livePrices: {
          weekly: next.stripe.live.priceIdWeekly || null,
          monthly: next.stripe.live.priceIdMonthly || null,
          yearly: next.stripe.live.priceIdYearly || null,
        },
      },
      ip: clientIp(request),
    });

    const status = stripeAdminStatus(next.stripe);
    return NextResponse.json({
      stripe: toStripeAdminView(next.stripe, true),
      stripeConfigured: status.stripeConfigured,
      catalogReady: status.catalogReady,
      webhookReady: status.webhookReady,
      demoMode: status.demoMode,
      activeEnv: status.activeEnv,
    });
  } catch (err) {
    console.error("[admin/billing PUT]", err);
    return NextResponse.json({ error: "Failed to save Stripe settings" }, { status: 500 });
  }
}
