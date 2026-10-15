"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { AuthSessionMockup } from "@/app/components/AuthSessionMockup";
import { ConversionTags } from "@/app/components/ConversionTags";
import { stampBrowserPlace } from "@/lib/browser-place-client";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the right-pane ball mockup (rare). */
  hideVisual?: boolean;
  /** Center title, body, and footer (method-picker screens). */
  align?: "start" | "center";
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  hideVisual = false,
  align = "start",
}: AuthShellProps) {
  useEffect(() => {
    stampBrowserPlace();
  }, []);
  const isCenter = align === "center";
  const alignClass = isCenter ? " auth-shell-main--center" : "";

  return (
    <div className={`auth-shell${hideVisual ? " auth-shell--solo" : ""}`}>
      <ConversionTags />
      <div className="auth-shell-pane auth-shell-pane--form">
        {!isCenter ? (
          <header className="auth-shell-chrome">
            <div className="auth-shell-brand">
              <BrandLockup href="/" tone="color" />
            </div>
          </header>
        ) : null}

        <div className={`auth-shell-main${alignClass}`}>
          <div className="auth-shell-body">
            {isCenter ? (
              <div className="auth-shell-brand auth-shell-brand--stack">
                <BrandLockup href="/" tone="color" />
              </div>
            ) : null}
            <div className="auth-shell-intro">
              <h1
                id="auth-shell-title"
                className="auth-shell-title ui-page-title"
                tabIndex={-1}
              >
                {title}
              </h1>
              {subtitle ? (
                <p className="auth-shell-subtitle ui-page-lead">{subtitle}</p>
              ) : null}
            </div>

            <div className="auth-shell-card">{children}</div>

            {footer ? (
              <div className="auth-shell-footer">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>

      {!hideVisual ? (
        <aside className="auth-shell-pane auth-shell-pane--visual">
          <AuthSessionMockup />
        </aside>
      ) : null}
    </div>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
};

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && visible ? "text" : type;

  return (
    <div className="mb-4 text-left">
      <label htmlFor={id} className="text-footnote mb-1.5 block font-medium">
        {label}
      </label>
      <div className={isPassword ? "auth-field-password" : undefined}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          className={`field${isPassword ? " auth-field-password-input" : ""}`}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-field-eye"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? (
              <EyeOff size={18} strokeWidth={2} aria-hidden />
            ) : (
              <Eye size={18} strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      className="mb-4 rounded-[var(--radius-control)] bg-[rgba(255,59,48,0.1)] px-3 py-2 text-left text-footnote text-[var(--destructive)]"
      role="alert"
    >
      {message}
    </p>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <p
      className="mb-4 rounded-[var(--radius-control)] bg-[rgba(52,199,89,0.12)] px-3 py-2 text-left text-footnote text-[#248a3d]"
      role="status"
    >
      {message}
    </p>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="auth-link">
      {children}
    </Link>
  );
}
