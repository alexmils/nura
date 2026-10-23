"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BillingPaywall } from "@/app/components/billing/BillingPaywall";
import { BILLING_PLANS, type BillingPlanId } from "@/lib/billing-constants";
import { deriveBillingState } from "@/lib/billing-access-state";

const PAST = "2026-10-01T00:00:00.000Z";

function Inner() {
  const q = useSearchParams();
  const kind = q.get("kind") ?? "trial_ended";
  const [plan, setPlan] = useState<BillingPlanId>("yearly");
  const status =
    kind === "payment_failed" ? "past_due" : kind === "ended" ? "canceled" : kind === "never" ? "none" : "trialing";
  const state = deriveBillingState({
    accessTier: "blocked",
    canUseApp: false,
    status,
    trialEndsAt: kind === "trial_ended" ? PAST : null,
    renewsAt: kind === "ended" ? PAST : null,
    cancelAtPeriodEnd: kind === "ended",
    accessEndsAt: null,
  });
  return (
    <>
      <BillingPaywall
        state={state}
        plans={BILLING_PLANS}
        selected={plan}
        onSelect={setPlan}
        onCheckout={() => {}}
        onSignOut={() => {}}
        busy={false}
        signingOut={false}
        stripeConfigured
        email="someone.with.a.long.address@example.com"
      />
      <button type="button" className="help-fab">Need help?</button>
    </>
  );
}

export function PaywallMock() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}