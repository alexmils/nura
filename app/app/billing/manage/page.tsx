"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BILLING_PLANS,
  orderedBillingPlans,
  type BillingPlanId,
  type BillingPlanMeta,
} from "@/lib/billing-constants";
import type { BillingManagePaymentMethod } from "@/lib/billing-manage-types";
import { CancelSubscriptionSurveyModal } from "@/app/components/billing/CancelSubscriptionSurveyModal";
import type { SubscriptionCancelReasonId } from "@/lib/subscription-cancel-reasons";
import {
  manageBillingCancelScheduledToast,
  manageBillingFarewellCopy,
  manageBillingResumeToast,
} from "@/lib/billing-manage-copy";

type ManageState = {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  accessEndsAt: string | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  paymentMethod: BillingManagePaymentMethod | null;
  plans?: Record<BillingPlanId, BillingPlanMeta>;
};

function formatCard(pm: BillingManagePaymentMethod | null): string {
  if (!pm?.last4) return "No card on file";
  const brand = pm.brand ? pm.brand.replace(/_/g, " ") : "Card";
  const cap = brand.charAt(0).toUpperCase() + brand.slice(1);
  return `${cap} ···· ${pm.last4}`;
}

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ManageBillingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setup = params.get("setup");
  const sessionId = params.get("session_id");

  const [data, setData] = useState<ManageState | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanId>("yearly");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyStep, setSurveyStep] = useState<"survey" | "retention">("survey");
  const [pendingCancel, setPendingCancel] = useState<{
    reasons: SubscriptionCancelReasonId[];
    comment: string;
  } | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);

  const closeSurvey = () => {
    if (busy) return;
    setSurveyOpen(false);
    setSurveyStep("survey");
    setPendingCancel(null);
    setSurveyError(null);
  };

  const refresh = useCallback(async () => {
    const res = await fetch("/api/billing/manage");
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Could not load billing");
      setData(null);
      return;
    }
    setData(body as ManageState);
    const planId = body.plan as BillingPlanId;
    if (planId && planId in BILLING_PLANS) {
      setSelectedPlan(planId);
    }
    setErr("");
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (setup === "canceled") {
      setMsg("Card update canceled.");
      router.replace("/app/billing/manage");
      return;
    }
    if (setup !== "success" || !sessionId) return;

    void (async () => {
      setBusy(true);
      setMsg("");
      try {
        const res = await fetch("/api/billing/manage/setup-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const body = await res.json();
        if (!res.ok) {
          setErr(body.error ?? "Could not save card");
          return;
        }
        if (body.manage) setData((prev) => ({ ...prev!, ...body.manage }));
        setMsg("Payment method updated.");
      } catch {
        setErr("Could not save card.");
      } finally {
        setBusy(false);
        router.replace("/app/billing/manage");
      }
    })();
  }, [setup, sessionId, router]);

  const run = async (
    path: string,
    body?: Record<string, unknown>,
    okMessage?: string
  ) => {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "Something went wrong");
        return;
      }
      if (json.manage) {
        setData((prev) => ({
          ...(prev ?? {}),
          ...json.manage,
          plans: prev?.plans,
        }));
      } else {
        await refresh();
      }
      if (okMessage) setMsg(okMessage);
    } catch {
      setErr("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async (input: {
    reasons: SubscriptionCancelReasonId[];
    comment: string;
  }) => {
    setBusy(true);
    setSurveyError(null);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/billing/manage/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasons: input.reasons,
          comment: input.comment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSurveyError(json.error ?? "Could not schedule cancellation");
        return;
      }
      closeSurvey();
      if (json.manage) {
        setData((prev) => ({
          ...(prev ?? {}),
          ...json.manage,
          plans: prev?.plans,
        }));
      } else {
        await refresh();
      }
      const ends = formatShortDate(
        json.manage?.accessEndsAt ?? data?.accessEndsAt ?? null
      );
      setMsg(
        ends
          ? manageBillingCancelScheduledToast(ends)
          : "Renewal canceled. You can turn it back on below."
      );
    } catch {
      setSurveyError("Could not schedule cancellation.");
    } finally {
      setBusy(false);
    }
  };

  const updateCard = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/billing/manage/payment-method", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "Could not start card update");
        return;
      }
      if (json.url) window.location.href = json.url;
    } catch {
      setErr("Could not start card update.");
    } finally {
      setBusy(false);
    }
  };

  const postRetention = async (
    action: "offered" | "accept" | "decline",
    input: { reasons: SubscriptionCancelReasonId[]; comment: string }
  ) => {
    const res = await fetch("/api/billing/manage/retention-offer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reasons: input.reasons,
        comment: input.comment.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Request failed");
    }
    return json;
  };

  const showRetention = async (input: {
    reasons: SubscriptionCancelReasonId[];
    comment: string;
  }) => {
    setBusy(true);
    setSurveyError(null);
    try {
      const json = await postRetention("offered", input);
      if (json.skipped) {
        await confirmCancel(input);
        return;
      }
      setPendingCancel(input);
      setSurveyStep("retention");
    } catch {
      setSurveyError("Could not load offer.");
    } finally {
      setBusy(false);
    }
  };

  const acceptRetention = async (input: {
    reasons: SubscriptionCancelReasonId[];
    comment: string;
  }) => {
    setBusy(true);
    setSurveyError(null);
    try {
      const json = await postRetention("accept", input);
      closeSurvey();
      if (json.manage) {
        setData((prev) => ({
          ...(prev ?? {}),
          ...json.manage,
          plans: prev?.plans,
        }));
      } else {
        await refresh();
      }
      setMsg("50% off applied. Your subscription stays active.");
    } catch {
      setSurveyError("Could not apply discount.");
    } finally {
      setBusy(false);
    }
  };

  const declineRetention = async (input: {
    reasons: SubscriptionCancelReasonId[];
    comment: string;
  }) => {
    setBusy(true);
    setSurveyError(null);
    try {
      await postRetention("decline", input);
      await confirmCancel(input);
    } catch {
      setSurveyError("Could not continue.");
      setBusy(false);
    }
  };

  const plans = data?.plans ?? BILLING_PLANS;
  const monthlyDisplayPrice =
    plans.monthly?.displayPrice ?? BILLING_PLANS.monthly.displayPrice;
  const canChangePlan =
    data?.status === "active" || data?.status === "trialing";

  const metaLine = useMemo(() => {
    if (!data) return "";
    const planLabel =
      data.plan === "free" ? "No plan" : data.plan.replace(/_/g, " ");
    const statusLabel = data.status.replace(/_/g, " ");
    const parts = [planLabel, statusLabel];
    if (data.cancelAtPeriodEnd && data.accessEndsAt) {
      parts.push(`ends ${formatShortDate(data.accessEndsAt)}`);
    } else if (data.trialEndsAt && data.status === "trialing") {
      parts.push(`trial ends ${formatShortDate(data.trialEndsAt)}`);
    } else if (data.renewsAt) {
      parts.push(`renews ${formatShortDate(data.renewsAt)}`);
    }
    return parts.join(" · ");
  }, [data]);

  const accessEndsLabel =
    data?.accessEndsAt ? formatShortDate(data.accessEndsAt) : null;
  const farewellCopy =
    accessEndsLabel ? manageBillingFarewellCopy(accessEndsLabel) : null;

  return (
    <div className="billing-page billing-page--manage">
      <Link href="/app/billing" className="billing-back">
        ← Back to billing
      </Link>

      <div className="billing-page-stage">
        <div className="billing-card-perspective">
          <div className="admin-panel billing-card billing-manage-card">
            <header className="billing-manage-head">
              <h1 className="billing-manage-title">Manage billing</h1>
              {data && !loading ? (
                <p className="billing-manage-meta">{metaLine}</p>
              ) : (
                <p className="billing-manage-meta billing-manage-meta-muted">
                  Plan, card, and renewal
                </p>
              )}
            </header>

            {loading ? (
              <p className="billing-manage-loading">Loading…</p>
            ) : err && !data ? (
              <p className="admin-invite-msg billing-manage-feedback">{err}</p>
            ) : data ? (
              <div className="billing-manage-stack">
                {data.cancelAtPeriodEnd && farewellCopy ? (
                  <div className="billing-manage-farewell" role="status">
                    <p className="billing-manage-farewell-title">
                      {farewellCopy.headline}
                    </p>
                    <p className="billing-manage-farewell-lead">
                      {farewellCopy.lead}
                    </p>
                  </div>
                ) : null}

                <section
                  className="settings-group billing-manage-panel"
                  aria-labelledby="billing-plan-heading"
                >
                  <h2 id="billing-plan-heading" className="billing-manage-panel-title">
                    Plan
                  </h2>
                  {canChangePlan ? (
                    <>
                      <div
                        className="billing-manage-plan-grid"
                        role="radiogroup"
                        aria-labelledby="billing-plan-heading"
                      >
                        {orderedBillingPlans(plans).map((p) => {
                          const selected = selectedPlan === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              className={`billing-manage-plan-chip${
                                selected ? " is-selected" : ""
                              }`}
                              onClick={() => setSelectedPlan(p.id)}
                              disabled={busy}
                            >
                              <span className="billing-manage-plan-chip-label">
                                {p.label}
                              </span>
                              <span className="billing-manage-plan-chip-price">
                                {p.displayPrice}
                                <span className="billing-manage-plan-chip-period">
                                  {p.displayPeriod}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="btn-primary billing-manage-save-plan"
                        disabled={busy || selectedPlan === data.plan}
                        onClick={() =>
                          void run(
                            "/api/billing/manage/plan",
                            { plan: selectedPlan },
                            "Plan updated."
                          )
                        }
                      >
                        Save plan
                      </button>
                    </>
                  ) : (
                    <p className="billing-manage-hint">
                      Update your card to change plans.
                    </p>
                  )}
                </section>

                <section
                  className="settings-group billing-manage-panel billing-manage-panel-row"
                  aria-labelledby="billing-card-heading"
                >
                  <div className="billing-manage-pay-copy">
                    <h2
                      id="billing-card-heading"
                      className="billing-manage-panel-title"
                    >
                      Card
                    </h2>
                    <p className="billing-manage-pay-value">
                      {formatCard(data.paymentMethod)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary billing-manage-pay-btn"
                    disabled={busy}
                    onClick={() => void updateCard()}
                  >
                    Update
                  </button>
                </section>

                <section
                  className={
                    data.cancelAtPeriodEnd
                      ? "billing-manage-farewell-panel"
                      : "settings-danger-zone billing-manage-danger"
                  }
                  aria-labelledby="billing-cancel-heading"
                >
                  {data.cancelAtPeriodEnd ? (
                    <>
                      <h2
                        id="billing-cancel-heading"
                        className="billing-manage-farewell-panel-title"
                      >
                        Changed your mind?
                      </h2>
                      {farewellCopy ? (
                        <p className="billing-manage-farewell-invite">
                          {farewellCopy.invite}
                        </p>
                      ) : (
                        <p className="billing-manage-farewell-invite">
                          Tap below to turn renewal back on. No new checkout.
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn-primary billing-manage-keep-btn"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            "/api/billing/manage/resume",
                            undefined,
                            manageBillingResumeToast()
                          )
                        }
                      >
                        Keep subscription
                      </button>
                    </>
                  ) : (
                    <>
                      <h2
                        id="billing-cancel-heading"
                        className="settings-group-title billing-manage-danger-title"
                      >
                        End subscription
                      </h2>
                      <p className="billing-manage-hint billing-manage-hint-danger">
                        You keep access until the end of the current period. Your
                        plan will not renew after that.
                      </p>
                      <button
                        type="button"
                        className="btn-danger-solid billing-manage-cancel-btn"
                        disabled={busy}
                        onClick={() => {
                          setSurveyError(null);
                          setSurveyStep("survey");
                          setPendingCancel(null);
                          setSurveyOpen(true);
                        }}
                      >
                        Cancel at period end
                      </button>
                    </>
                  )}
                </section>
              </div>
            ) : null}

            {(msg || err) && data ? (
              <p
                className={`billing-manage-feedback admin-invite-msg${
                  err ? " is-error" : ""
                }`}
                role="status"
              >
                {err || msg}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <CancelSubscriptionSurveyModal
        open={surveyOpen}
        busy={busy}
        error={surveyError}
        plan={data?.plan ?? "free"}
        monthlyDisplayPrice={monthlyDisplayPrice}
        step={surveyStep}
        pending={pendingCancel}
        onClose={closeSurvey}
        onConfirmCancel={(payload) => void confirmCancel(payload)}
        onShowRetention={(payload) => void showRetention(payload)}
        onRetentionAccept={(payload) => void acceptRetention(payload)}
        onRetentionDecline={(payload) => void declineRetention(payload)}
      />
    </div>
  );
}

export default function ManageBillingPage() {
  return (
    <Suspense>
      <ManageBillingInner />
    </Suspense>
  );
}
