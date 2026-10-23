/**
 * One user-facing billing state derived from the entitlement snapshot.
 * Pure: no DB, no React, so it is shared by the API payload, the paywall
 * and tests. Exactly one message per state, never "Plan: None" + "Canceling".
 */

export type BillingStateKind =
  | "active"
  | "trialing"
  | "canceling"
  | "payment_failed"
  | "trial_ended"
  | "ended"
  | "never"
  | "onboarding";

export type BillingStateInput = {
  accessTier: string;
  canUseApp: boolean;
  needsOnboarding?: boolean;
  status: string;
  plan?: string | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  accessEndsAt: string | null;
};

export type BillingState = {
  kind: BillingStateKind;
  /** true when the paywall should replace the normal billing page */
  gated: boolean;
  /** ISO date the message refers to (trial end, plan end, access end) */
  date: string | null;
  /** offer plan cards + checkout */
  showPlans: boolean;
  /** offer the Stripe customer portal ("Manage billing") as the main action */
  showPortal: boolean;
};

function isFuture(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

function isPast(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t <= now.getTime();
}

export function deriveBillingState(
  s: BillingStateInput,
  now: Date = new Date()
): BillingState {
  if (s.needsOnboarding) {
    return { kind: "onboarding", gated: false, date: null, showPlans: false, showPortal: false };
  }

  if (s.canUseApp) {
    if (s.accessTier === "legacy") {
      return { kind: "active", gated: false, date: null, showPlans: false, showPortal: false };
    }
    if (s.cancelAtPeriodEnd && isFuture(s.accessEndsAt, now)) {
      return { kind: "canceling", gated: false, date: s.accessEndsAt, showPlans: false, showPortal: true };
    }
    if (s.status === "trialing" || s.accessTier === "trialing") {
      return { kind: "trialing", gated: false, date: s.trialEndsAt, showPlans: false, showPortal: false };
    }
    return { kind: "active", gated: false, date: s.renewsAt, showPlans: false, showPortal: true };
  }

  // No access from here on.
  if (s.status === "past_due" || s.status === "unpaid") {
    return { kind: "payment_failed", gated: true, date: null, showPlans: false, showPortal: true };
  }
  if (s.status === "incomplete") {
    // First payment never went through: let them retry checkout, portal too.
    return { kind: "payment_failed", gated: true, date: null, showPlans: true, showPortal: true };
  }
  if (s.status === "trialing") {
    return { kind: "trial_ended", gated: true, date: s.trialEndsAt, showPlans: true, showPortal: false };
  }
  if (s.status === "canceled" || s.status === "active") {
    // A stale cancel flag with no live period is simply "ended".
    const end = isPast(s.renewsAt, now) ? s.renewsAt : null;
    return { kind: "ended", gated: true, date: end, showPlans: true, showPortal: false };
  }
  if (s.trialEndsAt && isPast(s.trialEndsAt, now)) {
    return { kind: "trial_ended", gated: true, date: s.trialEndsAt, showPlans: true, showPortal: false };
  }
  return { kind: "never", gated: true, date: null, showPlans: true, showPortal: false };
}

export function formatBillingDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/** Headline + supporting line for a state. */
export function billingStateCopy(state: BillingState): { title: string; body: string } {
  const date = formatBillingDate(state.date);
  switch (state.kind) {
    case "trial_ended":
      return {
        title: "Your free trial has ended",
        body: "Choose a plan to keep using guided sessions and bilateral stimulation.",
      };
    case "ended":
      return {
        title: date ? `Your plan ended on ${date}` : "Your plan has ended",
        body: "Pick a plan to pick up where you left off. Your history is still here.",
      };
    case "payment_failed":
      return {
        title: "Payment failed \u2014 update your card",
        body: "We could not charge your card. Update it in billing to restore access.",
      };
    case "never":
      return {
        title: "Choose a plan to get started",
        body: "Unlock guided sessions and bilateral stimulation. Cancel anytime.",
      };
    case "canceling":
      return {
        title: date ? `Your plan ends on ${date}` : "Your plan is set to end",
        body: "Renewal is off. You keep full access until then.",
      };
    case "trialing":
      return {
        title: date ? `Free trial until ${date}` : "Free trial",
        body: "You have full access during your trial.",
      };
    case "onboarding":
      return { title: "Finish setting up", body: "Complete onboarding to continue." };
    default:
      return { title: "Your plan is active", body: "" };
  }
}