"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  BILLING_PLANS,
  isBillingPlanId,
  orderedBillingPlans,
  type BillingPlanId,
  type BillingPlanMeta,
} from "@/lib/billing-constants";
import {
  metaMoneyFromPlanPrice,
  trackMetaEvent,
} from "@/lib/meta-pixel";
import { useToast } from "@/app/components/Toast";

type UpgradeReason = "trial_limit_reached" | "bls_limit_reached" | "generic";

type Props = {
  open: boolean;
  reason?: UpgradeReason;
  guidedUsed?: number;
  guidedLimit?: number;
  blsSecondsUsed?: number;
  blsSecondsLimit?: number;
  /** Called after the trial ends and billing starts, so usage limits refresh. */
  onActivated?: () => void;
  onClose: () => void;
};

export function UpgradeModal({
  open,
  reason = "generic",
  guidedUsed = 0,
  guidedLimit = 3,
  blsSecondsUsed = 0,
  blsSecondsLimit = 600,
  onActivated,
  onClose,
}: Props) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<BillingPlanId>("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** True once the trial has been ended and the subscription is billing. */
  const [activated, setActivated] = useState(false);
  const [plans, setPlans] =
    useState<Record<BillingPlanId, BillingPlanMeta>>(BILLING_PLANS);
  /** End trial on the current Stripe price instead of opening a new Checkout. */
  const [activateCurrent, setActivateCurrent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!open) return;
    // Re-opening the modal starts a fresh upgrade attempt.
    setActivated(false);
    setError("");
    void (async () => {
      try {
        const res = await fetch("/api/billing/status");
        const data = (await res.json()) as {
          plans?: Record<BillingPlanId, BillingPlanMeta>;
          plan?: string;
          status?: string;
          isTrialLimited?: boolean;
        };
        if (res.ok && data.plans) setPlans(data.plans);
        if (
          res.ok &&
          data.status === "trialing" &&
          data.isTrialLimited &&
          isBillingPlanId(data.plan)
        ) {
          setPlan(data.plan);
          setActivateCurrent(true);
        } else {
          setActivateCurrent(false);
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, [open]);

  const planLabel = plans[plan]?.label ?? plan;

  const headline = activated
    ? "You’re all set"
    : reason === "bls_limit_reached"
      ? "You’ve used your self-guided set time"
      : reason === "trial_limit_reached"
        ? "You’ve used your trial AI agent-guided sessions"
        : "Upgrade for unlimited sessions";

  const detail = activated
    ? `Payment successful. Your ${planLabel} plan is active — your trial limits are lifted.`
    : reason === "bls_limit_reached"
      ? `Trial includes ${Math.floor(blsSecondsLimit / 60)} minutes of self-guided set time (${blsSecondsUsed}s used). Upgrade for unlimited Self-guided sessions.`
      : reason === "trial_limit_reached"
        ? `Trial includes ${guidedLimit} AI agent-guided sessions (${guidedUsed} used). Upgrade to continue without limits.`
        : activateCurrent
          ? `End your trial and start billing on your ${planLabel} plan.`
          : "Get unlimited AI agent-guided and Self-guided sessions.";

  const upgrade = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      if (activateCurrent) {
        const activateRes = await fetch("/api/billing/activate", {
          method: "POST",
        });
        const activateData = (await activateRes.json()) as {
          error?: string;
          code?: string;
          entitlement?: { status?: string };
        };
        if (activateRes.ok) {
          // Stripe can return an ended trial that still needs to collect.
          const nextStatus = activateData.entitlement?.status;
          if (nextStatus && nextStatus !== "active") {
            setError(
              "Your trial has ended but the payment has not cleared yet. Open Manage billing to check your card."
            );
            return;
          }
          trackMetaEvent(
            "Purchase",
            {
              content_category: "subscription",
              content_name: plan,
            },
            { onceKey: "purchase_activate" }
          );
          setActivated(true);
          toast("Payment successful — your subscription is active.");
          onActivated?.();
          return;
        }
        if (
          activateData.code !== "needs_checkout" &&
          activateData.code !== "not_trialing"
        ) {
          setError(activateData.error ?? "Could not activate subscription");
          return;
        }
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, source: "upgrade_modal" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout unavailable");
        return;
      }
      if (data.url) {
        const money = metaMoneyFromPlanPrice(
          plans[plan]?.displayPrice ?? BILLING_PLANS[plan].displayPrice
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
      setError("Could not start upgrade.");
    } finally {
      setBusy(false);
    }
  }, [plan, activateCurrent, plans, onActivated, toast]);

  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="admin-modal upgrade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="upgrade-modal-title" className="admin-page-title">
          {headline}
        </h2>
        <p
          className="admin-panel-sub mt-2"
          role={activated ? "status" : undefined}
        >
          {detail}
        </p>

        {!activateCurrent && !activated && (
          <div
            className="upgrade-plan-list mt-4"
            role="radiogroup"
            aria-label="Plan"
          >
            {orderedBillingPlans(plans).map((p) => {
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
        )}

        {activateCurrent && !activated && (
          <p className="admin-panel-sub mt-4">
            Billing continues on <strong>{planLabel}</strong>
            {plans[plan]?.displayPrice
              ? ` (${plans[plan].displayPrice}${plans[plan].displayPeriod})`
              : ""}
            . Change plans anytime from Manage billing.
          </p>
        )}

        <div className="upgrade-benefits">
          <p className="upgrade-benefits-label">Included with upgrade</p>
          <ul className="upgrade-benefits-list">
            <li>
              <Check
                className="upgrade-benefits-icon"
                aria-hidden
                strokeWidth={2.25}
              />
              <span>Unlimited AI agent-guided sessions</span>
            </li>
            <li>
              <Check
                className="upgrade-benefits-icon"
                aria-hidden
                strokeWidth={2.25}
              />
              <span>Unlimited Free sets (no agent)</span>
            </li>
            <li>
              <Check
                className="upgrade-benefits-icon"
                aria-hidden
                strokeWidth={2.25}
              />
              <span>Cancel anytime from Billing</span>
            </li>
          </ul>
        </div>

        {error && <p className="admin-invite-msg mt-3">{error}</p>}

        <div className="admin-modal-actions upgrade-modal-actions">
          {activated ? (
            <button type="button" className="btn-primary" onClick={onClose}>
              Continue
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={onClose}
              >
                Not now
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void upgrade()}
              >
                {busy ? "Loading…" : "Pay now"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
