"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import {
  AuthShell,
  AuthField,
  AuthError,
  AuthLink,
} from "@/app/components/AuthShell";
import { GoogleAuthButton } from "@/app/components/GoogleAuthButton";
import {
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/app/components/TurnstileField";
import { APP_BASE, LOGIN_PATH, safeAppNext } from "@/lib/app-base";
import {
  createAccountPathWithSearch,
  initialCreateAccountStep,
} from "@/lib/auth/create-account-ui";
import { googleAuthErrorMessage } from "@/lib/auth/google-ui";
import { trackMetaEvent } from "@/lib/meta-pixel";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile-shared";

function CreateAccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const oauthError = googleAuthErrorMessage(params.get("error"));

  const [step, setStep] = useState<"methods" | "email">(() =>
    initialCreateAccountStep(oauthError)
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(oauthError ?? "");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileFieldHandle>(null);

  useEffect(() => {
    const title = document.getElementById("auth-shell-title");
    title?.focus({ preventScroll: true });
  }, [step]);

  const clearErrorFromUrl = () => {
    if (!params.get("error")) return;
    router.replace(createAccountPathWithSearch(params.toString()));
  };

  const goMethods = () => {
    setError("");
    clearErrorFromUrl();
    setStep("methods");
  };

  const goEmail = () => {
    setError("");
    clearErrorFromUrl();
    setStep("email");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (!turnstileToken) {
      setError("Complete the verification check, then try again.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || undefined,
          [TURNSTILE_TOKEN_FIELD]: turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create account");
        turnstileRef.current?.reset();
        return;
      }

      trackMetaEvent(
        "CompleteRegistration",
        { status: true, content_name: "email" },
        { onceKey: "complete_registration" }
      );

      const dest = next
        ? safeAppNext(next, `${APP_BASE}/onboarding`)
        : `${APP_BASE}/onboarding`;
      router.push(dest);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <p>
      Already have an account?{" "}
      <AuthLink href={LOGIN_PATH}>Sign in</AuthLink>
    </p>
  );

  if (step === "methods") {
    return (
      <AuthShell
        align="center"
        title="Start your free trial"
        subtitle="Choose how you want to continue"
        footer={footer}
      >
        {error ? <AuthError message={error} /> : null}
        <div className="auth-method-stack">
          <GoogleAuthButton
            next={next ?? undefined}
            from="create-account"
            variant="ink"
          />
          <button
            type="button"
            className="auth-method-btn auth-method-btn--muted"
            onClick={goEmail}
          >
            <Mail size={18} strokeWidth={2} aria-hidden />
            Continue with email
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      align="center"
      title="Create account"
      subtitle="Enter your email and a password"
      footer={footer}
    >
      <form onSubmit={submit} className="auth-email-form">
        {error ? <AuthError message={error} /> : null}
        <AuthField
          id="name"
          label="Name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
          placeholder="Optional"
          required={false}
        />
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <AuthField
          id="confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <p className="text-caption mb-4 text-left">
          Use at least 8 characters with a letter and a number.
        </p>
        <TurnstileField
          ref={turnstileRef}
          action="signup"
          onToken={setTurnstileToken}
        />
        <button
          type="submit"
          disabled={loading || !turnstileToken}
          className="btn-primary mt-2 w-full disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <button
          type="button"
          className="auth-method-back"
          onClick={goMethods}
        >
          ← Other sign-up options
        </button>
      </form>
    </AuthShell>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense>
      <CreateAccountForm />
    </Suspense>
  );
}
