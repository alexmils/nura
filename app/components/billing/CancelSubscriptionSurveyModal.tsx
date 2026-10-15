"use client";

import { useEffect, useId, useState } from "react";
import {
  SUBSCRIPTION_CANCEL_REASONS,
  type SubscriptionCancelReasonId,
} from "@/lib/subscription-cancel-reasons";
import { retentionOfferCopy } from "@/lib/subscription-retention-shared";

type PendingCancel = {
  reasons: SubscriptionCancelReasonId[];
  comment: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  error: string | null;
  plan: string;
  monthlyDisplayPrice: string;
  step: "survey" | "retention";
  pending: PendingCancel | null;
  onClose: () => void;
  onConfirmCancel: (input: PendingCancel) => void;
  onShowRetention: (input: PendingCancel) => void;
  onRetentionAccept: (input: PendingCancel) => void;
  onRetentionDecline: (input: PendingCancel) => void;
};

export function CancelSubscriptionSurveyModal({
  open,
  busy,
  error,
  plan,
  monthlyDisplayPrice,
  step,
  pending,
  onClose,
  onConfirmCancel,
  onShowRetention,
  onRetentionAccept,
  onRetentionDecline,
}: Props) {
  const titleId = useId();
  const retentionTitleId = useId();
  const [selectedId, setSelectedId] =
    useState<SubscriptionCancelReasonId | null>(null);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setComment("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const pickReason = (id: SubscriptionCancelReasonId) => {
    setSelectedId(id);
    if (id !== "other") setComment("");
  };

  const showOtherField = selectedId === "other";
  const needsOtherText = showOtherField && !comment.trim();
  const canSubmit = selectedId !== null && !needsOtherText;

  const buildPending = (): PendingCancel => ({
    reasons: selectedId ? [selectedId] : [],
    comment,
  });

  const tryProceedToCancel = () => {
    if (!canSubmit) return;
    const payload = buildPending();
    const retentionEligible =
      plan === "monthly" && payload.reasons.includes("too_expensive");
    if (retentionEligible) {
      onShowRetention(payload);
      return;
    }
    onConfirmCancel(payload);
  };

  const retentionCopy = retentionOfferCopy(monthlyDisplayPrice);

  if (step === "retention" && pending) {
    return (
      <div
        className="billing-cancel-survey-overlay"
        role="presentation"
        onClick={() => {
          if (!busy) onClose();
        }}
      >
        <div
          className="billing-cancel-survey-modal admin-panel billing-retention-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={retentionTitleId}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={retentionTitleId} className="billing-cancel-survey-title">
            {retentionCopy.headline}
          </h2>
          <p className="billing-cancel-survey-lead">{retentionCopy.lead}</p>
          <p className="billing-retention-price">{retentionCopy.priceLine}</p>

          {error ? (
            <p className="billing-cancel-survey-error" role="alert">{error}</p>
          ) : null}

          <div className="billing-cancel-survey-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => onRetentionDecline(pending)}
            >
              No thanks, cancel anyway
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => onRetentionAccept(pending)}
            >
              {busy ? "Applying…" : "Take 50% off and stay"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="billing-cancel-survey-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="billing-cancel-survey-modal admin-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="billing-cancel-survey-title">
          Before you go
        </h2>
        <p className="billing-cancel-survey-lead">
          What made you cancel? Pick one. This helps us improve Nura.
        </p>

        <ul
          className="billing-cancel-survey-list"
          role="radiogroup"
          aria-labelledby={titleId}
        >
          {SUBSCRIPTION_CANCEL_REASONS.map((reason) => {
            const on = selectedId === reason.id;
            return (
              <li key={reason.id}>
                <button
                  type="button"
                  className={`billing-cancel-survey-option billing-cancel-survey-option--radio${
                    on ? " is-on" : ""
                  }`}
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => pickReason(reason.id)}
                >
                  <span className="billing-cancel-survey-check" aria-hidden />
                  <span>{reason.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {showOtherField ? (
          <label className="billing-cancel-survey-other">
            <span className="billing-cancel-survey-other-label">
              A few words (required for Something else)
            </span>
            <textarea
              className="field billing-cancel-survey-textarea"
              rows={3}
              maxLength={500}
              value={comment}
              disabled={busy}
              placeholder="What would have helped you stay?"
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        ) : null}

        {error ? (
          <p className="billing-cancel-survey-error" role="alert">{error}</p>
        ) : null}

        <div className="billing-cancel-survey-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Keep subscription
          </button>
          <button
            type="button"
            className="btn-danger-solid"
            disabled={busy || !canSubmit}
            onClick={tryProceedToCancel}
          >
            {busy ? "Working…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
