"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarCheck, Check, CreditCard, Lock, Sparkles } from "lucide-react";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import {
  PAYMENT_APPEARANCE,
  paymentClientFor,
} from "@/app/components/checkout/payment-client";

export type ReactivateViewState =
  | "valid"
  | "used"
  | "expired"
  | "invalid"
  | "already_active"
  | "wrong_account"
  | "extend"
  | "extended"
  | "done";

type ClosedState = Exclude<ReactivateViewState, "valid" | "done" | "extend" | "extended">;

/** Closed link states: what happened, and the one thing to do next. */
export const REACTIVATE_CLOSED_COPY: Record<
  ClosedState,
  { title: string; body: string; cta: "app" | "support" | "settings" }
> = {
  used: {
    title: "This invite was already used",
    body: "Your free days have been set up on your account. Sign in to continue your sessions.",
    cta: "app",
  },
  expired: {
    title: "This invite has expired",
    body: "Personal invites stay open for a limited time. Reply to the email or contact support and we will send you a fresh one.",
    cta: "support",
  },
  invalid: {
    title: "We could not open this invite",
    body: "The link may be incomplete. Open it again straight from the email, or contact support and we will help.",
    cta: "support",
  },
  already_active: {
    title: "Your plan is already active",
    body: "There is nothing to set up. Your dashboard is ready when you are.",
    cta: "app",
  },
  wrong_account: {
    title: "You are signed in to a different account",
    body: "This invite belongs to another Nura account. Sign out, then open the link again.",
    cta: "settings",
  },
};

/** What the free days include (checkmark list). */
export const REACTIVATE_INCLUDED = [
  "Guided EMDR sessions with the moving ball",
  "Free sets whenever you need them",
  "No session limits for the whole period",
];

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
};

/** Stable on server and client (no hydration drift). */
export function formatInviteDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", DATE_OPTS);
}

export function inviteGreeting(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `Hi ${first}, this is your personal invite` : "Hi, this is your personal invite";
}

type Props = {
  token: string;
  state: ReactivateViewState;
  canceled: boolean;
  planLabel: string | null;
  /** e.g. "$4.99/week". */
  priceLabel: string | null;
  chargeDate: string | null;
  /** "extend": when the next payment was due before the free days. */
  currentChargeDate?: string | null;
  email: string | null;
  name?: string | null;
  /** When the invite link stops working. */
  expiresAt?: string | null;
  trialDays: number;
  signedIn: boolean;
  /** Days before the first charge the reminder email goes out (null = none). */
  reminderDays?: number | null;
};

type PayState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; clientSecret: string; publishableKey: string }
  | { kind: "redirecting" };

function SupportLine() {
  return (
    <p className="rx-help">
      Not you, or have a question? Reply to the email we sent you or{" "}
      <Link href="/support">contact support</Link>.
    </p>
  );
}

function Shell(props: { children: ReactNode; testId: string }) {
  return (
    <section className="rx-card" data-testid={props.testId}>
      {props.children}
    </section>
  );
}

