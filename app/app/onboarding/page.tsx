"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthError, AuthSuccess, AuthLink } from "@/app/components/AuthShell";
import { HelpChatLink } from "@/app/components/HelpChatWidget";
import { OnboardingShell } from "@/app/components/onboarding/OnboardingShell";
import {
  BILLING_PLANS,
  orderedBillingPlans,
  TRIAL_BLS_SECONDS,
  TRIAL_DAYS,
  TRIAL_GUIDED_SESSIONS,
  type BillingPlanId,
  type BillingPlanMeta,
} from "@/lib/billing-constants";
import { APP_BASE } from "@/lib/app-base";
import { resetGuideState } from "@/lib/guide-steps";
import {
  metaMoneyFromPlanPrice,
  trackMetaEvent,
} from "@/lib/meta-pixel";

type BillingStatus = {
  accessTier: string;
  canUseApp: boolean;
  needsOnboarding: boolean;
  needsPayment: boolean;
  plan: string;
  status: string;
  guidedRemaining: number;
  blsSecondsRemaining: number;
  isTrialLimited: boolean;
  stripeConfigured: boolean;
  onboardingCompletedAt: string | null;
  plans?: Record<BillingPlanId, BillingPlanMeta>;
};

type Step = "age" | "plan" | "tutorial";

const FREE_MINUTES = Math.floor(TRIAL_BLS_SECONDS / 60);

function OnboardingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const checkout = params.get("checkout");
  const sessionId = params.get("session_id");
  const canceledPlan = params.get("plan");
  const registered = params.get("registered");

  const [step, setStep] = useState<Step>("plan");
  const [afterAgeStep, setAfterAgeStep] = useState<Exclude<Step, "age">>("plan");
  const [plan, setPlan] = useState<BillingPlanId>(
    canceledPlan === "weekly" || canceledPlan === "monthly" ? canceledPlan : "yearly"
  );
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const refreshStatus = useCallback(async () => {
    const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    const res = await fetch(`/api/billing/status${qs}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Could not load billing status");
    }
    setStatus(data as BillingStatus);
    return data as BillingStatus;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let data = await refreshStatus();
        if (cancelled) return;

        if (checkout === "success" && !data.canUseApp) {
          for (let i = 0; i < 4 && !cancelled && !data.canUseApp; i++) {
            await new Promise((r) => setTimeout(r, 1200));
            data = await refreshStatus();
          }
        }
        if (cancelled) return;

        if (sessionId && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.has("session_id")) {
            url.searchParams.delete("session_id");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }

        if (registered === "1" && typeof window !== "undefined") {
          trackMetaEvent(
            "CompleteRegistration",
            { status: true, content_name: "google" },
            { onceKey: "complete_registration" }
          );
          const url = new URL(window.location.href);
          if (url.searchParams.has("registered")) {
            url.searchParams.delete("registered");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }

        let nextStep: Exclude<Step, "age"> = "plan";
        let redirectAway = false;

        if (checkout === "success" && !data.canUseApp) {
          nextStep = "plan";
          setError(
            "Payment is still confirming. Wait a moment, then refresh — or pick a plan if checkout did not finish."
          );
        } else if (data.canUseApp) {
          if (data.onboardingCompletedAt && checkout !== "success") {
            router.replace(APP_BASE);
            redirectAway = true;
          } else {
            nextStep = "tutorial";
            if (checkout === "success") {
              setSuccess("Payment method saved. Your trial is ready.");
              const money = metaMoneyFromPlanPrice(
                data.plans?.[data.plan as BillingPlanId]?.displayPrice
              );
              trackMetaEvent(
                "StartTrial",
                {
                  ...money,
                  content_name: data.plan,
                  content_category: "subscription",
                },
                { onceKey: "start_trial" }
              );
            }
          }
        } else if (checkout === "canceled") {
          nextStep = "plan";
          setError("Checkout canceled. Choose a plan when you’re ready.");
        } else if (!data.needsOnboarding && data.needsPayment) {
          router.replace(`${APP_BASE}/billing`);
          redirectAway = true;
        }

        if (cancelled || redirectAway) return;

        setAfterAgeStep(nextStep);

        let ageOk = false;
        try {
          const cRes = await fetch("/api/consents");
          const cData = (await cRes.json()) as { ageOk?: boolean };
          if (cRes.ok) ageOk = Boolean(cData.ageOk);
        } catch {
          ageOk = false;
        }
        if (cancelled) return;

        setStep(ageOk ? nextStep : "age");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkout, refreshStatus, registered, router, sessionId]);

  const confirmAge = async () => {
    if (!ageConfirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "age_18" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save confirmation");
        return;
      }
      setStep(afterAgeStep);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const startCheckout = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, source: "onboarding" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout unavailable");
        return;
      }
      if (data.url) {
        const money = metaMoneyFromPlanPrice(
          status?.plans?.[plan]?.displayPrice ?? BILLING_PLANS[plan].displayPrice
        );
        trackMetaEvent("InitiateCheckout", {
          ...money,
          content_name: plan,
          content_category: "subscription",
        });
        window.location.href = data.url;
        return;
      }
      setError("Checkout unavailable");
    } catch {
      setError("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not finish onboarding");
        if (data.code === "needs_payment") setStep("plan");
        return;
      }
      // A fresh account gets the guided tour even on a shared device.
      try {
        resetGuideState(window.localStorage, window.sessionStorage);
      } catch {
        /* storage unavailable: the tour simply may not auto-start */
      }
      router.replace(APP_BASE);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const shellCopy = useMemo(() => {
    if (step === "age") {
      return {
        kicker: undefined as string | undefined,
        title: "Are you 18 or older?",
        lead: undefined as string | undefined,
      };
    }
    if (step === "plan") {
      return {
        kicker: undefined as string | undefined,
        title: "Pick a plan",
        lead: `${TRIAL_DAYS} days free · cancel anytime`,
      };
    }
    return {
      kicker: undefined as string | undefined,
      title: "You’re ready",
      lead: "Your trial is on. Open the app and tap New chat.",
    };
  }, [step]);

  if (loading) {
    return (
      <OnboardingShell title="Setting up…" lead="Loading your account">
        <p className="ob-note" style={{ margin: 0 }}>
          Please wait…
        </p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      kicker={shellCopy.kicker}
      title={shellCopy.title}
      lead={shellCopy.lead}
      footer={
        <p>
          <HelpChatLink>Need help?</HelpChatLink>
        </p>
      }
    >
      {error && <AuthError message={error} />}
      {step === "plan" && success ? <AuthSuccess message={success} /> : null}

      {step === "age" && (
        <div className="ob-age-step">
          <label className="ob-age-check">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
            />
            <span>I am 18 or older</span>
          </label>
          <p className="ob-note ob-age-legal">
            By continuing you agree to our{" "}
            <AuthLink href="/terms">Terms</AuthLink> and{" "}
            <AuthLink href="/privacy">Privacy</AuthLink>.
          </p>
          <button
            type="button"
            className="frontend-btn-primary ob-cta"
            disabled={busy || !ageConfirmed}
            onClick={() => void confirmAge()}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      )}

      {step === "plan" && (
        <div>
          {!status?.stripeConfigured && (
            <AuthError message="Stripe is not configured yet. Ask your admin to set price IDs." />
          )}
          <div className="upgrade-plan-list" role="radiogroup" aria-label="Plan">
            {orderedBillingPlans(status?.plans ?? BILLING_PLANS).map((p) => {
              const id = p.id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={plan === id}
                  className={`upgrade-plan-card ${plan === id ? "upgrade-plan-card--selected" : ""} ${p.highlight ? "upgrade-plan-card--highlight" : ""}`}
                  onClick={() => setPlan(id)}
                  disabled={busy}
                >
                  <span className="upgrade-plan-label">
                    {p.label}
                    {p.savingsHint ? (
                      <span className="upgrade-plan-badge">{p.savingsHint}</span>
                    ) : null}
                  </span>
                  <span className="upgrade-plan-price">
                    {p.displayPrice}
                    <span className="upgrade-plan-period">{p.displayPeriod}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="ob-note">
            {TRIAL_GUIDED_SESSIONS} AI agent-guided sessions and {FREE_MINUTES} minutes of
            self-guided set time in the trial. We save your card now. You won’t be
            charged for {TRIAL_DAYS} days.
          </p>
          <button
            type="button"
            className="frontend-btn-primary ob-cta"
            disabled={busy || !status?.stripeConfigured}
            onClick={() => void startCheckout()}
          >
            {busy ? "Redirecting…" : `Start ${TRIAL_DAYS}-day trial`}
          </button>
        </div>
      )}

      {step === "tutorial" && (
        <div className="ob-tutorial">
          <div className="ob-ball-preview" aria-hidden="true">
            <div className="ob-ball-track">
              <span className="ob-ball-dot" />
            </div>
          </div>
          <button
            type="button"
            className="frontend-btn-primary ob-cta"
            disabled={busy}
            onClick={() => void finish()}
          >
            {busy ? "Opening…" : "Open the app"}
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
