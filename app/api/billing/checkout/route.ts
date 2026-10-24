import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import { persistAttributionFromCookie } from "@/lib/attribution-server";
import { getPublicAppUrl } from "@/lib/platform-settings";
import {
  isBillingPlanId,
  TRIAL_DAYS,
  type BillingPlanId,
} from "@/lib/billing-constants";
import { activeStripeCredentials } from "@/lib/stripe-config";
import {
  CHECKOUT_ELEMENTS_API_VERSION,
  checkoutReturnPath,
} from "@/lib/checkout-page";
import {
  activeStripeLivemode,
  getStripe,
  getStripeConfig,
  priceIdForPlan,
  resolveBillingPlans,
  resolveStripeClient,
} from "@/lib/stripe";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";
import { getEntitlementForUser } from "@/lib/entitlements";
import {
  hasBlockingStripeSubscription,
  shouldIncludeCheckoutTrial,
} from "@/lib/checkout-rules";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  if (auth.user.role !== "user") {
    return NextResponse.json(
      { error: "Billing is only for regular accounts" },
      { status: 403 }
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured" },
      { status: 503 }
    );
  }

  // Last chance to keep the ad click: the next thing that happens is a redirect
  // to Stripe, and the charge itself lands on their servers days after that.
  await persistAttributionFromCookie(
    auth.user.id,
    request.headers.get("cookie")
  );

  let plan: BillingPlanId = "yearly";
  let source = "billing";
  // "elements" = on-site checkout page (/checkout); default = Stripe-hosted.
  let elements = false;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      plan?: unknown;
      source?: unknown;
      ui?: unknown;
    };
    elements = body.ui === "elements";
    if (body.plan !== undefined) {
      if (!isBillingPlanId(body.plan)) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      plan = body.plan;
    }
    if (typeof body.source === "string") source = body.source;
  } catch {
    /* default yearly */
  }

  const priceId = await priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price for ${plan} is not configured` },
      { status: 503 }
    );
  }

  const stripeConfig = await getStripeConfig();
  const plans = resolveBillingPlans(stripeConfig);
  const publishableKey = activeStripeCredentials(stripeConfig).publishableKey.trim();
  if (elements && !publishableKey) {
    // The page falls back to Stripe-hosted Checkout on this code.
    return NextResponse.json(
      {
        error: "On-site checkout is not configured",
        code: "elements_unavailable",
      },
      { status: 503 }
    );
  }
  const activeLivemode = await activeStripeLivemode();
  const existing = await getSubscriptionByUserId(auth.user.id);
  const storedLivemode = existing?.stripe_livemode ?? null;
  const blockingOnActiveEnv =
    existing?.stripe_subscription_id &&
    (storedLivemode === null || storedLivemode === activeLivemode) &&
    hasBlockingStripeSubscription({
      stripeSubscriptionId: existing.stripe_subscription_id,
      status: existing.status,
    });
  if (blockingOnActiveEnv) {
    const needsPortal =
      existing?.status === "past_due" ||
      existing?.status === "unpaid" ||
      existing?.status === "incomplete" ||
      existing?.status === "trialing";
    return NextResponse.json(
      {
        error: needsPortal
          ? "Update your payment method on Manage billing"
          : "You already have an active subscription",
        code: needsPortal ? "use_portal" : "already_subscribed",
      },
      { status: 409 }
    );
  }

  const entitlement = await getEntitlementForUser({
    userId: auth.user.id,
    role: auth.user.role,
    onboardingCompletedAt: auth.user.onboardingCompletedAt,
  });

  const includeTrial = shouldIncludeCheckoutTrial({
    isTrialLimited: entitlement.isTrialLimited,
    accessTier: entitlement.accessTier,
    guidedUsed: entitlement.guidedUsed,
    status: existing?.status,
    stripeSubscriptionId: existing?.stripe_subscription_id,
  });

  try {
    const baseUrl = await getPublicAppUrl();
    let customerId: string | undefined;

    if (existing?.stripe_customer_id) {
      if (
        typeof storedLivemode === "boolean" &&
        storedLivemode !== activeLivemode
      ) {
        // Opposite Stripe account — create a new customer below.
        customerId = undefined;
      } else if (typeof storedLivemode === "boolean") {
        customerId = existing.stripe_customer_id;
      } else {
        // Legacy row without livemode: only reuse if the id exists on active env.
        const resolved = await resolveStripeClient({
          objectId: existing.stripe_customer_id,
        });
        if (resolved && resolved.livemode === activeLivemode) {
          customerId = existing.stripe_customer_id;
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email,
        name: auth.user.name ?? undefined,
        metadata: { user_id: auth.user.id },
      });
      customerId = customer.id;
      const { syncSubscriptionFromStripe } = await import("@/lib/stripe-admin");
      await syncSubscriptionFromStripe({
        userId: auth.user.id,
        plan: existing?.plan ?? "free",
        status: existing?.status ?? "incomplete",
        amountCents: existing?.amount_cents ?? 0,
        currency: existing?.currency ?? "USD",
        accessTier: existing?.access_tier ?? "none",
        stripeCustomerId: customerId,
        stripeSubscriptionId:
          storedLivemode === activeLivemode
            ? existing?.stripe_subscription_id
            : null,
        stripeLivemode: activeLivemode,
        trialEndsAt: existing?.trial_ends_at
          ? new Date(existing.trial_ends_at).toISOString()
          : null,
      });
    }

    // Members who have not finished onboarding (new accounts made on the
    // checkout page) land on onboarding, which shows the trial welcome.
    const toOnboarding =
      source === "onboarding" || (elements && !auth.user.onboardingCompletedAt);
    const successPath = checkoutReturnPath(
      toOnboarding ? "onboarding" : "billing",
      "success"
    );
    const cancelPath =
      checkoutReturnPath(toOnboarding ? "onboarding" : "billing", "canceled") +
      `&plan=${plan}`;

    const shared: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(includeTrial ? { trial_period_days: TRIAL_DAYS } : {}),
        metadata: {
          user_id: auth.user.id,
          user_email: auth.user.email,
          plan,
        },
      },
      payment_method_collection: "always",
      allow_promotion_codes: true,
      metadata: {
        user_id: auth.user.id,
        plan,
      },
    };

    if (elements) {
      // Checkout Elements: same subscription session (same webhook, trial and
      // entitlement path), rendered on our page. ui_mode "elements" only
      // exists on newer API versions, so this one call overrides the pinned
      // version; stripe-node 17 types predate it, hence the cast.
      const params = {
        ...shared,
        ui_mode: "elements",
        return_url: `${baseUrl}${successPath}`,
      } as unknown as Stripe.Checkout.SessionCreateParams;
      const session = await stripe.checkout.sessions.create(params, {
        apiVersion: CHECKOUT_ELEMENTS_API_VERSION,
      });
      if (!session.client_secret) {
        return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
      }
      return NextResponse.json({
        clientSecret: session.client_secret,
        publishableKey,
        plan,
        planMeta: plans[plan],
        trialDays: includeTrial ? TRIAL_DAYS : 0,
        returnTo: toOnboarding ? "onboarding" : "billing",
      });
    }

    const session = await stripe.checkout.sessions.create({
      ...shared,
      success_url: `${baseUrl}${successPath}`,
      cancel_url: `${baseUrl}${cancelPath}`,
    });

    return NextResponse.json({
      url: session.url,
      plan,
      planMeta: plans[plan],
      trialDays: includeTrial ? TRIAL_DAYS : 0,
    });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
