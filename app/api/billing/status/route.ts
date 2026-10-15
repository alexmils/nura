import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  getEntitlementForUser,
  publicEntitlement,
} from "@/lib/entitlements";
import {
  getStripeConfig,
  isStripeConfigured,
  resolveBillingPlans,
  resolveStripeClient,
} from "@/lib/stripe";
import {
  getSubscriptionByUserId,
  syncSubscriptionFromStripe,
  mapStripeSubscriptionWithConfig,
} from "@/lib/stripe-admin";
import { runCheckoutTrialEffects } from "@/lib/checkout-trial-effects";
import { markOnboardingCompleted } from "@/lib/users";
import { getPlatformSettings } from "@/lib/platform-settings";
import { publicAdsConfig } from "@/lib/ads";
import { shouldApplyCheckoutSessionSync } from "@/lib/checkout-rules";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  // Verify Checkout success server-side when returning from Stripe.
  if (sessionId) {
    const resolved = await resolveStripeClient({ objectId: sessionId });
    if (resolved) {
      try {
        const session = await resolved.stripe.checkout.sessions.retrieve(
          sessionId,
          { expand: ["subscription"] }
        );
        const metaUser =
          session.client_reference_id ||
          session.metadata?.user_id ||
          null;
        if (metaUser === auth.user.id && session.subscription) {
          const subObj =
            typeof session.subscription === "string"
              ? await resolved.stripe.subscriptions.retrieve(
                  session.subscription
                )
              : session.subscription;
          const existing = await getSubscriptionByUserId(auth.user.id);
          if (
            shouldApplyCheckoutSessionSync({
              existingSubscriptionId: existing?.stripe_subscription_id,
              existingStatus: existing?.status,
              incomingSubscriptionId: subObj.id,
            })
          ) {
            const mapped = await mapStripeSubscriptionWithConfig(
              subObj,
              resolved.livemode
            );
            const created =
              typeof (subObj as { created?: number }).created === "number"
                ? (subObj as { created: number }).created
                : typeof session.created === "number"
                  ? session.created
                  : undefined;
            await syncSubscriptionFromStripe({
              userId: auth.user.id,
              ...mapped,
              stripeLivemode: resolved.livemode,
              eventCreatedAt: created,
            });
            if (!auth.user.onboardingCompletedAt) {
              await markOnboardingCompleted(auth.user.id);
              auth.user.onboardingCompletedAt = new Date().toISOString();
            }
            const amountCents =
              typeof session.amount_total === "number"
                ? session.amount_total
                : mapped.amountCents ?? 0;
            void runCheckoutTrialEffects({
              userId: auth.user.id,
              dedupStripeEventId: `checkout.sync:${session.id}`,
              mapped,
              sessionAmountCents: amountCents,
              currency: session.currency ?? mapped.currency,
              livemode: resolved.livemode,
              occurredAt: created,
            }).catch((err) =>
              console.error("[billing/status] trial notify", err)
            );
          }
        }
      } catch (err) {
        console.error("[billing/status] session verify", err);
      }
    }
  }

  const entitlement = await getEntitlementForUser({
    userId: auth.user.id,
    role: auth.user.role,
    onboardingCompletedAt: auth.user.onboardingCompletedAt,
  });
  const platform = await getPlatformSettings();
  const pub = publicEntitlement(entitlement);
  const stripeCfg = await getStripeConfig();

  return NextResponse.json({
    ...pub,
    ads: publicAdsConfig(platform.ads, pub.isTrialLimited),
    stripeConfigured: await isStripeConfigured(),
    plans: resolveBillingPlans(stripeCfg),
  });
}
