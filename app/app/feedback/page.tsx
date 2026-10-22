"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FeedbackSurvey } from "@/app/components/FeedbackSurvey";
import { APP_BASE } from "@/lib/app-base";
import { parseFeedbackSubmitSource } from "@/lib/feedback-eligibility";

type PageState = {
  submitted: boolean;
  canSubmit: boolean;
  hasQualifyingSession: boolean;
  accountAgeOk: boolean;
  reason: string;
};

function FeedbackPageInner() {
  const params = useSearchParams();
  const rawSource = params.get("source");
  const fromReview = rawSource === "review" || rawSource === "review_email";
  // Both email links may open the form before the usual account-age gate; the
  // session check still applies, so someone with no real session sees the
  // "run a session first" note instead of an empty survey.
  const fromEmail =
    rawSource === "trial" || fromReview;
  const [state, setState] = useState<PageState | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const qs = fromEmail
      ? `?source=${rawSource === "trial" ? "trial" : "review"}`
      : "";
    const res = await fetch(`/api/feedback${qs}`);
    const data = (await res.json()) as PageState & { error?: string };
    if (!res.ok) {
      setLoadError(data.error ?? "Could not load feedback");
      return;
    }
    setState(data);
  }, [fromEmail, rawSource]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = useCallback(
    async (input: { score: number; comment: string | null }) => {
      const source =
        parseFeedbackSubmitSource(
          fromReview ? "review_email" : fromEmail ? "trial" : "page"
        ) ?? "page";
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          score: input.score,
          comment: input.comment,
          source,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        return { ok: false, error: data.error };
      }
      await load();
      return { ok: true };
    },
    [fromEmail, fromReview, load]
  );

  return (
    <div className="feedback-page">
      <div className="feedback-page-inner">
        {loadError ? (
          <p className="feedback-nps-error">{loadError}</p>
        ) : state?.submitted ? (
          <div className="feedback-page-card">
            <h1 className="feedback-nps-title">Thank you</h1>
            <p className="feedback-nps-lead">
              We already have your feedback on file. Thanks again for helping us
              improve Nura.
            </p>
            <Link href={APP_BASE} className="btn-primary feedback-page-home">
              Back to Home
            </Link>
          </div>
        ) : state && !state.canSubmit ? (
          <div className="feedback-page-card">
            <h1 className="feedback-nps-title">Feedback</h1>
            {state.reason === "no_sessions" ? (
              <p className="feedback-nps-lead">
                Run at least one session in Nura before we ask for a rating. When
                you have tried the app, this page will open the short survey.
              </p>
            ) : state.reason === "account_too_new" ? (
              <p className="feedback-nps-lead">
                We ask for feedback after you have had a few days with the app.
                Check back soon, or use the link from your trial email when it
                arrives.
              </p>
            ) : (
              <p className="feedback-nps-lead">
                Feedback is not available for your account right now.
              </p>
            )}
            <Link href={APP_BASE} className="btn-secondary feedback-page-home">
              Back to Home
            </Link>
          </div>
        ) : (
          <FeedbackSurvey onSubmit={onSubmit} disabled={!state?.canSubmit} />
        )}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackPageInner />
    </Suspense>
  );
}
