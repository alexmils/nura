import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEntitlementSnapshot,
  resolveAccessTier,
} from "../lib/entitlements.ts";
import {
  BILLING_PLANS,
  isBillingPlanId,
  TRIAL_BLS_SECONDS,
  TRIAL_GUIDED_SESSIONS,
} from "../lib/billing-constants.ts";

describe("resolveAccessTier", () => {
  it("treats admin roles as legacy", () => {
    assert.equal(
      resolveAccessTier({
        role: "platform_admin",
        onboardingCompletedAt: null,
        accessTier: "none",
        status: "none",
        trialEndsAt: null,
      }),
      "legacy"
    );
  });

  it("returns trialing while trial is active", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    assert.equal(
      resolveAccessTier({
        role: "user",
        onboardingCompletedAt: future,
        accessTier: "trialing",
        status: "trialing",
        trialEndsAt: future,
      }),
      "trialing"
    );
  });

  it("blocks expired trials", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    assert.equal(
      resolveAccessTier({
        role: "user",
        onboardingCompletedAt: past,
        accessTier: "trialing",
        status: "trialing",
        trialEndsAt: past,
      }),
      "blocked"
    );
  });

  it("keeps legacy grandfathered users", () => {
    assert.equal(
      resolveAccessTier({
        role: "user",
        onboardingCompletedAt: new Date().toISOString(),
        accessTier: "legacy",
        status: "legacy",
        trialEndsAt: null,
      }),
      "legacy"
    );
  });
});

describe("buildEntitlementSnapshot", () => {
  it("exposes access end when cancel at period end is set", () => {
    const ends = new Date(Date.now() + 86400000 * 5).toISOString();
    const snap = buildEntitlementSnapshot({
      role: "user",
      onboardingCompletedAt: new Date().toISOString(),
      plan: "weekly",
      status: "trialing",
      accessTier: "trialing",
      trialEndsAt: ends,
      renewsAt: ends,
      cancelAtPeriodEnd: true,
      guidedUsed: 0,
      blsSecondsUsed: 0,
    });
    assert.equal(snap.cancelAtPeriodEnd, true);
    assert.equal(snap.accessEndsAt, ends);
  });

  it("limits trial guided sessions and BLS seconds", () => {
    const snap = buildEntitlementSnapshot({
      role: "user",
      onboardingCompletedAt: new Date().toISOString(),
      plan: "yearly",
      status: "trialing",
      accessTier: "trialing",
      trialEndsAt: new Date(Date.now() + 86400000).toISOString(),
      renewsAt: null,
      guidedUsed: 2,
      blsSecondsUsed: 120,
    });
    assert.equal(snap.isTrialLimited, true);
    assert.equal(snap.guidedRemaining, TRIAL_GUIDED_SESSIONS - 2);
    assert.equal(snap.blsSecondsRemaining, TRIAL_BLS_SECONDS - 120);
    assert.equal(snap.canUseApp, true);
  });

  it("requires onboarding when access is none", () => {
    const snap = buildEntitlementSnapshot({
      role: "user",
      onboardingCompletedAt: null,
      plan: "free",
      status: "none",
      accessTier: "none",
      trialEndsAt: null,
      renewsAt: null,
      guidedUsed: 0,
      blsSecondsUsed: 0,
    });
    assert.equal(snap.needsOnboarding, true);
    assert.equal(snap.canUseApp, false);
  });

  it("does not limit legacy users", () => {
    const snap = buildEntitlementSnapshot({
      role: "user",
      onboardingCompletedAt: new Date().toISOString(),
      plan: "legacy",
      status: "legacy",
      accessTier: "legacy",
      trialEndsAt: null,
      renewsAt: null,
      guidedUsed: 99,
      blsSecondsUsed: 9999,
    });
    assert.equal(snap.isTrialLimited, false);
    assert.equal(snap.guidedRemaining, -1);
    assert.equal(snap.canUseApp, true);
  });

  it("blocks self-serve users with no subscription stub", () => {
    const snap = buildEntitlementSnapshot({
      role: "user",
      onboardingCompletedAt: null,
      plan: "free",
      status: "none",
      accessTier: "none",
      trialEndsAt: null,
      renewsAt: null,
      guidedUsed: 0,
      blsSecondsUsed: 0,
    });
    assert.equal(snap.accessTier, "none");
    assert.equal(snap.needsOnboarding, true);
    assert.equal(snap.canUseApp, false);
  });

  it("blocks canceled subscriptions and requires payment", () => {
    const snap = buildEntitlementSnapshot({
      role: "user",
      onboardingCompletedAt: new Date().toISOString(),
      plan: "free",
      status: "canceled",
      accessTier: "none",
      trialEndsAt: null,
      renewsAt: null,
      guidedUsed: 1,
      blsSecondsUsed: 30,
    });
    assert.equal(snap.accessTier, "blocked");
    assert.equal(snap.canUseApp, false);
    assert.equal(snap.needsPayment, true);
    assert.equal(snap.isTrialLimited, false);
  });
});

describe("billing plan helpers", () => {
  it("validates plan ids and exposes yearly highlight", () => {
    assert.equal(isBillingPlanId("yearly"), true);
    assert.equal(isBillingPlanId("weekly"), true);
    assert.equal(isBillingPlanId("monthly"), true);
    assert.equal(BILLING_PLANS.yearly.highlight, true);
    assert.equal(BILLING_PLANS.weekly.displayPrice, "$4.99");
  });
});
