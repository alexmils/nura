"use client";

import Link from "next/link";
import { useState } from "react";

export type ReactivateViewState =
  | "valid"
  | "used"
  | "expired"
  | "invalid"
  | "already_active"
  | "wrong_account"
  | "done";

const CLOSED: Record<Exclude<ReactivateViewState, "valid" | "done">, { title: string; body: string }> = {
  used: {
    title: "This link was already used",
    body: "Your free month has been set up. Sign in to continue your sessions.",
  },
  expired: {
    title: "This link has expired",
    body: "Offer links stay open for 30 days. Write to us from the support page and we will send a fresh one.",
  },
  invalid: {
    title: "This link is not valid",
    body: "Check that the whole link was copied from the email. If it still does not open, contact support.",
  },
  already_active: {
    title: "Your plan is already active",
    body: "There is nothing to set up. Sign in and pick up where you left off.",
  },
  wrong_account: {
    title: "You are signed in to a different account",
    body: "This offer belongs to another Nura account. Sign out, then open the link again.",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ReactivateOfferView(props: {
  token: string;
  state: ReactivateViewState;
  canceled: boolean;
  planLabel: string | null;
  priceLabel: string | null;
  chargeDate: string | null;
  email: string | null;
  trialDays: number;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reactivate/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: props.token }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout failed. Try again in a moment.");
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Checkout failed. Try again in a moment.");
      setBusy(false);
    }
  }

  const openApp = props.signedIn ? "/app" : "/app/login?next=%2Fapp";

  if (props.state === "done") {
    return (
      <section className="reactivate-card" data-testid="reactivate-done">
        <p className="reactivate-eyebrow">Welcome back</p>
        <h1 className="reactivate-title">Your free month has started</h1>
        <p className="reactivate-body">
          You have full access for {props.trialDays} days. Nothing was charged today.
          {props.chargeDate ? ` The first charge is on ${formatDate(props.chargeDate)}, and you can cancel any time before that in Manage billing.` : ""}
        </p>
        <Link href={openApp} className="reactivate-cta" data-testid="reactivate-open-app">
          {props.signedIn ? "Open Nura" : "Sign in to Nura"}
        </Link>
      </section>
    );
  }

  if (props.state !== "valid") {
    const c = CLOSED[props.state];
    return (
      <section className="reactivate-card" data-testid={`reactivate-${props.state}`}>
        <h1 className="reactivate-title">{c.title}</h1>
        <p className="reactivate-body">{c.body}</p>
        <Link href={props.state === "wrong_account" ? "/app/settings" : openApp} className="reactivate-cta reactivate-cta--quiet">
          {props.state === "wrong_account" ? "Go to settings" : props.signedIn ? "Open Nura" : "Sign in"}
        </Link>
      </section>
    );
  }

  return (
    <section className="reactivate-card" data-testid="reactivate-offer">
      <p className="reactivate-eyebrow">A fresh start</p>
      <h1 className="reactivate-title">{props.trialDays} days of Nura, on us</h1>
      <p className="reactivate-body">
        Some guided sessions did not start the moving ball when they should have. That is fixed now,
        and we would like you to try again properly, free for {props.trialDays} days.
      </p>
      <ul className="reactivate-points">
        <li>Full access: guided sessions and free sets, no trial limits.</li>
        <li>Nothing is charged today. Your card is only kept on file.</li>
        <li>
          {props.planLabel ? `${props.planLabel} plan` : "Your plan"}
          {props.priceLabel ? ` (${props.priceLabel})` : ""} starts on {formatDate(props.chargeDate)} unless you cancel before.
        </li>
      </ul>
      {props.canceled ? (
        <p className="reactivate-note" role="status">Checkout was closed. Your offer is still here.</p>
      ) : null}
      {error ? (
        <p className="reactivate-error" role="alert">{error}</p>
      ) : null}
      <button
        type="button"
        className="reactivate-cta"
        onClick={start}
        disabled={busy}
        data-testid="reactivate-start"
      >
        {busy ? "Opening secure checkout..." : `Start my free ${props.trialDays} days`}
      </button>
      {props.email ? <p className="reactivate-foot">For {props.email}. Card details are handled by Stripe.</p> : null}
    </section>
  );
}
