"use client";

import Link from "next/link";
import { FeedbackSurvey } from "@/app/components/FeedbackSurvey";

export type ReviewInviteState = "valid" | "used" | "expired" | "invalid";

const CLOSED: Record<
  Exclude<ReviewInviteState, "valid">,
  { title: string; body: string }
> = {
  used: {
    title: "Thank you",
    body: "This review has already been sent. We have it, and we are grateful you took the time.",
  },
  expired: {
    title: "This link has expired",
    body: "Review links stay open for a few months. If you would still like to share how Nura felt, reply to the email that brought you here.",
  },
  invalid: {
    title: "This link is not valid",
    body: "The address may have been copied incompletely, or replaced by a newer review email. Open the most recent one and try again.",
  },
};

export function ReviewInviteView({
  token,
  state,
}: {
  token: string;
  state: ReviewInviteState;
}) {
  if (state !== "valid") {
    const copy = CLOSED[state];
    return (
      <div className="feedback-page-card">
        <h1 className="feedback-nps-title">{copy.title}</h1>
        <p className="feedback-nps-lead">{copy.body}</p>
        <Link href="/" className="btn-primary feedback-page-home">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <FeedbackSurvey
      onSubmit={async (input) => {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            score: input.score,
            comment: input.comment,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          return { ok: false, error: data.error ?? "Could not send. Try again." };
        }
        return { ok: true };
      }}
    />
  );
}
