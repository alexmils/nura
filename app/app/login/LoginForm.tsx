"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
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
import { APP_BASE, appPath } from "@/lib/app-base";
import { resolveAccessRedirect } from "@/lib/access-gate";
import { googleAuthErrorMessage } from "@/lib/auth/google-ui";
import type { SectionConfig } from "@/lib/marketing-sections";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile-shared";

function redirectAfterLogin(
  next: string,
  role?: string,
  entitlement?: {
    needsOnboarding?: boolean;
    onboardingPending?: boolean;
    needsPayment?: boolean;
    canUseApp?: boolean;
  }
): string {
  return resolveAccessRedirect({
    role,
    needsOnboarding: entitlement?.needsOnboarding,
    onboardingPending: entitlement?.onboardingPending,
    needsPayment: entitlement?.needsPayment,
    canUseApp: entitlement?.canUseApp,
    next,
  });
}

export function LoginForm({
  adminGate,
  visual,
  editableVisual = false,
}: {
  adminGate?: string;
  /** Saved background for the right pane (`auth-login`). */
  visual?: SectionConfig;
  /** Admin-only Edit chip on the visual pane. */
  editableVisual?: boolean;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? APP_BASE;
  const oauthError = googleAuthErrorMessage(params.get("error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(oauthError ?? "");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileFieldHandle>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!turnstileToken) {
      setError("Complete the verification check, then try again.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(adminGate ? { gate: adminGate } : {}),
          [TURNSTILE_TOKEN_FIELD]: turnstileToken,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        turnstileRef.current?.reset();
        return;
      }

      router.push(
        redirectAfterLogin(next, data.user?.role, data.entitlement)
      );
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const signInWithPasskey = async () => {
    setError("");
    setPasskeyLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          ...(adminGate ? { gate: adminGate } : {}),
        }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) {
        setError(optData.error ?? "Could not start passkey login");
        return;
      }

      const assertion = await startAuthentication({
        optionsJSON: optData.options,
      });

      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: assertion,
          ...(adminGate ? { gate: adminGate } : {}),
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error ?? "Passkey sign-in failed");
        return;
      }

      router.push(
        redirectAfterLogin(next, verifyData.user?.role, verifyData.entitlement)
      );
      router.refresh();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError") {
        setError("Passkey sign-in was cancelled");
      } else {
        setError(
          err instanceof Error ? err.message : "Passkey sign-in failed"
        );
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const busy = loading || passkeyLoading;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where you left your last session."
      visual={visual}
      editableVisual={editableVisual}
      footer={
        adminGate ? (
          <p>
            Forgot your password?{" "}
            <AuthLink href={appPath("/forgot-password")}>Reset it</AuthLink>
          </p>
        ) : (
          <p>
            Forgot your password?{" "}
            <AuthLink href={appPath("/forgot-password")}>Reset it</AuthLink>
            <br />
            <span className="mt-2 inline-block">
              No account?{" "}
              <AuthLink href={appPath("/create-account")}>Create one</AuthLink>
            </span>
          </p>
        )
      }
    >
      <form onSubmit={submit}>
        {error && <AuthError message={error} />}
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username webauthn"
          placeholder="you@example.com"
          required={false}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <TurnstileField
          ref={turnstileRef}
          action="login"
          onToken={setTurnstileToken}
        />
        <button
          type="submit"
          disabled={busy || !turnstileToken}
          className="btn-primary mt-2 w-full disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="auth-alt-methods">
        <div className="auth-alt-methods-divider flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--separator-opaque)]" />
          <span className="text-caption">or</span>
          <div className="h-px flex-1 bg-[var(--separator-opaque)]" />
        </div>

        <GoogleAuthButton
          next={next}
          from="login"
          gate={adminGate}
          disabled={busy}
        />

        <button
          type="button"
          disabled={busy}
          onClick={() => void signInWithPasskey()}
          className="btn-secondary auth-alt-methods-passkey w-full disabled:opacity-60"
        >
          {passkeyLoading ? "Waiting for passkey…" : "Sign in with passkey"}
        </button>
        <p className="auth-passkey-hint text-caption">
          Use Face ID, Touch ID, Windows Hello, or a security key.
        </p>
      </div>
    </AuthShell>
  );
}
