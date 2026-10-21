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
import { requestGuideAutostart, resetGuideState } from "@/lib/guide-steps";
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
  /** Recurring price Stripe will charge after the trial, in major units. */
  trialValue?: { value: number; currency: string } | null;
};

type Step = "age" | "email" | "plan" | "tutorial";

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
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    if (step !== "tutorial" || typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok || cancelled) return;
        const me = (await meRes.json()) as { user?: { id?: string } };
        requestGuideAutostart(window.localStorage, me.user?.id ?? null);
      } catch {
        /* autostart also set on Open the app */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

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
              // Prefer the amount Stripe will actually charge. The plan label is
              // not enough: an unmatched price ID maps to "pro", which has no
              // display price, and a missing `value` is what Meta reports as
              // "all StartTrial events send the same price information".
              const planMeta =
                data.plans?.[data.plan as BillingPlanId] ??
                BILLING_PLANS[data.plan as BillingPlanId];
              const money =
                data.trialValue ??
                metaMoneyFromPlanPrice(planMeta?.displayPrice);
              trackMetaEvent(
                "StartTrial",
                {
                  ...money,
                  content_name: data.plan,
                  content_category: "subscription",
                },
                {
                  onceKey: "start_trial",
                  // Same event id the Stripe webhook sends through CAPI, so a
                  // trial reported by both sides is counted once.
                  transactionId: sessionId ? `trial:${sessionId}` : undefined,
                }
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
        let emailAsked = false;
        try {
          const cRes = await fetch("/api/consents");
          const cData = (await cRes.json()) as {
            ageOk?: boolean;
            consents?: { docType?: string }[];
          };
          if (cRes.ok) {
            ageOk = Boolean(cData.ageOk);
            emailAsked = Boolean(
              cData.consents?.some((row) => row.docType === "marketing_email")
            );
          }
        } catch {
          ageOk = false;
        }
        if (cancelled) return;

        if (!ageOk) setStep("age");
        else if (!emailAsked) setStep("email");
        else setStep(nextStep);
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
      setStep("email");
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
      let userId: string | null = null;
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const me = (await meRes.json()) as { user?: { id?: string } };
          userId = me.user?.id ?? null;
        }
      } catch {
        userId = null;
      }
      // Fresh account: per-user tour flags + one-shot autostart on home.
      try {
        resetGuideState(window.localStorage, window.sessionStorage, userId);
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

  const saveEmailChoice = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "marketing_email",
          optedIn: marketingOptIn,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your choice");
        return;
      }
      setStep(afterAgeStep);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const selectedPlanMeta = useMemo(() => {
    return status?.plans?.[plan] ?? BILLING_PLANS[plan];
  }, [status?.plans, plan]);

  const shellCopy = useMemo(() => {
    if (step === "age") {
      return {
        kicker: undefined as string | undefined,
        title: "Are you 18 or older?",
        lead: undefined as string | undefined,
        leadLines: undefined as readonly string[] | undefined,
      };
    }
    if (step === "email") {
      return {
        kicker: undefined as string | undefined,
        title: "Email updates",
        lead: undefined as string | undefined,
        leadLines: undefined as readonly string[] | undefined,
      };
    }
    if (step === "plan") {
      return {
        kicker: undefined as string | undefined,
        title: "Pick a plan",
        lead: `${TRIAL_DAYS} days free`,
        leadLines: undefined as readonly string[] | undefined,
      };
    }
    return {
      kicker: undefined as string | undefined,
      title: "You’re ready",
      lead: undefined as string | undefined,
      leadLines: ["Your trial is on.", "Open the app and tap New chat."] as const,
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
      leadLines={shellCopy.leadLines}
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

      {step === "email" && (
        <div className="ob-age-step">
          <label className="ob-age-check">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
            />
            <span>
              Send me occasional product news and tips. Optional. Turn this off
              anytime in Settings.
            </span>
          </label>
          <button
            type="button"
            className="frontend-btn-primary ob-cta"
            disabled={busy}
            onClick={() => void saveEmailChoice()}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      )}

      {step === "plan" && (
        <div className="ob-plan-step">
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
                  className={`upgrade-plan-card ob-plan-option ${plan === id ? "upgrade-plan-card--selected ob-plan-option--selected" : ""} ${p.highlight ? "upgrade-plan-card--highlight" : ""}`}
                  onClick={() => setPlan(id)}
                  disabled={busy}
                >
                  <span className="ob-plan-radio" aria-hidden="true" />
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

          <button
            type="button"
            className="frontend-btn-primary ob-cta"
            disabled={busy || !status?.stripeConfigured}
            onClick={() => void startCheckout()}
          >
            {busy ? "Redirecting…" : "Try free"}
          </button>
          <div className="ob-plan-footnote">
            <p className="ob-plan-footnote-line">
              Trial: {TRIAL_GUIDED_SESSIONS} AI agent-guided sessions,{" "}
              {FREE_MINUTES} min self-guided.
            </p>
            <p className="ob-plan-footnote-line ob-plan-footnote-line--billing">
              Then {selectedPlanMeta.displayPrice}
              {selectedPlanMeta.displayPeriod}. Cancel anytime.
            </p>
          </div>
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
