import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReactivationCheckoutParams,
  toElementsReactivationParams,
  firstChargeDate,
  hashReactivationToken,
  isPlausibleReactivationToken,
  isReactivationCandidate,
  newReactivationToken,
  oldSubscriptionAction,
  previousPlan,
  reactivationExpiry,
  reactivationLink,
  reactivationLinkStatus,
  reactivationState,
  REACTIVATION_TRIAL_DAYS,
} from "../lib/reactivation-rules.ts";
import { buildEntitlementSnapshot } from "../lib/entitlements.ts";
import { mapStripeSubscription } from "../lib/stripe-admin.ts";
import { isUnauthenticatedPublicPath } from "../lib/public-paths.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-23T12:00:00Z");

describe("reactivation token", () => {
  it("is 256-bit url-safe random, hashed for storage", () => {
    const a = newReactivationToken();
    const b = newReactivationToken();
    assert.notEqual(a, b);
    assert.equal(a.length, 43);
    assert.ok(isPlausibleReactivationToken(a));
    assert.match(hashReactivationToken(a), /^[0-9a-f]{64}$/);
    assert.equal(hashReactivationToken(a), hashReactivationToken(` ${a} `));
    assert.notEqual(hashReactivationToken(a), hashReactivationToken(b));
  });
  it("rejects short, tampered or odd tokens before any lookup", () => {
    assert.equal(isPlausibleReactivationToken("short"), false);
    assert.equal(isPlausibleReactivationToken("x".repeat(40) + "<>"), false);
    assert.equal(isPlausibleReactivationToken(undefined), false);
  });
  it("expires after 30 days and builds the public link", () => {
    assert.equal(reactivationExpiry(now).getTime() - now.getTime(), 30 * DAY);
    assert.equal(
      reactivationLink("https://nurahelp.com/", "abc_DEF-123"),
      "https://nurahelp.com/reactivate?token=abc_DEF-123"
    );
  });
});

describe("reactivationState", () => {
  const offer = { expiresAt: new Date(now.getTime() + DAY), usedAt: null };
  it("valid while open", () => {
    assert.equal(reactivationState({ offer, now }), "valid");
  });
  it("unknown token is invalid", () => {
    assert.equal(reactivationState({ offer: null, now }), "invalid");
  });
  it("single use: a consumed offer is used", () => {
    assert.equal(reactivationState({ offer: { ...offer, usedAt: now }, now }), "used");
  });
  it("expired after expiresAt", () => {
    assert.equal(
      reactivationState({ offer, now: new Date(now.getTime() + 2 * DAY) }),
      "expired"
    );
  });
  it("paying member is not handed a free month; a scheduled cancel still is", () => {
    assert.equal(
      reactivationState({ offer, now, subscription: { status: "active", cancelAtPeriodEnd: false } }),
      "already_active"
    );
    assert.equal(
      reactivationState({ offer, now, subscription: { status: "trialing", cancelAtPeriodEnd: true } }),
      "valid"
    );
    assert.equal(
      reactivationState({ offer, now, subscription: { status: "past_due" } }),
      "valid"
    );
  });
});

describe("buildReactivationCheckoutParams", () => {
  const p = buildReactivationCheckoutParams({
    userId: "u1",
    email: "a@example.com",
    plan: "weekly",
    priceId: "price_weekly",
    customerId: "cus_existing",
    offerId: "off_1",
    token: "tok_abc",
    baseUrl: "https://nurahelp.com",
  });
  it("is a subscription checkout on the existing customer with the previous price", () => {
    assert.equal(p.mode, "subscription");
    assert.equal(p.customer, "cus_existing");
    assert.deepEqual(p.line_items, [{ price: "price_weekly", quantity: 1 }]);
    assert.equal(p.client_reference_id, "u1");
    assert.equal(p.payment_method_collection, "always");
  });
  it("has a 30-day trial (no charge today) tagged as reactivation", () => {
    assert.equal(p.subscription_data?.trial_period_days, 30);
    assert.equal(REACTIVATION_TRIAL_DAYS, 30);
    assert.equal(p.subscription_data?.metadata?.nura_trial_kind, "reactivation");
    assert.equal(p.subscription_data?.metadata?.reactivation_offer_id, "off_1");
    assert.equal(p.metadata?.reactivation_offer_id, "off_1");
  });
  it("returns to /reactivate with the session id", () => {
    assert.equal(
      p.success_url,
      "https://nurahelp.com/reactivate?token=tok_abc&status=success&session_id={CHECKOUT_SESSION_ID}"
    );
    assert.equal(p.cancel_url, "https://nurahelp.com/reactivate?token=tok_abc&status=canceled");
  });
  it("on-site payment form: same session, returns to the success URL", () => {
    const e = toElementsReactivationParams(p) as Record<string, unknown>;
    assert.equal(e.ui_mode, "elements");
    assert.equal(
      e.return_url,
      "https://nurahelp.com/reactivate?token=tok_abc&status=success&session_id={CHECKOUT_SESSION_ID}"
    );
    assert.equal(e.success_url, undefined);
    assert.equal(e.cancel_url, undefined);
    assert.deepEqual(e.subscription_data, p.subscription_data);
    assert.deepEqual(e.metadata, p.metadata);
  });
  it("first charge is 30 days out (or Stripe's trial_end)", () => {
    assert.equal(firstChargeDate(null, now).getTime() - now.getTime(), 30 * DAY);
    assert.equal(firstChargeDate(1793000000, now).getTime(), 1793000000 * 1000);
  });
});

