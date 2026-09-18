"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BILLING_PLANS,
  orderedBillingPlans,
  type BillingPlanId,
  type BillingPlanMeta,
} from "@/lib/billing-constants";
import { shouldOfferBillingPortal } from "@/lib/checkout-rules";
import {
  metaMoneyFromPlanPrice,
  trackMetaEvent,
} from "@/lib/meta-pixel";
import { ConversionTags } from "@/app/components/ConversionTags";
import { UpgradeModal } from "@/app/components/UpgradeModal";

const BILLING_FLIP_MS = 620;

type Status = {
  accessTier: string;
  canUseApp: boolean;
  needsOnboarding: boolean;
  needsPayment: boolean;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  renewsAt: string | null;
  guidedUsed: number;
  guidedLimit: number;
  guidedRemaining: number;
  blsSecondsUsed: number;
  blsSecondsLimit: number;
  blsSecondsRemaining: number;
  isTrialLimited: boolean;
  stripeConfigured: boolean;
  plans?: Record<BillingPlanId, BillingPlanMeta>;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function BillingPageInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const checkout = params.get("checkout");
  const activated = params.get("activated");
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [plan, setPlan] = useState<BillingPlanId>("yearly");
  const [cardFlipping, setCardFlipping] = useState(false);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    const res = await fetch(`/api/billing/status${qs}`);
    const data = await res.json();
    if (res.ok) setStatus(data as Status);
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    if (checkout === "success") {
      setMsg("Subscription updated.");
      trackMetaEvent(
        "Subscribe",
        { content_category: "subscription" },
        { onceKey: "subscribe_checkout" }
      );
    }
    if (checkout === "canceled") setMsg("Checkout canceled.");
    if (activated === "1") {
      trackMetaEvent(
        "Purchase",
        { content_category: "subscription", content_name: "activate_trial" },
        { onceKey: "purchase_activate" }
      );
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("activated")) {
          url.searchParams.delete("activated");
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      }
    }
    // Drop session_id from the URL after the first status sync so refreshes
    // cannot re-apply an old Checkout session over a newer subscription.
    if (sessionId && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("session_id")) {
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [refresh, checkout, sessionId, activated]);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, []);

  const openUpgrade = useCallback(() => {
    setCardFlipping(false);
    setUpgradeOpen(true);
  }, []);

  const onUpgradeClick = useCallback(() => {
    if (cardFlipping || upgradeOpen) return;

    if (prefersReducedMotion()) {
      openUpgrade();
      return;
    }

    setCardFlipping(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
      const el = cardRef.current;
      if (el) el.removeEventListener("animationend", onAnimEnd);
      openUpgrade();
    };
    const onAnimEnd = (e: AnimationEvent) => {
      if (e.target !== cardRef.current) return;
      finish();
    };

    const el = cardRef.current;
    if (el) el.addEventListener("animationend", onAnimEnd);
    // Fallback so upgrade never blocks if animationend is missed
    flipTimerRef.current = setTimeout(finish, BILLING_FLIP_MS + 80);
  }, [cardFlipping, upgradeOpen, openUpgrade]);

  const checkoutStart = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, source: "billing_page" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "use_portal") {
          setMsg(data.error ?? "Open Manage billing to continue.");
          return;
        }
        setMsg(data.error ?? "Checkout unavailable");
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
      }
    } catch {
      setMsg("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Portal unavailable");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setMsg("Could not open billing portal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="billing-page">
      <ConversionTags />
      <Link href="/app" className="billing-back">
        ← Back to session
      </Link>

      <div className="billing-page-stage">
        <div
          className={`billing-card-perspective${
            upgradeOpen ? " billing-card-perspective--concealed" : ""
          }`}
          aria-hidden={upgradeOpen || undefined}
        >
          <div
            ref={cardRef}
            className={`admin-panel billing-card${
              cardFlipping ? " billing-card--flip" : ""
            }${upgradeOpen ? " billing-card--concealed" : ""}`}
          >
            <h1 className="admin-page-title">Your billing</h1>
            <p className="admin-panel-sub mt-2">
              Manage your plan, trial usage, and payment method.
            </p>

            {status && (
              <div className="settings-group mt-4">
                <div className="settings-row settings-kv">
                  <span>Plan</span>
                  <strong className="capitalize">
                    {status.status === "canceled" || status.plan === "free"
                      ? "None"
                      : status.plan}
                  </strong>
                </div>
                <div className="settings-row settings-kv">
                  <span>Status</span>
                  <strong className="capitalize">
                    {status.status.replace(/_/g, " ")}
                  </strong>
                </div>
                {status.trialEndsAt && (
                  <div className="settings-row settings-kv">
                    <span>Trial ends</span>
                    <strong>
                      {new Date(status.trialEndsAt).toLocaleDateString()}
                    </strong>
                  </div>
                )}
                {status.renewsAt && (
                  <div className="settings-row settings-kv">
                    <span>Renews</span>
                    <strong>
                      {new Date(status.renewsAt).toLocaleDateString()}
                    </strong>
                  </div>
                )}
                {status.isTrialLimited && (
                  <>
                    <div className="settings-row settings-kv">
                      <span>Guided sessions</span>
                      <strong>
                        {status.guidedUsed} / {status.guidedLimit}
                      </strong>
                    </div>
                    <div className="settings-row settings-kv">
                      <span>Self-guided set time</span>
                      <strong>
                        {Math.floor(status.blsSecondsUsed / 60)} /{" "}
                        {Math.floor(status.blsSecondsLimit / 60)} min
                      </strong>
                    </div>
                  </>
                )}
              </div>
            )}

            {status?.needsPayment && (
              <div className="upgrade-plan-list mt-4">
                {orderedBillingPlans(status.plans ?? BILLING_PLANS).map((p) => {
                  const id = p.id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`upgrade-plan-card ${plan === id ? "upgrade-plan-card--selected" : ""}`}
                      onClick={() => setPlan(id)}
                      disabled={busy}
                    >
                      <span className="upgrade-plan-label">{p.label}</span>
                      <span className="upgrade-plan-price">
                        {p.displayPrice}
                        <span className="upgrade-plan-period">
                          {p.displayPeriod}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {(status?.needsPayment ||
              status?.isTrialLimited ||
              shouldOfferBillingPortal({ status: status?.status }) ||
              status?.needsOnboarding ||
              msg) && (
              <div className="billing-actions">
                {status?.needsPayment && (
                  <button
                    type="button"
                    disabled={busy || !status.stripeConfigured}
                    onClick={() => void checkoutStart()}
                    className="btn-primary"
                  >
                    {busy ? "Loading…" : "Subscribe"}
                  </button>
                )}

                {status?.isTrialLimited && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={cardFlipping}
                    onClick={onUpgradeClick}
                  >
                    Upgrade for unlimited
                  </button>
                )}

                {shouldOfferBillingPortal({ status: status?.status }) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openPortal()}
                    className="btn-secondary"
                  >
                    Manage billing
                  </button>
                )}

                {status?.needsOnboarding && (
                  <Link
                    href="/app/onboarding"
                    className="btn-secondary inline-flex"
                  >
                    Continue onboarding
                  </Link>
                )}

                {msg && <p className="admin-invite-msg">{msg}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        reason="generic"
        guidedUsed={status?.guidedUsed}
        guidedLimit={status?.guidedLimit}
        blsSecondsUsed={status?.blsSecondsUsed}
        blsSecondsLimit={status?.blsSecondsLimit}
        onClose={() => {
          setCardFlipping(false);
          setUpgradeOpen(false);
        }}
      />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageInner />
    </Suspense>
  );
}
