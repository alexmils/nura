import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingStateCopy,
  deriveBillingState,
  type BillingStateInput,
} from "../lib/billing-access-state.ts";
import { buildEntitlementSnapshot } from "../lib/entitlements.ts";
import {
  isAccessAllowedPath,
  isReachableWithoutAccess,
  resolveAccessRedirect,
} from "../lib/access-gate.ts";

const NOW = new Date("2026-10-23T12:00:00Z");
const PAST = "2026-10-01T00:00:00.000Z";
const FUTURE = "2026-11-20T00:00:00.000Z";

function snap(over: Partial<Parameters<typeof buildEntitlementSnapshot>[0]>) {
  return buildEntitlementSnapshot({
    role: "user",
    onboardingCompletedAt: "2026-09-01T00:00:00.000Z",
    plan: "monthly",
    status: "active",
    accessTier: null,
    trialEndsAt: null,
    renewsAt: FUTURE,
    cancelAtPeriodEnd: false,
    guidedUsed: 0,
    blsSecondsUsed: 0,
    now: NOW,
    ...over,
  });
}

function stateOf(over: Partial<Parameters<typeof buildEntitlementSnapshot>[0]>) {
  return deriveBillingState(snap(over) as BillingStateInput, NOW);
}

describe("billing state derivation", () => {
  it("trial ended", () => {
    const st = stateOf({ status: "trialing", trialEndsAt: PAST, renewsAt: PAST });
    assert.equal(st.kind, "trial_ended");
    assert.equal(st.gated, true);
    assert.equal(st.showPlans, true);
    assert.equal(billingStateCopy(st).title, "Your free trial has ended");
  });

  it("ended plan shows the end date", () => {
    const st = stateOf({ status: "canceled", renewsAt: PAST });
    assert.equal(st.kind, "ended");
    assert.equal(st.date, PAST);
    assert.match(billingStateCopy(st).title, /^Your plan ended on /);
  });

  it("stale cancel flag on an ended plan is ended, never canceling", () => {
    const s = snap({ status: "canceled", renewsAt: PAST, cancelAtPeriodEnd: true });
    assert.equal(s.cancelAtPeriodEnd, false);
    assert.equal(s.accessEndsAt, null);
    const st = deriveBillingState(s, NOW);
    assert.equal(st.kind, "ended");
    // no period end at all
    const s2 = snap({ status: "canceled", renewsAt: null, cancelAtPeriodEnd: true });
    assert.equal(s2.cancelAtPeriodEnd, false);
    assert.equal(deriveBillingState(s2, NOW).kind, "ended");
    assert.equal(billingStateCopy(deriveBillingState(s2, NOW)).title, "Your plan has ended");
  });

  it("cancel flag with past period end on an active row is not canceling", () => {
    const s = snap({ status: "active", renewsAt: PAST, cancelAtPeriodEnd: true });
    assert.equal(s.cancelAtPeriodEnd, false);
  });

  it("canceled but still inside the paid period is not gated", () => {
    const s = snap({ status: "canceled", renewsAt: FUTURE, cancelAtPeriodEnd: true });
    assert.equal(s.canUseApp, true);
    assert.equal(s.accessEndsAt, FUTURE);
    const st = deriveBillingState(s, NOW);
    assert.equal(st.kind, "canceling");
    assert.equal(st.gated, false);
    assert.equal(st.date, FUTURE);
    const active = deriveBillingState(
      snap({ status: "active", renewsAt: FUTURE, cancelAtPeriodEnd: true }),
      NOW
    );
    assert.equal(active.kind, "canceling");
    assert.equal(active.gated, false);
  });

  it("immediate cancel (no cancel flag) is ended even with a future date", () => {
    const s = snap({ status: "canceled", renewsAt: FUTURE, cancelAtPeriodEnd: false });
    assert.equal(s.canUseApp, false);
    const st = deriveBillingState(s, NOW);
    assert.equal(st.kind, "ended");
    assert.equal(st.date, null);
  });

  it("past_due is payment failed with the portal", () => {
    const st = stateOf({ status: "past_due" });
    assert.equal(st.kind, "payment_failed");
    assert.equal(st.showPortal, true);
    assert.equal(st.showPlans, false);
    assert.equal(billingStateCopy(st).title, "Payment failed \u2014 update your card");
    assert.equal(stateOf({ status: "unpaid" }).kind, "payment_failed");
  });

  it("never subscribed", () => {
    const st = stateOf({ status: "none", plan: "free", renewsAt: null });
    assert.equal(st.kind, "never");
    assert.equal(st.gated, true);
    assert.equal(st.showPlans, true);
  });

  it("active and trialing users are not gated", () => {
    assert.equal(stateOf({ status: "active" }).gated, false);
    const tr = stateOf({ status: "trialing", trialEndsAt: FUTURE });
    assert.equal(tr.kind, "trialing");
    assert.equal(tr.gated, false);
  });
});

describe("access gate while blocked", () => {
  it("lets a no-access user sign out and reach support", () => {
    assert.equal(isReachableWithoutAccess("/api/auth/logout"), true);
    assert.equal(isReachableWithoutAccess("/support"), true);
    assert.equal(isReachableWithoutAccess("/app/billing"), true);
    assert.equal(isReachableWithoutAccess("/app/billing/manage"), true);
    assert.equal(isReachableWithoutAccess("/app/login"), true);
  });

  it("still blocks the app itself", () => {
    assert.equal(isAccessAllowedPath("/app"), false);
    assert.equal(isReachableWithoutAccess("/app"), false);
  });

  it("sends blocked users to billing, which is allowed (no loop)", () => {
    const dest = resolveAccessRedirect({ role: "user", needsPayment: true, canUseApp: false });
    assert.equal(dest, "/app/billing");
    assert.equal(isAccessAllowedPath(dest), true);
  });
});