"use client";

import type { ReactNode } from "react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { ConversionTags } from "@/app/components/ConversionTags";
import "@/app/components/frontend/frontend-fonts.css";
import "@/app/components/frontend/frontend-buttons.css";
import "./onboarding-shell.css";

type OnboardingShellProps = {
  kicker?: string;
  title: string;
  /** Single lead paragraph. Ignored when `leadLines` is set. */
  lead?: string;
  /** Stacked lead lines (fixed line breaks, no awkward wrap). */
  leadLines?: readonly string[];
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Product setup shell for /app/onboarding — Source Sans titles (not Fraunces).
 * Auth stays on AuthShell; marketing display type stays on the public site.
 */
export function OnboardingShell({
  kicker,
  title,
  lead,
  leadLines,
  children,
  footer,
}: OnboardingShellProps) {
  return (
    <div className="frontend-home ob-shell">
      <ConversionTags />
      <div className="ob-shell-inner">
        <header className="ob-shell-header">
          <p className="ob-shell-brand">
            <BrandLockup href="/" tone="color" />
          </p>
          {kicker ? <p className="ob-kicker">{kicker}</p> : null}
          <h1 className="ob-title ui-page-title">{title}</h1>
          {leadLines?.length ? (
            <div className="ob-lead-stack">
              {leadLines.map((line) => (
                <p key={line} className="ob-lead-line ui-page-lead">
                  {line}
                </p>
              ))}
            </div>
          ) : lead ? (
            <p className="ob-lead ui-page-lead">{lead}</p>
          ) : null}
        </header>

        <div className="ob-panel">{children}</div>

        {footer ? <div className="ob-shell-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
