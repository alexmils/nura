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
import { billingSummaryStatusLabel } from "@/lib/billing-status-display";
import {
  metaMoneyFromPlanPrice,
  trackMetaEvent,
} from "@/lib/meta-pixel";
import { ConversionTags } from "@/app/components/ConversionTags";
import { UpgradeModal } from "@/app/components/UpgradeModal";
import { useToast } from "@/app/components/Toast";
import {
  checkoutReturnNotice,
  checkoutStartNotice,
} from "@/lib/checkout-feedback";

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
  cancelAtPeriodEnd?: boolean;
  accessEndsAt?: string | null;
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
  const { toast } = useToast();
  const sessionId = params.get("session_id");
  const checkout = params.get("checkout");
  const activated = params.get("activated");
  const announcedRef = useRef<string | null>(null);
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
    if (!res.ok) return null;
    const next = data as Status;
    setStatus(next);
    return next;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await refresh();
      if (cancelled) return;

      const announceKey = checkout ?? (activated === "1" ? "activated" : "");
      const notice =
        checkout === "success" || checkout === "canceled"
          ? checkoutReturnNotice({
              checkout,
              status: data?.status ?? null,
              canUseApp: data?.canUseApp,
            })
          : null;

      if (notice && announcedRef.current !== announceKey) {
        announcedRef.current = announceKey;
        setMsg(notice.message);
        toast(notice.message, notice.kind === "success" ? "success" : notice.kind);
      }

      if (notice?.kind === "success" && checkout === "success") {
        trackMetaEvent(
          "Subscribe",
          { content_category: "subscription" },
          { onceKey: "subscribe_checkout" }
        );
      }

      if (activated === "1" && announcedRef.current !== announceKey) {
        announcedRef.current = announceKey;
        const message = "Payment successful. Your subscription is active.";
        setMsg(message);
        toast(message);
        // Subscription start, not a purchase: the charge is reported from the
        // webhook with the amount Stripe actually collected. No value here
        // either — this legacy link has no plan loaded yet, and Meta flags a
        // Purchase without one.
        trackMetaEvent(
          "Subscribe",
          { content_category: "subscription", content_name: "activate_trial" },
          { onceKey: "subscribe_activate" }
        );
      }

      // Drop checkout return params only after this sync, so the status call
      // still includes session_id and a re-render does not skip the toast.
      if (typeof window !== "undefined" && (sessionId || activated === "1")) {
        const url = new URL(window.location.href);
        let dirty = false;
        if (url.searchParams.has("session_id")) {
          url.searchParams.delete("session_id");
          dirty = true;
        }
        if (url.searchParams.has("activated")) {
          url.searchParams.delete("activated");
          dirty = true;
        }
        if (dirty) {
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, checkout, sessionId, activated, toast]);

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
      const notice = checkoutStartNotice({
        ok: res.ok,
        error:
          data.error ??
          (data.code === "use_portal"
            ? "Open Manage billing to update your card."
            : null),
        url: data.url,
      });
      if (notice) {
        setMsg(notice.message);
        toast(notice.message, "error");
        return;
      }
      const money = metaMoneyFromPlanPrice(
        status?.plans?.[plan]?.displayPrice ?? BILLING_PLANS[plan].displayPrice
      );
      trackMetaEvent("InitiateCheckout", {
        ...money,
        content_name: plan,
        content_category: "subscription",
      });
      window.location.href = data.url;
    } catch {
      const message = "Could not start checkout.";
      setMsg(message);
      toast(message, "error");
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
                  <strong
                    className={
                      status.cancelAtPeriodEnd ? "billing-kv-canceling" : "capitalize"
                    }
                  >
                    {billingSummaryStatusLabel(
                      status.status,
                      Boolean(status.cancelAtPeriodEnd)
                    )}
                  </strong>
                </div>
                {status.cancelAtPeriodEnd && status.accessEndsAt ? (
                  <div className="settings-row settings-kv">
                    <span>Access ends</span>
                    <strong>
                      {new Date(status.accessEndsAt).toLocaleDateString()}
                    </strong>
                  </div>
                ) : null}
                {/* Once billing starts the trial end is history, not status. */}
                {status.trialEndsAt &&
                  status.status === "trialing" &&
                  !status.cancelAtPeriodEnd && (
                  <div className="settings-row settings-kv">
                    <span>Trial ends</span>
                    <strong>
                      {new Date(status.trialEndsAt).toLocaleDateString()}
                    </strong>
                  </div>
                )}
                {status.renewsAt && !status.cancelAtPeriodEnd && (
                  <div className="settings-row settings-kv">
                    <span>Renews</span>
                    <strong>
                      {new Date(status.renewsAt).toLocaleDateString()}
                    </strong>
                  </div>
                )}
                {status.cancelAtPeriodEnd ? (
                  <p className="billing-summary-cancel-note">
                    Renewal is off. You keep access until the date above. Turn
                    it back on in Manage billing.
                  </p>
                ) : null}
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
                  <Link href="/app/billing/manage" className="btn-secondary">
                    Manage billing
                  </Link>
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
        onActivated={() => {
          void refresh();
        }}
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
