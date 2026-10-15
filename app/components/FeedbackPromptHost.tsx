"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_BASE } from "@/lib/app-base";
import { FEEDBACK_IMMERSIVE_SELECTOR } from "@/lib/feedback";

const CHECK_EVENT = "nura-feedback-check";

export function requestFeedbackPromptCheck() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHECK_EVENT));
  }
}

export async function signalFeedbackSessionEnd() {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "session_end" }),
    });
  } catch {
    /* ignore */
  }
  requestFeedbackPromptCheck();
}

function isFeedbackAllowedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const hidePrefix = [
    `${APP_BASE}/login`,
    `${APP_BASE}/forgot-password`,
    `${APP_BASE}/reset-password`,
    `${APP_BASE}/create-password`,
    `${APP_BASE}/create-account`,
    `${APP_BASE}/onboarding`,
  ];
  return !hidePrefix.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function clientSafeToShow(): boolean {
  if (typeof document === "undefined") return false;
  // Class lives on `.app-shell`, not `body` (see AppConsoleFrame).
  if (document.querySelector(FEEDBACK_IMMERSIVE_SELECTOR)) return false;
  if (document.querySelector(".session-closure-overlay")) return false;
  if (document.querySelector(".informed-consent-gate")) return false;
  if (document.querySelector(".crisis-help-panel")) return false;
  if (document.querySelector(".admin-modal-backdrop")) return false;
  if (document.querySelector(".upgrade-modal")) return false;
  if (document.querySelector("[data-guide-root]")) return false;
  return true;
}

export function FeedbackPromptHost() {
  const pathname = usePathname();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"score" | "comment" | "thanks">("score");
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setStep("score");
    setScore(null);
    setComment("");
    setError(null);
  }, []);

  const check = useCallback(async () => {
    if (!isFeedbackAllowedPath(pathname)) return;
    if (!clientSafeToShow()) return;
    if (open) return;
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) return;
      const data = (await res.json()) as {
        show?: boolean;
        source?: string | null;
      };
      if (!data.show || !data.source) return;
      if (!clientSafeToShow()) return;
      setError(null);
      setOpen(true);
      void fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shown" }),
      });
    } catch {
      /* ignore */
    }
  }, [pathname, open]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void check();
    }, 2800);
    return () => window.clearTimeout(t);
  }, [check, pathname]);

  useEffect(() => {
    const onCheck = () => {
      window.setTimeout(() => {
        void check();
      }, 800);
    };
    window.addEventListener(CHECK_EVENT, onCheck);
    return () => window.removeEventListener(CHECK_EVENT, onCheck);
  }, [check]);

  const onAskLater = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze" }),
      });
      if (!res.ok) {
        setError("Could not save. Try again.");
        return;
      }
      close();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onPickScore = (value: number) => {
    setScore(value);
    setError(null);
    setStep("comment");
  };

  const submit = async (withComment: boolean) => {
    if (busy || score == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          score,
          comment: withComment ? comment : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          data.error === "already_submitted"
            ? "You already sent feedback."
            : "Could not send. Try again."
        );
        return;
      }
      setStep("thanks");
    } catch {
      setError("Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="feedback-nps-overlay" role="presentation">
      <div
        className="feedback-nps-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {step === "thanks" ? (
          <>
            <h2 id={titleId} className="feedback-nps-title">
              Thank you
            </h2>
            <p className="feedback-nps-lead">
              Thanks for taking a moment to share how Nura feels for you. Your
              note helps us make the app calmer and clearer.
            </p>
            <div className="feedback-nps-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={close}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className="feedback-nps-title">
              Feedback
            </h2>

            {step === "score" ? (
              <>
                <p className="feedback-nps-lead">
                  On a scale of 1–10, how likely are you to recommend this tool
                  to someone you know?
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
                      disabled={busy}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="feedback-nps-scale-labels">
                  <span>Not likely at all</span>
                  <span>Extremely likely</span>
                </div>
                {error ? <p className="feedback-nps-error">{error}</p> : null}
                <button
                  type="button"
                  className="feedback-nps-later"
                  onClick={() => void onAskLater()}
                  disabled={busy}
                >
                  Ask me later
                </button>
              </>
            ) : (
              <>
                <p className="feedback-nps-lead">
                  Anything else you want to share? Optional — you can skip and
                  just send your score.
                </p>
                <p className="feedback-nps-picked" aria-live="polite">
                  Your score: <strong>{score}</strong>
                </p>
                <label
                  className="feedback-nps-label"
                  htmlFor="feedback-nps-comment"
                >
                  Comment
                </label>
                <textarea
                  id="feedback-nps-comment"
                  className="feedback-nps-comment"
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What worked, what didn’t…"
                  disabled={busy}
                />
                {error ? <p className="feedback-nps-error">{error}</p> : null}
                <div className="feedback-nps-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void submit(true)}
                    disabled={busy}
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void submit(false)}
                    disabled={busy}
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
