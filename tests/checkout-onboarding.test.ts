import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEntitlementSnapshot } from "../lib/entitlements.ts";
import { resolveAccessRedirect } from "../lib/access-gate.ts";

const future = () => new Date(Date.now() + 7 * 86400000).toISOString();

function trialing(onboardingCompletedAt: string | null) {
  return buildEntitlementSnapshot({
    role: "user",
    onboardingCompletedAt,
    plan: "yearly",
    status: "trialing",
    accessTier: "trialing",
    trialEndsAt: future(),
    renewsAt: future(),
    guidedUsed: 0,
    blsSecondsUsed: 0,
  });
}

describe("paid on /checkout before onboarding", () => {
  it("keeps access but flags onboarding as pending", () => {
    const snap = trialing(null);
    assert.equal(snap.canUseApp, true);
    assert.equal(snap.needsOnboarding, false);
    assert.equal(snap.onboardingPending, true);
  });

  it("is not pending once onboarding is finished", () => {
    assert.equal(trialing(new Date().toISOString()).onboardingPending, false);
  });

  it("is never pending for staff or members without access", () => {
    const admin = buildEntitlementSnapshot({
      role: "platform_admin",
      onboardingCompletedAt: null,
      plan: "free",
      status: "none",
      accessTier: null,
      trialEndsAt: null,
      renewsAt: null,
      guidedUsed: 0,
      blsSecondsUsed: 0,
    });
    assert.equal(admin.onboardingPending, false);
    const none = buildEntitlementSnapshot({
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
    assert.equal(none.onboardingPending, false);
    assert.equal(none.needsOnboarding, true);
  });

  it("routes pending members to onboarding instead of the app", () => {
    assert.equal(
      resolveAccessRedirect({
        role: "user",
        needsOnboarding: false,
        onboardingPending: true,
        needsPayment: false,
        canUseApp: true,
        next: "/app",
      }),
      "/app/onboarding"
    );
    assert.equal(
      resolveAccessRedirect({
        role: "user",
        onboardingPending: false,
        canUseApp: true,
        next: "/app",
      }),
      "/app"
    );
  });
});
