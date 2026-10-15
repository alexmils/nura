"use client";

import { useId, useState } from "react";

type Step = "score" | "comment" | "thanks";

type Props = {
  onSubmit: (input: {
    score: number;
    comment: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
  className?: string;
};

export function FeedbackSurvey({ onSubmit, disabled, className }: Props) {
  const titleId = useId();
  const [step, setStep] = useState<Step>("score");
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickScore = (value: number) => {
    setScore(value);
    setError(null);
    setStep("comment");
  };

  const submit = async (withComment: boolean) => {
    if (busy || score == null || disabled) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit({
      score,
      comment: withComment ? comment : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(
        result.error === "already_submitted"
          ? "You already sent feedback."
          : result.error ?? "Could not send. Try again."
      );
      return;
    }
    setStep("thanks");
  };

  return (
    <div className={className ?? "feedback-page-card"}>
      {step === "thanks" ? (
        <>
          <h1 id={titleId} className="feedback-nps-title">
            Thank you
          </h1>
          <p className="feedback-nps-lead">
            Thanks for taking a moment to share how Nura feels for you. Your
            note helps us make the app calmer and clearer.
          </p>
        </>
      ) : (
        <>
          <h1 id={titleId} className="feedback-nps-title">
            Feedback
          </h1>

          {step === "score" ? (
            <>
              <p className="feedback-nps-lead">
                On a scale of 1–10, how likely are you to recommend Nura to
                someone you know?
              </p>
              <div
                className="feedback-nps-scale"
                role="radiogroup"
                aria-label="Likelihood to recommend, 1 to 10"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={score === n}
                    className="feedback-nps-score"
                    onClick={() => onPickScore(n)}
                    disabled={busy || disabled}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="feedback-nps-scale-labels">
                <span>Not likely at all</span>
                <span>Extremely likely</span>
              </div>
            </>
          ) : (
            <>
              <p className="feedback-nps-lead">
                Suggestions, bugs, or anything we should know? Optional. You can
                skip and send only your score.
              </p>
              <p className="feedback-nps-picked" aria-live="polite">
                Your score: <strong>{score}</strong>
              </p>
              <label
                className="feedback-nps-label"
                htmlFor="feedback-page-comment"
              >
                Your note
              </label>
              <textarea
                id="feedback-page-comment"
                className="feedback-nps-comment"
                rows={5}
                maxLength={2000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What worked, what felt confusing, bugs you hit…"
                disabled={busy || disabled}
              />
              <div className="feedback-nps-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void submit(true)}
                  disabled={busy || disabled}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void submit(false)}
                  disabled={busy || disabled}
                >
                  Skip
                </button>
              </div>
            </>
          )}
          {error ? <p className="feedback-nps-error">{error}</p> : null}
        </>
      )}
    </div>
  );
}