describe("previous plan + old subscription", () => {
  const ids = { weekly: "price_w", yearly: "price_y", monthly: "price_m" };
  it("maps the old price to the plan; falls back to yearly", () => {
    assert.equal(previousPlan({ stripePriceId: "price_w" }, ids), "weekly");
    assert.equal(previousPlan({ stripePriceId: "price_y", plan: "free" }, ids), "yearly");
    assert.equal(previousPlan({ stripePriceId: null, plan: "free" }, ids), "yearly");
    assert.equal(previousPlan({ stripePriceId: "price_other", plan: "weekly" }, ids), "weekly");
  });
  it("retires past_due / unpaid / scheduled-cancel subs, leaves canceled ones", () => {
    assert.equal(oldSubscriptionAction("past_due"), "cancel_and_void");
    assert.equal(oldSubscriptionAction("unpaid"), "cancel_and_void");
    assert.equal(oldSubscriptionAction("trialing"), "cancel_and_void");
    assert.equal(oldSubscriptionAction("canceled"), "none");
    assert.equal(oldSubscriptionAction(null), "none");
  });
});

describe("entitlement during the win-back trial", () => {
  const base = {
    role: "user" as const,
    onboardingCompletedAt: "2026-09-01T00:00:00Z",
    plan: "weekly",
    status: "trialing",
    accessTier: "trialing",
    trialEndsAt: new Date(now.getTime() + 30 * DAY).toISOString(),
    renewsAt: new Date(now.getTime() + 30 * DAY).toISOString(),
    guidedUsed: 3,
    blsSecondsUsed: 900,
    now,
  };
  it("grants full access with no trial caps", () => {
    const e = buildEntitlementSnapshot({ ...base, trialKind: "reactivation" });
    assert.equal(e.canUseApp, true);
    assert.equal(e.accessTier, "trialing");
    assert.equal(e.isTrialLimited, false);
    assert.equal(e.guidedRemaining, -1);
  });
  it("a normal trial keeps its 3-session cap", () => {
    const e = buildEntitlementSnapshot({ ...base });
    assert.equal(e.isTrialLimited, true);
    assert.equal(e.guidedRemaining, 0);
  });
  it("ends when the trial ends without payment", () => {
    const e = buildEntitlementSnapshot({
      ...base,
      trialKind: "reactivation",
      now: new Date(now.getTime() + 31 * DAY),
    });
    assert.equal(e.canUseApp, false);
  });
  it("mapStripeSubscription carries the trial kind from metadata", () => {
    const m = mapStripeSubscription(
      {
        id: "sub_1",
        status: "trialing",
        customer: "cus_1",
        items: { data: [{ price: { id: "price_w", unit_amount: 499, currency: "eur" } }] },
        trial_end: 1793000000,
        metadata: { nura_trial_kind: "reactivation" },
      },
      { weekly: "price_w" }
    );
    assert.equal(m.trialKind, "reactivation");
    assert.equal(m.plan, "weekly");
    assert.equal(m.status, "trialing");
  });
});

describe("eligibility", () => {
  const row = {
    role: "user",
    guidedThreads: 1,
    guidedSessionsUsed: 1,
    totalGuidedSets: 0,
    status: "canceled",
    accessTier: "none",
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    now,
  };
  it("guided, zero sets, not paying", () => {
    assert.equal(isReactivationCandidate(row), true);
    assert.equal(isReactivationCandidate({ ...row, status: "past_due" }), true);
    assert.equal(isReactivationCandidate({ ...row, status: "trialing", cancelAtPeriodEnd: true }), true);
    assert.equal(
      isReactivationCandidate({ ...row, status: "trialing", trialEndsAt: new Date(now.getTime() - DAY) }),
      true
    );
  });
  it("threads deleted but guided sessions were used still counts", () => {
    assert.equal(isReactivationCandidate({ ...row, guidedThreads: 0, guidedSessionsUsed: 2 }), true);
  });
  it("excludes people who got a set, who pay, admins, and free-only users", () => {
    assert.equal(isReactivationCandidate({ ...row, totalGuidedSets: 2 }), false);
    assert.equal(isReactivationCandidate({ ...row, status: "active" }), false);
    assert.equal(isReactivationCandidate({ ...row, role: "platform_admin" }), false);
    assert.equal(isReactivationCandidate({ ...row, guidedThreads: 0, guidedSessionsUsed: 0 }), false);
  });
  it("link status for the admin list", () => {
    const o = { createdAt: now, expiresAt: new Date(now.getTime() + DAY), sentAt: null, openedAt: null, usedAt: null };
    assert.equal(reactivationLinkStatus(null, now), "none");
    assert.equal(reactivationLinkStatus(o, now), "generated");
    assert.equal(reactivationLinkStatus({ ...o, sentAt: now }, now), "sent");
    assert.equal(reactivationLinkStatus({ ...o, sentAt: now, openedAt: now }, now), "opened");
    assert.equal(reactivationLinkStatus({ ...o, usedAt: now }, now), "used");
    assert.equal(reactivationLinkStatus(o, new Date(now.getTime() + 2 * DAY)), "expired");
  });
});

describe("routing", () => {
  it("the offer page and its checkout API are reachable without a session", () => {
    assert.equal(isUnauthenticatedPublicPath("/reactivate"), true);
    assert.equal(isUnauthenticatedPublicPath("/api/reactivate/checkout"), true);
    assert.equal(isUnauthenticatedPublicPath("/api/admin/reactivation"), false);
  });
});