export function ReactivateOfferView(props: Props) {
  const [pay, setPay] = useState<PayState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const appHref = props.signedIn ? "/app" : "/app/login?next=%2Fapp";
  const chargeOn = formatInviteDate(props.chargeDate);
  const expiresOn = formatInviteDate(props.expiresAt);
  const plan = props.planLabel ? `${props.planLabel.toLowerCase()} plan` : "plan";
  const price = props.priceLabel ? ` (${props.priceLabel})` : "";

  async function start() {
    setPay({ kind: "loading" });
    setError(null);
    try {
      const res = await fetch("/api/reactivate/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: props.token, ui: "elements" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        clientSecret?: string;
        publishableKey?: string;
        error?: string;
      };
      if (res.ok && data.clientSecret && data.publishableKey) {
        setPay({ kind: "ready", clientSecret: data.clientSecret, publishableKey: data.publishableKey });
        return;
      }
      if (res.ok && data.url) {
        setPay({ kind: "redirecting" });
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Something went wrong. Try again in a moment.");
      setPay({ kind: "idle" });
    } catch {
      setError("Something went wrong. Try again in a moment.");
      setPay({ kind: "idle" });
    }
  }

  const paymentClient = useMemo(
    () => (pay.kind === "ready" ? paymentClientFor(pay.publishableKey) : null),
    [pay]
  );

  if (props.state === "done") {
    return (
      <Shell testId="reactivate-done">
        <p className="rx-eyebrow"><Sparkles size={14} aria-hidden /> Welcome back</p>
        <h1 className="rx-title">Your {props.trialDays} free days have started</h1>
        <p className="rx-lead">
          Nothing was charged today.
          {chargeOn
            ? ` Your ${plan}${price} starts on ${chargeOn}. You can cancel any time before that in Manage billing.`
            : " You can cancel any time in Manage billing."}
        </p>
        <Link href={appHref} className="rx-cta" data-testid="reactivate-open-app">
          {props.signedIn ? "Open Nura" : "Sign in to Nura"}
        </Link>
      </Shell>
    );
  }

  if (props.state === "extended") {
    return (
      <Shell testId="reactivate-extended">
        <p className="rx-eyebrow"><Sparkles size={14} aria-hidden /> All set</p>
        <h1 className="rx-title">Your next {props.trialDays} days are on us</h1>
        <p className="rx-lead">
          Nothing was charged and your plan continues as before.
          {chargeOn ? ` Your next payment is now on ${chargeOn}.` : ""}
        </p>
        <Link href={appHref} className="rx-cta" data-testid="reactivate-open-app">
          {props.signedIn ? "Open Nura" : "Sign in to Nura"}
        </Link>
      </Shell>
    );
  }

  if (props.state === "extend") {
    const from = formatInviteDate(props.currentChargeDate);
    return (
      <Shell testId="reactivate-extend">
        <p className="rx-eyebrow">Personal invite</p>
        <h1 className="rx-title">{inviteGreeting(props.name)}</h1>
        <p className="rx-lead">
          Something in Nura did not work as it should, and we are sorry. It is fixed now, so your next{" "}
          {props.trialDays} days are on us. This link is just for you.
        </p>
        <div className="rx-offer">
          <p className="rx-offer-big">{props.trialDays} days free</p>
          <ul className="rx-checks">
            <li><Check size={18} aria-hidden /> Your plan and access stay exactly as they are</li>
            <li><Check size={18} aria-hidden /> No card details needed, nothing is charged</li>
            <li>
              <Check size={18} aria-hidden />
              {from && chargeOn
                ? `Your next payment moves from ${from} to ${chargeOn}`
                : chargeOn
                  ? `Your next payment moves to ${chargeOn}`
                  : `Your next payment moves ${props.trialDays} days later`}
            </li>
          </ul>
        </div>
        {error ? <p className="rx-error" role="alert">{error}</p> : null}
        <button
          type="button"
          className="rx-cta"
          onClick={start}
          disabled={pay.kind !== "idle"}
          data-testid="reactivate-extend-start"
        >
          {pay.kind !== "idle" ? "Adding your free days..." : `Add my ${props.trialDays} free days`}
        </button>
        {expiresOn ? <p className="rx-fine">This invite is valid until {expiresOn}.</p> : null}
        <SupportLine />
      </Shell>
    );
  }

  if (props.state !== "valid") {
    const c = REACTIVATE_CLOSED_COPY[props.state];
    const href = c.cta === "settings" ? "/app/settings" : c.cta === "support" ? "/support" : appHref;
    const label =
      c.cta === "settings"
        ? "Go to settings"
        : c.cta === "support"
          ? "Contact support"
          : props.state === "already_active"
            ? "Go to your dashboard"
            : props.signedIn
              ? "Open Nura"
              : "Sign in";
    return (
      <Shell testId={`reactivate-${props.state}`}>
        <h1 className="rx-title">{c.title}</h1>
        <p className="rx-lead">{c.body}</p>
        <Link href={href} className="rx-cta">{label}</Link>
        {c.cta !== "support" ? <SupportLine /> : null}
      </Shell>
    );
  }

  const steps = [
    {
      icon: <CreditCard size={18} aria-hidden />,
      title: "Add a card",
      body: "Nothing is charged today.",
    },
    {
      icon: <Sparkles size={18} aria-hidden />,
      title: `Use Nura free for ${props.trialDays} days`,
      body: "Full access, no limits.",
    },
    {
      icon: <CalendarCheck size={18} aria-hidden />,
      title: chargeOn ? `On ${chargeOn} your ${plan} starts` : `After ${props.trialDays} days your ${plan} starts`,
      body:
        `${props.priceLabel ? `${props.priceLabel}. ` : ""}Cancel anytime before that and you pay nothing.` +
        (props.reminderDays ? ` We will email you a reminder ${props.reminderDays} days before.` : ""),
    },
  ];

  return (
    <Shell testId="reactivate-offer">
      <header className="rx-head">
        <p className="rx-eyebrow">Personal invite</p>
        <h1 className="rx-title">{inviteGreeting(props.name)}</h1>
        <p className="rx-lead">
          Your guided sessions did not work properly before. That is fixed now, so we would like you to
          try Nura again, free. This link is just for you.
        </p>
      </header>

      <div className="rx-layout">
        <div className="rx-col">
          <div className="rx-offer" aria-label="Your offer">
            <p className="rx-offer-big">
              {props.trialDays} days <span>free</span>
            </p>
            <ul className="rx-checks">
              {REACTIVATE_INCLUDED.map((t) => (
                <li key={t}><Check size={18} aria-hidden /> {t}</li>
              ))}
            </ul>
          </div>

          <section className="rx-steps" aria-labelledby="rx-how">
            <h2 id="rx-how" className="rx-h2">How it works</h2>
            <ol>
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="rx-step-num" aria-hidden>{i + 1}</span>
                  <span className="rx-step-text">
                    <strong>{s.title}</strong>
                    <span>{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="rx-col rx-col--action">
          {pay.kind === "ready" && paymentClient ? (
            <div className="rx-pay" data-testid="reactivate-payment">
              <button
                type="button"
                className="rx-back"
                onClick={() => setPay({ kind: "idle" })}
              >
                <ArrowLeft size={15} aria-hidden /> Back
              </button>
              <CheckoutElementsProvider
                key={pay.clientSecret}
                stripe={paymentClient}
                options={{
                  clientSecret: pay.clientSecret,
                  elementsOptions: { appearance: PAYMENT_APPEARANCE },
                }}
              >
                <ReactivatePaymentForm trialDays={props.trialDays} />
              </CheckoutElementsProvider>
            </div>
          ) : (
            <div className="rx-action">
              {props.canceled ? (
                <p className="rx-note" role="status">Payment was not finished. Your invite is still here.</p>
              ) : null}
              {error ? <p className="rx-error" role="alert">{error}</p> : null}
              <button
                type="button"
                className="rx-cta rx-cta--big"
                onClick={start}
                disabled={pay.kind !== "idle"}
                data-testid="reactivate-start"
              >
                {pay.kind === "idle" ? `Start my ${props.trialDays} free days` : "Preparing secure payment..."}
              </button>
              <ul className="rx-assure">
                <li><Check size={15} aria-hidden /> No charge today</li>
                <li><Check size={15} aria-hidden /> Cancel anytime</li>
                <li><Lock size={15} aria-hidden /> Secure payment</li>
              </ul>
              {expiresOn ? (
                <p className="rx-fine" data-testid="reactivate-expiry">This invite is valid until {expiresOn}.</p>
              ) : null}
            </div>
          )}
          {props.email ? (
            <p className="rx-who">
              {props.signedIn ? "Signed in as " : "For your account "}
              <strong>{props.email}</strong>
            </p>
          ) : null}
          <SupportLine />
        </div>
      </div>
    </Shell>
  );
}

function ReactivatePaymentForm({ trialDays }: { trialDays: number }) {
  const state = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (state.type === "loading") {
    return <p className="rx-note" role="status">Loading secure payment form...</p>;
  }
  if (state.type === "error") {
    return (
      <p className="rx-error" role="alert">
        {state.error.message || "Could not load the payment form. Refresh and try again."}
      </p>
    );
  }
  const { checkout } = state;

  const confirm = async () => {
    setError("");
    setBusy(true);
    try {
      // Success returns to this page (status=success); only errors come back here.
      const result = await checkout.confirm();
      if (result.type === "error") setError(result.error.message || "That did not work. Try another card.");
    } catch {
      setError("That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rx-pay-form">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="rx-error" role="alert">{error}</p> : null}
      <button type="button" className="rx-cta rx-cta--big" disabled={busy} onClick={() => void confirm()}>
        <Lock size={16} aria-hidden />
        {busy ? "Processing..." : `Start my ${trialDays} free days`}
      </button>
      <p className="rx-fine">Nothing is charged today. Your card details are encrypted.</p>
    </div>
  );
}
