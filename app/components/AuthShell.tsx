"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { AuthVisual } from "@/app/components/auth-visual/AuthVisualVariants";
import { ConversionTags } from "@/app/components/ConversionTags";
import { stampBrowserPlace } from "@/lib/browser-place-client";
import {
  AUTH_PANEL_ID,
  authPanelTemplate,
  sectionText,
  type SectionConfig,
} from "@/lib/marketing-sections";
import { MarketingCopyProvider, useSectionConfig } from "./frontend/section-editor/MarketingCopy";
import { SectionBackdrop } from "./frontend/section-editor/EditablePart";
import {
  SectionEdit,
  SectionEditorHost,
} from "./frontend/section-editor/SectionEdit";
import "./frontend/section-editor/section-editor.css";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the right-pane ball mockup (rare). */
  hideVisual?: boolean;
  /** Center title, body, and footer (method-picker screens). */
  align?: "start" | "center";
  /** Saved background for the visual pane (`auth-login`). */
  visual?: SectionConfig;
  /** Admin-only Edit chip on the visual pane. */
  editableVisual?: boolean;
};

export function AuthShell(props: AuthShellProps) {
  const sections = useMemo(
    () => ({ "auth-login": props.visual ?? {} }),
    [props.visual]
  );
  return (
    <MarketingCopyProvider sections={sections}>
      <AuthShellInner {...props} />
    </MarketingCopyProvider>
  );
}

function AuthShellInner({
  title,
  subtitle,
  children,
  footer,
  hideVisual = false,
  align = "start",
  editableVisual = false,
}: AuthShellProps) {
  // `?auth=photo|forest` previews a preset; read after mount so every page
  // using the shell works without a Suspense boundary.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    stampBrowserPlace();
    setPreview(new URLSearchParams(window.location.search).get("auth"));
  }, []);
  const panel = useSectionConfig(AUTH_PANEL_ID);
  const template = authPanelTemplate(panel, preview);
  const card = !hideVisual && template === "photo";
  const isCenter = align === "center";
  const alignClass = isCenter ? " auth-shell-main--center" : "";
  const shellStyle = card ? cardShellStyle(panel) : undefined;

  return (
    <div
      className={`auth-shell${hideVisual ? " auth-shell--solo" : ""}${card ? " auth-shell--card" : ""}`}
      style={shellStyle}
    >
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
        <aside
          className={`auth-shell-pane auth-shell-pane--visual${editableVisual ? " fe-has-edit" : ""}`}
          data-section={editableVisual ? "auth-login" : undefined}
        >
          {editableVisual ? <SectionEdit id="auth-login" /> : null}
          <SectionBackdrop id="auth-login">
            <AuthVisual template={template} />
          </SectionBackdrop>
        </aside>
      ) : null}

      {editableVisual ? <SectionEditorHost /> : null}
    </div>
  );
}

function cardShellStyle(panel: SectionConfig): CSSProperties {
  const style: Record<string, string> = {};
  const top = sectionText(panel, "cardPageTop").trim();
  const bottom = sectionText(panel, "cardPageBottom").trim();
  const radius = Number.parseInt(sectionText(panel, "cardRadius"), 10);
  if (top) style["--auth-top"] = top;
  if (bottom) style["--auth-bottom"] = bottom;
  if (Number.isFinite(radius) && radius >= 0 && radius <= 64) style["--auth-radius"] = `${radius}px`;
  return style as CSSProperties;
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
