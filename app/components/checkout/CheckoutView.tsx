"use client";

/**
 * Full-screen split checkout, ported from the hubcast checkout layout:
 * dark order summary on the left (plan, price, features, plan cards, totals),
 * light "Your details" + payment panel on the right with a bottom order card
 * and one big pay button. Mobile stacks the summary on top (collapsible) and
 * keeps the pay button sticky. Users never see the payment processor's name.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, Eye, EyeOff, Lock, Sparkles } from "lucide-react";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { BrandLockup } from "@/app/components/BrandLockup";
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
import {
  CHECKOUT_FEATURES,
  CHECKOUT_PLAN_SUMMARY,
  checkoutUpsell,
  passwordOk,
  passwordRules,
  payButtonLabel,
  trialBillingStart,
  yearlySavingBadge,
} from "@/lib/checkout-summary";
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
  const [summaryOpen, setSummaryOpen] = useState(false);
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
        // Fallback: hosted checkout page with the same session settings.
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
    () => (session.kind === "ready" ? paymentClientFor(session.publishableKey) : null),
    [session]
  );

  const shownTrial = session.kind === "ready" ? session.trialDays : trialDays;
  const billingStart = shownTrial > 0 ? trialBillingStart(shownTrial) : null;
  const upsell = checkoutUpsell(plans, plan);
  const saveBadge = yearlySavingBadge(plans);
  const busyPlans = session.kind === "loading" || session.kind === "redirecting";
  const priceLine = meta ? `${meta.displayPrice}${meta.displayPeriod}` : "";
  const dueTodayFallback = shownTrial > 0 ? "$0.00" : (meta?.displayPrice ?? "");

  const order = {
    meta,
    trialDays: shownTrial,
    billingStart,
  };

  let paymentArea: ReactNode;
  if (!stripeConfigured) {
    paymentArea = (
      <p className="nco-error" role="alert">
        Checkout is not available right now. Please try again later.
      </p>
    );
  } else if (!user) {
    paymentArea = null;
  } else if (user.role !== "user") {
    paymentArea = (
      <p className="nco-error" role="alert">
        This is a staff account. Sign in with a member account to subscribe.
      </p>
    );
  } else if (session.kind === "error") {
    paymentArea = (
      <div className="nco-stack">
        <p className="nco-error" role="alert">{session.message}</p>
        <button type="button" className="nco-btn-ghost" onClick={() => void startSession(plan)}>
          Try again
        </button>
      </div>
    );
  } else if (session.kind === "redirecting") {
    paymentArea = <p className="nco-muted" role="status">{session.message}</p>;
  } else if (session.kind === "ready" && stripePromise) {
    paymentArea = (
      <CheckoutElementsProvider
        key={session.clientSecret}
        stripe={stripePromise}
        options={{
          clientSecret: session.clientSecret,
          elementsOptions: { appearance: PAYMENT_APPEARANCE },
        }}
      >
        <PaymentStep
          order={order}
          ageOk={ageOk}
          onAgeConfirmed={() => setAgeOk(true)}
        />
      </CheckoutElementsProvider>
    );
  } else {
    paymentArea = <p className="nco-muted" role="status">Preparing secure payment…</p>;
  }

  return (
    <div className="nco">
      <header className="nco-bar">
        <Link href="/" className="nco-bar__logo" aria-label="Nura home">
          <BrandLockup tone="color" />
        </Link>
        <div className="nco-bar__right">
          <span className="nco-bar__secure">
            <Lock size={14} aria-hidden /> Secure checkout
          </span>
          <Link href={backHref} className="nco-bar__back">
            <ArrowLeft size={15} aria-hidden /> Back
          </Link>
        </div>
      </header>

      <div className="nco-split">
        <aside className={`nco-summary${summaryOpen ? " is-open" : ""}`} aria-label="Order summary">
          <div className="nco-summary__glow" aria-hidden />
          <div className="nco-summary__inner">
            <p className="nco-kicker">Checkout</p>
            <h1 className="nco-summary__title">Nura {meta?.label ?? ""}</h1>
            {meta ? (
              <p className="nco-summary__price">
                {meta.displayPrice}
                <span>{meta.displayPeriod}</span>
              </p>
            ) : null}
            {shownTrial > 0 ? (
              <p className="nco-summary__trial">
                $0 today · {shownTrial}-day free trial
              </p>
            ) : plan === "yearly" && saveBadge ? (
              <p className="nco-summary__trial">{saveBadge} a year vs Monthly</p>
            ) : null}
            <p className="nco-summary__tagline">{CHECKOUT_PLAN_SUMMARY[plan]}</p>

            <button
              type="button"
              className="nco-summary__toggle"
              aria-expanded={summaryOpen}
              onClick={() => setSummaryOpen((v) => !v)}
            >
              {summaryOpen ? "Hide details" : "Show details"}
              <ChevronDown size={16} aria-hidden />
            </button>

            <div className="nco-summary__details">
              {upsell ? (
                upsell.kind === "switch" ? (
                  <button
                    type="button"
                    className="nco-chip"
                    onClick={() => choosePlan("yearly")}
                    disabled={busyPlans}
                  >
                    <Sparkles size={15} aria-hidden />
                    <span>
                      <strong>Switch to Yearly</strong> and save {upsell.save} a year
                    </span>
                  </button>
                ) : (
                  <p className="nco-chip nco-chip--static">
                    <Sparkles size={15} aria-hidden />
                    <span>
                      <strong>Best value</strong> · works out to {upsell.perMonth} a month
                    </span>
                  </p>
                )
              ) : null}

              <ul className="nco-features">
                {CHECKOUT_FEATURES.map((f) => (
                  <li key={f}>
                    <Check size={16} strokeWidth={2.5} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {planIds.length > 1 ? (
              <div className="nco-plans-block">
                <p className="nco-kicker">Choose a plan</p>
                <div className="nco-plans" role="radiogroup" aria-label="Plan">
                  {planIds.map((id) => {
                    const p = plans[id]!;
                    const selected = id === plan;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`nco-plan${selected ? " is-selected" : ""}${p.highlight ? " is-featured" : ""}`}
                        onClick={() => choosePlan(id)}
                        disabled={busyPlans}
                      >
                        {p.highlight ? <span className="nco-plan__tag">Popular</span> : null}
                        <span className="nco-plan__name">{p.label}</span>
                        <span className="nco-plan__price">{p.displayPrice}</span>
                        <span className="nco-plan__period">{p.displayPeriod.replace(/^\//, "per ")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <dl className="nco-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{priceLine}</dd>
              </div>
              {shownTrial > 0 ? (
                <div>
                  <dt>{shownTrial}-day free trial</dt>
                  <dd>−{meta?.displayPrice ?? ""}</dd>
                </div>
              ) : null}
              <div className="nco-totals__due">
                <dt>Total due today</dt>
                <dd>{dueTodayFallback}</dd>
              </div>
              {billingStart ? (
                <p className="nco-totals__note">
                  Then {priceLine} from {billingStart}. Cancel anytime before then.
                </p>
              ) : null}
            </dl>
          </div>
        </aside>

        <main className="nco-main">
          <div className="nco-main__inner">
            {user ? (
              <>
                <header className="nco-head">
                  <h2 className="nco-head__title">{session.kind === "ready" ? "Payment" : "Your details"}</h2>
                  <p className="nco-head__sub">
                    {shownTrial > 0
                      ? `Add a payment method to start your ${shownTrial}-day free trial.`
                      : `Add a payment method to pay for Nura ${meta?.label ?? ""}.`}
                  </p>
                </header>
                <SignedInRow user={user} />
                {paymentArea}
                {session.kind !== "ready" ? (
                  <OrderCard order={order}>
                    <button type="button" className="nco-pay" disabled>
                      <span className="nco-pay__main">
                        <Lock size={16} aria-hidden /> {payButtonLabel(meta, shownTrial)}
                      </span>
                    </button>
                  </OrderCard>
                ) : null}
              </>
            ) : (
              <AccountStep
                plan={plan}
                source={source}
                order={order}
                disabled={!stripeConfigured}
                notice={paymentArea}
                onAuthed={setUser}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

type OrderInfo = {
  meta: BillingPlanMeta | undefined;
  trialDays: number;
  billingStart: string | null;
};

/** Bottom order card + the one big button (sticky on mobile). */
function OrderCard({
  order,
  dueToday,
  children,
}: {
  order: OrderInfo;
  dueToday?: string | null;
  children: ReactNode;
}) {
  const { meta, trialDays, billingStart } = order;
  const due = dueToday ?? (trialDays > 0 ? "$0.00" : meta?.displayPrice ?? "");
  return (
    <div className="nco-order">
      <div className="nco-order__card">
        <div className="nco-order__row">
          <span>
            Nura {meta?.label ?? ""}
            <span className="nco-order__period"> · {trialDays > 0 ? `${trialDays}-day free trial` : meta?.displayPeriod.replace(/^\//, "per ")}</span>
          </span>
          <strong>{due} today</strong>
        </div>
        {billingStart && meta ? (
          <p className="nco-order__note">
            Then {meta.displayPrice}{meta.displayPeriod} from {billingStart}.
          </p>
        ) : null}
        {children}
      </div>
      <p className="nco-order__secure">
        <Lock size={13} aria-hidden /> Payments are secure and encrypted
      </p>
    </div>
  );
}

function SignedInRow({ user }: { user: SignedIn }) {
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  };
  return (
    <div className="nco-signed-in">
      <span>
        Signed in as <strong>{user.email}</strong>
      </span>
      <button type="button" className="nco-link" onClick={() => void signOut()}>
        Not you?
      </button>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  mode,
}: {
  value: string;
  onChange: (v: string) => void;
  mode: "signup" | "signin";
}) {
  const [show, setShow] = useState(false);
  const rules = passwordRules(value);
  return (
    <div className="nco-field">
      <label htmlFor="nco-password">Password</label>
      <div className="nco-password">
        <input
          id="nco-password"
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "Create a password" : "Your password"}
        />
        <button
          type="button"
          className="nco-password__eye"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {mode === "signup" ? (
        <ul className="nco-rules" aria-live="polite">
          {rules.map((r) => (
            <li key={r.id} className={r.ok ? "is-ok" : ""}>
              <Check size={13} strokeWidth={3} aria-hidden />
              {r.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AccountStep({
  plan,
  source,
  order,
  disabled,
  notice,
  onAuthed,
}: {
  plan: BillingPlanId;
  source: CheckoutSource;
  order: OrderInfo;
  disabled: boolean;
  notice: ReactNode;
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
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && !passwordOk(password)) {
      setError("Password must be at least 8 characters with a letter and a number.");
      return;
    }
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

  const what = order.trialDays > 0
    ? `start your ${order.trialDays}-day free trial`
    : `pay for Nura ${order.meta?.label ?? ""}`;

  return (
    <form onSubmit={submit} className="nco-form" noValidate>
      <header className="nco-head">
        <h2 className="nco-head__title">{mode === "signup" ? "Your details" : "Welcome back"}</h2>
        <p className="nco-head__sub">
          {mode === "signup"
            ? `Create your account, then ${what}.`
            : `Sign in, then ${what}.`}
        </p>
        <p className="nco-switch">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button type="button" className="nco-link" onClick={() => switchMode("signin")}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Nura?{" "}
              <button type="button" className="nco-link" onClick={() => switchMode("signup")}>
                Create an account
              </button>
            </>
          )}
        </p>
      </header>

      {notice}

      <GoogleAuthButton
        next={next}
        from={mode === "signup" ? "create-account" : "login"}
        className="nco-google"
        disabled={disabled}
      />
      <p className="nco-or"><span>or</span></p>

      {error ? <p className="nco-error" role="alert">{error}</p> : null}

      <div className="nco-field">
        <label htmlFor="nco-email">Email</label>
        <input
          id="nco-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <PasswordField value={password} onChange={setPassword} mode={mode} />
      {mode === "signup" ? (
        <div className="nco-field">
          <label htmlFor="nco-name">
            First name <em>(optional)</em>
          </label>
          <input
            id="nco-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            placeholder="What should Nura call you?"
          />
        </div>
      ) : (
        <Link href="/app/forgot-password" className="nco-link nco-forgot">
          Forgot password?
        </Link>
      )}
      {mode === "signup" ? (
        <label className="nco-check">
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
          <span>I confirm I am 18 or older.</span>
        </label>
      ) : null}
      <TurnstileField
        key={mode}
        ref={turnstileRef}
        action={mode === "signup" ? "signup" : "login"}
        onToken={setToken}
      />

      <OrderCard order={order}>
        <button type="submit" className="nco-pay" disabled={busy || disabled}>
          <span className="nco-pay__main">
            {busy
              ? mode === "signup"
                ? "Creating account\u2026"
                : "Signing in\u2026"
              : "Continue to payment"}
          </span>
          <span className="nco-pay__sub">
            {mode === "signup" ? "Create account" : "Sign in"} · then {payButtonLabel(order.meta, order.trialDays).toLowerCase()}
          </span>
        </button>
      </OrderCard>
      <p className="nco-fine">
        By continuing you agree to the <Link href="/terms">Terms</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </form>
  );
}

function PaymentStep({
  order,
  ageOk,
  onAgeConfirmed,
}: {
  order: OrderInfo;
  ageOk: boolean | null;
  onAgeConfirmed: () => void;
}) {
  const state = useCheckoutElements();
  const [age, setAge] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoMsg, setPromoMsg] = useState("");

  if (state.type === "loading") {
    return <p className="nco-muted" role="status">Loading secure payment form…</p>;
  }
  if (state.type === "error") {
    return (
      <p className="nco-error" role="alert">
        {state.error.message || "Could not load the payment form. Refresh and try again."}
      </p>
    );
  }
  const { checkout } = state;
  const dueToday = checkout.total?.total?.amount ?? null;
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
    <div className="nco-payment">
      <PaymentElement options={{ layout: "tabs" }} />

      {promoOpen ? (
        <div className="nco-promo">
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Promo code"
            aria-label="Promo code"
          />
          <button type="button" className="nco-btn-ghost" onClick={() => void applyPromo()}>
            Apply
          </button>
        </div>
      ) : (
        <button type="button" className="nco-link nco-promo-toggle" onClick={() => setPromoOpen(true)}>
          Have a promo code?
        </button>
      )}
      {promoMsg ? <p className="nco-muted">{promoMsg}</p> : null}

      {needAge ? (
        <label className="nco-check">
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
          <span>I confirm I am 18 or older.</span>
        </label>
      ) : null}

      {error ? <p className="nco-error" role="alert">{error}</p> : null}

      <OrderCard order={order} dueToday={dueToday}>
        <button
          type="button"
          className="nco-pay"
          disabled={busy || ageOk === null}
          onClick={() => void pay()}
        >
          <span className="nco-pay__main">
            <Lock size={16} aria-hidden />
            {busy ? "Processing\u2026" : payButtonLabel(order.meta, order.trialDays)}
          </span>
          <span className="nco-pay__sub">
            Nura {order.meta?.label ?? ""} · {dueToday ?? (order.trialDays > 0 ? "$0.00" : order.meta?.displayPrice)} today
          </span>
        </button>
      </OrderCard>
    </div>
  );
}
