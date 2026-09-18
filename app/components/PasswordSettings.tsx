"use client";

import { useState } from "react";
import { useToast } from "@/app/components/Toast";
import { notifyUserUpdated } from "@/app/components/useCurrentUser";

type Props = {
  hasPassword: boolean;
  onSaved?: () => void | Promise<void>;
};

export function PasswordSettings({ hasPassword, onSaved }: Props) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const submit = async () => {
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not update password");
      }

      resetForm();
      const done = hasPassword
        ? "Password changed"
        : "Password set. You can sign in with your email now.";
      setMessage(done);
      toast(done);
      notifyUserUpdated();
      await onSaved?.();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not update password";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-group mt-5">
      <div className="settings-row">
        <p className="settings-body-text">
          {hasPassword ? "Password" : "Add a password"}
        </p>
        <p className="settings-help mt-1.5">
          {hasPassword
            ? "Change the password you use to sign in with your email."
            : "You signed in with Google. Add a password to sign in with your email too. Same account and same sessions either way."}
        </p>
      </div>

      {hasPassword && (
        <label className="settings-row block">
          <span className="settings-label mb-2">Current password</span>
          <input
            className="field w-full"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={busy}
          />
        </label>
      )}

      <label className="settings-row block">
        <span className="settings-label mb-2">New password</span>
        <input
          className="field w-full"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
        />
        <p className="settings-help mt-1.5">
          At least 8 characters, with a letter and a number.
        </p>
      </label>

      <label className="settings-row block">
        <span className="settings-label mb-2">Confirm new password</span>
        <input
          className="field w-full"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={busy}
        />
      </label>

      {error && (
        <p className="settings-row settings-body-text text-[var(--destructive)]">
          {error}
        </p>
      )}
      {message && (
        <p className="settings-row settings-body-text text-[#248a3d]">
          {message}
        </p>
      )}

      <div className="settings-row">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          disabled={busy || newPassword.length === 0}
          onClick={() => void submit()}
        >
          {busy
            ? "Saving…"
            : hasPassword
              ? "Change password"
              : "Set password"}
        </button>
      </div>
    </div>
  );
}
