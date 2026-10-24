"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { GoogleAuthButton } from "@/app/components/GoogleAuthButton";
import {
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/app/components/TurnstileField";
import {
  BILLING_PLAN_ORDER,
  type BillingPlanId,
  type BillingPlanMeta,
} from "@/lib/billing-constants";
import {
  checkoutBackHref,
  checkoutConflictRedirect,
  type CheckoutSource,
} from "@/lib/checkout-page";
import { metaMoneyFromPlanPrice, trackMetaEvent } from "@/lib/meta-pixel";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile-shared";
import { PAYMENT_APPEARANCE, paymentClientFor } from "./payment-client";
import "./checkout.css";

type SignedIn = { email: string; name: string | null; role: string };

type Props = {
  initialPlan: BillingPlanId;
  plans: Partial<Record<BillingPlanId, BillingPlanMeta>>;
  source: CheckoutSource;
  trialDays: number;
  stripeConfigured: boolean;
  signedIn: SignedIn | null;
};

type SessionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; clientSecret: string; publishableKey: string; trialDays: number }
  | { kind: "redirecting"; message: string }
  | { kind: "error"; message: string };

const APPEARANCE = PAYMENT_APPEARANCE;
const stripeFor = paymentClientFor;

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

export function CheckoutView({
  initialPlan,
  plans,
  source,
  trialDays,
  stripeConfigured,
  signedIn,
}: Props) {
  const [plan, setPlan] = useState<BillingPlanId>(initialPlan);
  const [user, setUser] = useState<SignedIn | null>(signedIn);
  const [session, setSession] = useState<SessionState>({ kind: "idle" });
  const [ageOk, setAgeOk] = useState<boolean | null>(null);
  const startedFor = useRef<string>("");

  const meta = plans[plan];
  const planIds = BILLING_PLAN_ORDER.filter((id) => plans[id]);
  const backHref = checkoutBackHref(source, Boolean(user));

  const startSession = useCallback(async (forPlan: BillingPlanId) => {
    setSession({ kind: "loading" });
    try {
      const { res, data } = await postJson("/api/billing/checkout", {
        plan: forPlan,
        source,
        ui: "elements",
      });
      if (res.status === 409) {
        const dest = checkoutConflictRedirect(data.code) ?? "/app/billing/manage";
        setSession({
          kind: "redirecting",
          message:
            typeof data.error === "string"
              ? `${data.error}. Taking you to Manage billing\u2026`
              : "You already have a subscription. Taking you to Manage billing\u2026",
        });
        window.location.assign(dest);
        return;
      }
      if (res.status === 503 && data.code === "elements_unavailable") {
        // Fallback: Stripe-hosted Checkout with the same session settings.
        const hosted = await postJson("/api/billing/checkout", { plan: forPlan, source });
        if (hosted.res.ok && typeof hosted.data.url === "string") {
          setSession({ kind: "redirecting", message: "Opening secure checkout\u2026" });
          window.location.assign(hosted.data.url);
          return;
        }
        setSession({
          kind: "error",
          message: (hosted.data.error as string) || "Checkout unavailable.",
        });
        return;
      }
      if (
        !res.ok ||
        typeof data.clientSecret !== "string" ||
        typeof data.publishableKey !== "string"
      ) {
        setSession({
          kind: "error",
          message: (data.error as string) || "Checkout unavailable. Try again.",
        });
        return;
      }
      trackMetaEvent("InitiateCheckout", {
        ...metaMoneyFromPlanPrice(plans[forPlan]?.displayPrice),
        content_name: forPlan,
        content_category: "subscription",
      });
      setSession({
        kind: "ready",
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        trialDays: typeof data.trialDays === "number" ? data.trialDays : 0,
      });
    } catch {
      setSession({ kind: "error", message: "Network error. Try again." });
    }
  }, [plans, source]);

  // Start (or restart after a plan switch) once someone is signed in.
  useEffect(() => {
    if (!user || !stripeConfigured || user.role !== "user") return;
    const key = `${user.email}:${plan}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    void startSession(plan);
  }, [user, plan, stripeConfigured, startSession]);

  // Age confirmation (18+) is recorded before payment, as onboarding does.
  useEffect(() => {
    if (!user || user.role !== "user") return;
    let cancelled = false;
    fetch("/api/consents")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ageOk?: boolean } | null) => {
        if (!cancelled) setAgeOk(Boolean(d?.ageOk));
      })
      .catch(() => {
        if (!cancelled) setAgeOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const choosePlan = (id: BillingPlanId) => {
    if (id === plan) return;
    setPlan(id);
    const url = new URL(window.location.href);
    url.searchParams.set("plan", id);
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  const stripePromise = useMemo(
    () => (session.kind === "ready" ? stripeFor(session.publishableKey) : null),
    [session]
  );

  const shownTrial = session.kind === "ready" ? session.trialDays : trialDays;

  return (
    <main className="nura-checkout">
      <div className="nura-checkout__inner">
        <Link href={backHref} className="nura-checkout__back">
          <ArrowLeft size={16} aria-hidden /> Back
        </Link>
        <header className="nura-checkout__head">
          <h1 className="nura-checkout__title">Checkout</h1>
          <p className="nura-checkout__sub">
            Your account and payment, all on this page.
          </p>
        </header>

        <div className="nura-checkout__grid">
          <div className="nura-checkout__main">
            <section className="nura-checkout__card" aria-labelledby="co-account">
              <h2 id="co-account" className="nura-checkout__step">
                <span className="nura-checkout__step-num">1</span> Account
              </h2>
              {user ? (
                <SignedInRow user={user} />
              ) : (
                <AccountStep plan={plan} source={source} onAuthed={setUser} />
              )}
            </section>

            <section
              className={`nura-checkout__card${user ? "" : " nura-checkout__card--locked"}`}
              aria-labelledby="co-pay"
            >
              <h2 id="co-pay" className="nura-checkout__step">
                <span className="nura-checkout__step-num">2</span> Payment
              </h2>
              {!stripeConfigured ? (
                <p className="nura-checkout__error" role="alert">
                  Checkout is not available right now. Please try again later.
                </p>
              ) : !user ? (
                <p className="nura-checkout__muted">
                  Create an account or sign in above to continue to payment.
                </p>
              ) : user.role !== "user" ? (
                <p className="nura-checkout__error" role="alert">
                  This is a staff account. Sign in with a member account to subscribe.
                </p>
              ) : session.kind === "error" ? (
                <div>
                  <p className="nura-checkout__error" role="alert">{session.message}</p>
                  <button
                    type="button"
                    className="nura-checkout__btn nura-checkout__btn--ghost"
                    onClick={() => void startSession(plan)}
                  >
                    Try again
                  </button>
                </div>
              ) : session.kind === "redirecting" ? (
                <p className="nura-checkout__muted" role="status">{session.message}</p>
              ) : session.kind === "ready" && stripePromise ? (
                <CheckoutElementsProvider
                  key={session.clientSecret}
                  stripe={stripePromise}
                  options={{
                    clientSecret: session.clientSecret,
                    elementsOptions: { appearance: APPEARANCE },
                  }}
                >
                  <PaymentStep
                    trialDays={session.trialDays}
                    ageOk={ageOk}
                    onAgeConfirmed={() => setAgeOk(true)}
                  />
                </CheckoutElementsProvider>
              ) : (
                <p className="nura-checkout__muted" role="status">Preparing secure payment…</p>
              )}
            </section>
          </div>

          <aside className="nura-checkout__summary" aria-label="Order summary">
            <h2 className="nura-checkout__summary-title">Your plan</h2>
            {planIds.length > 1 ? (
              <div className="nura-checkout__plans" role="radiogroup" aria-label="Plan">
                {planIds.map((id) => {
                  const p = plans[id]!;
                  const selected = id === plan;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`nura-checkout__plan${selected ? " is-selected" : ""}`}
                      onClick={() => choosePlan(id)}
                      disabled={session.kind === "loading" || session.kind === "redirecting"}
                    >
                      <span className="nura-checkout__plan-name">{p.label}</span>
                      <span className="nura-checkout__plan-price">
                        {p.displayPrice}
                        <span>{p.displayPeriod}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {meta ? (
              <dl className="nura-checkout__totals">
                <div>
                  <dt>Nura {meta.label}</dt>
                  <dd>
                    {meta.displayPrice}
                    {meta.displayPeriod}
                  </dd>
                </div>
                {shownTrial > 0 ? (
                  <div>
                    <dt>Free trial</dt>
                    <dd>{shownTrial} days</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <ul className="nura-checkout__perks">
              {shownTrial > 0 ? (
                <li>
                  <Check size={15} aria-hidden /> Nothing charged today. Your plan starts after the {shownTrial}-day trial.
                </li>
              ) : null}
              <li>
                <Check size={15} aria-hidden /> Cancel anytime from Manage billing.
              </li>
              <li>
                <Lock size={15} aria-hidden /> Secure payment. Your card details are encrypted.
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SignedInRow({ user }: { user: SignedIn }) {
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  };
  return (
    <div className="nura-checkout__signed-in">
      <span>
        Signed in as <strong>{user.email}</strong>
      </span>
      <button type="button" className="nura-checkout__link" onClick={() => void signOut()}>
        Not you?
      </button>
    </div>
  );
}

function AccountStep({
  plan,
  source,
  onAuthed,
}: {
  plan: BillingPlanId;
  source: CheckoutSource;
  onAuthed: (user: SignedIn) => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<TurnstileFieldHandle>(null);

  const next = `/app/checkout?${new URLSearchParams({
    plan,
    ...(source !== "pricing" ? { from: source } : {}),
  }).toString()}`;

  const switchMode = (m: "signup" | "signin") => {
    setMode(m);
    setError("");
    setToken(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && !age) {
      setError("Please confirm you are 18 or older.");
      return;
    }
    if (!token) {
      setError("Complete the verification check, then try again.");
      return;
    }
    setBusy(true);
    try {
      const { res, data } =
        mode === "signup"
          ? await postJson("/api/auth/register", {
              email,
              password,
              name: name.trim() || undefined,
              [TURNSTILE_TOKEN_FIELD]: token,
            })
          : await postJson("/api/auth/login", {
              email,
              password,
              [TURNSTILE_TOKEN_FIELD]: token,
            });
      if (!res.ok) {
        const msg = (data.error as string) || (mode === "signup" ? "Could not create account" : "Sign in failed");
        setError(msg);
        if (res.status === 409 && mode === "signup") setMode("signin");
        turnstileRef.current?.reset();
        setToken(null);
        return;
      }
      const u = (data.user ?? {}) as { email?: string; name?: string | null; role?: string };
      if (mode === "signup") {
        trackMetaEvent(
          "CompleteRegistration",
          { status: true, content_name: "email" },
          { onceKey: "complete_registration" }
        );
        await postJson("/api/consents", { action: "age_18" }).catch(() => undefined);
      }
      onAuthed({
        email: u.email ?? email,
        name: u.name ?? null,
        role: u.role ?? "user",
      });
    } catch {
      setError("Network error. Try again.");
      turnstileRef.current?.reset();
      setToken(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="nura-checkout__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "is-active" : ""}
          onClick={() => switchMode("signup")}
        >
          New to Nura
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "is-active" : ""}
          onClick={() => switchMode("signin")}
        >
          I have an account
        </button>
      </div>

      <GoogleAuthButton
        next={next}
        from={mode === "signup" ? "create-account" : "login"}
        className="nura-checkout__google"
      />
      <p className="nura-checkout__or"><span>or with email</span></p>

      <form onSubmit={submit} className="nura-checkout__form" noValidate>
        {error ? <p className="nura-checkout__error" role="alert">{error}</p> : null}
        {mode === "signup" ? (
          <label className="nura-checkout__field">
            <span>Name <em>(optional)</em></span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label className="nura-checkout__field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label className="nura-checkout__field">
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "At least 8 characters, a letter and a number" : ""}
          />
        </label>
        {mode === "signin" ? (
          <Link href="/app/forgot-password" className="nura-checkout__link nura-checkout__forgot">
            Forgot password?
          </Link>
        ) : (
          <label className="nura-checkout__check">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
            <span>I confirm I am 18 or older.</span>
          </label>
        )}
        <TurnstileField
          key={mode}
          ref={turnstileRef}
          action={mode === "signup" ? "signup" : "login"}
          onToken={setToken}
        />
        <button
          type="submit"
          disabled={busy || !token}
          className="nura-checkout__btn"
        >
          {busy
            ? mode === "signup"
              ? "Creating account\u2026"
              : "Signing in\u2026"
            : mode === "signup"
              ? "Create account and continue"
              : "Sign in and continue"}
        </button>
        {mode === "signup" ? (
          <p className="nura-checkout__fine">
            By continuing you agree to the <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        ) : null}
      </form>
    </div>
  );
}

function PaymentStep({
  trialDays,
  ageOk,
  onAgeConfirmed,
}: {
  trialDays: number;
  ageOk: boolean | null;
  onAgeConfirmed: () => void;
}) {
  const state = useCheckoutElements();
  const [age, setAge] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoMsg, setPromoMsg] = useState("");

  if (state.type === "loading") {
    return <p className="nura-checkout__muted" role="status">Loading secure payment form…</p>;
  }
  if (state.type === "error") {
    return (
      <p className="nura-checkout__error" role="alert">
        {state.error.message || "Could not load the payment form. Refresh and try again."}
      </p>
    );
  }
  const { checkout } = state;
  const dueToday = checkout.total?.total?.amount;
  const needAge = ageOk === false;

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code) return;
    setPromoMsg("");
    const r = await checkout.applyPromotionCode(code);
    setPromoMsg(r.type === "error" ? r.error.message : "Code applied.");
  };

  const pay = async () => {
    setError("");
    if (needAge && !age) {
      setError("Please confirm you are 18 or older.");
      return;
    }
    setBusy(true);
    try {
      if (needAge) {
        const r = await fetch("/api/consents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "age_18" }),
        });
        if (!r.ok) {
          setError("Could not save your age confirmation. Try again.");
          return;
        }
        onAgeConfirmed();
      }
      // Redirects to the session return_url on success, including after a
      // 3D Secure challenge; only errors come back here.
      const result = await checkout.confirm();
      if (result.type === "error") {
        setError(result.error.message || "Payment failed. Try another card.");
      }
    } catch {
      setError("Payment failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nura-checkout__pay">
      <PaymentElement options={{ layout: "tabs" }} />

      <div className="nura-checkout__promo">
        <input
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          placeholder="Promo code"
          aria-label="Promo code"
        />
        <button type="button" className="nura-checkout__btn nura-checkout__btn--ghost" onClick={() => void applyPromo()}>
          Apply
        </button>
      </div>
      {promoMsg ? <p className="nura-checkout__muted">{promoMsg}</p> : null}

      {needAge ? (
        <label className="nura-checkout__check">
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
          <span>I confirm I am 18 or older.</span>
        </label>
      ) : null}

      {error ? <p className="nura-checkout__error" role="alert">{error}</p> : null}

      {dueToday ? (
        <p className="nura-checkout__due">
          Due today <strong>{dueToday}</strong>
        </p>
      ) : null}

      <button
        type="button"
        className="nura-checkout__btn nura-checkout__btn--pay"
        disabled={busy || ageOk === null}
        onClick={() => void pay()}
      >
        <Lock size={16} aria-hidden />
        {busy ? "Processing\u2026" : trialDays > 0 ? `Start ${trialDays}-day free trial` : "Subscribe"}
      </button>
    </div>
  );
}
