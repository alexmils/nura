"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { BrandLockup } from "@/app/components/BrandLockup";
import { MARKETING_PRICING_CARDS } from "@/app/components/frontend/marketingPricingCards";
import type { BillingPlanId, BillingPlanMeta } from "@/lib/billing-constants";
import { billingStateCopy, type BillingState } from "@/lib/billing-access-state";
import "./billing-paywall.css";

/** Card order asked for on the paywall: Monthly / Yearly (best value) / Weekly. */
export const PAYWALL_PLAN_ORDER: BillingPlanId[] = ["monthly", "yearly", "weekly"];

type Props = {
  state: BillingState;
  plans: Record<BillingPlanId, BillingPlanMeta>;
  selected: BillingPlanId;
  onSelect: (id: BillingPlanId) => void;
  onCheckout: () => void;
  onSignOut: () => void;
  busy: boolean;
  signingOut: boolean;
  stripeConfigured: boolean;
  email: string | null;
  message?: string;
};

/**
 * Full-page paywall for users with no access. No "Back to session" (there is
 * no session to go back to); Sign out and Support are always reachable.
 */
export function BillingPaywall({
  state,
  plans,
  selected,
  onSelect,
  onCheckout,
  onSignOut,
  busy,
  signingOut,
  stripeConfigured,
  email,
  message,
}: Props) {
  const copy = billingStateCopy(state);
  const selectedPlan = plans[selected];
  const portalPrimary = state.showPortal && !state.showPlans;

  return (
    <div className="bp-shell">
      <header className="bp-topbar">
        <BrandLockup tone="color" className="bp-logo" />
        <div className="bp-account">
          {email ? (
            <span className="bp-email" title={email}>
              {email}
            </span>
          ) : null}
          <button
            type="button"
            className="bp-signout"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out\u2026" : "Sign out"}
          </button>
        </div>
      </header>

      <main className="bp-main">
        <section
          className={`bp-state bp-state--${state.kind}`}
          aria-live="polite"
        >
          <h1 className="bp-title">{copy.title}</h1>
          {copy.body ? <p className="bp-body">{copy.body}</p> : null}
        </section>

        {state.showPlans ? (
          <div
            className="bp-plans"
            role="radiogroup"
            aria-label="Choose a plan"
          >
            {PAYWALL_PLAN_ORDER.map((id) => {
              const p = plans[id];
              if (!p) return null;
              const card = MARKETING_PRICING_CARDS.find((c) => c.id === id);
              const Icon = card?.icon;
              const featured = Boolean(card?.featured ?? p.highlight);
              const badge = id === "yearly" ? "Best value" : card?.badge;
              const isSel = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  className={`bp-plan${featured ? " bp-plan--featured" : ""}${
                    isSel ? " bp-plan--selected" : ""
                  }`}
                  onClick={() => onSelect(id)}
                  disabled={busy}
                >
                  <span className="bp-plan-head">
                    {Icon ? <Icon className="bp-plan-icon" aria-hidden /> : null}
                    <span className="bp-plan-name">{card?.title ?? p.label}</span>
                    {badge ? <span className="bp-plan-badge">{badge}</span> : null}
                    <span className="bp-plan-check" aria-hidden>
                      {isSel ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                  </span>
                  <span className="bp-plan-price">
                    {p.displayPrice}
                    <span className="bp-plan-period">{p.displayPeriod}</span>
                  </span>
                  {card?.periodNote ? (
                    <span className="bp-plan-note">{card.periodNote}</span>
                  ) : null}
                  {card?.features?.length ? (
                    <ul className="bp-plan-features">
                      {card.features.slice(0, 3).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="bp-cta">
          {portalPrimary ? (
            <Link href="/app/billing/manage" className="btn-primary bp-cta-btn">
              Manage billing
            </Link>
          ) : (
            <button
              type="button"
              className="btn-primary bp-cta-btn"
              onClick={onCheckout}
              disabled={busy || !stripeConfigured || !selectedPlan}
            >
              {busy
                ? "Opening checkout\u2026"
                : `Continue with ${selectedPlan?.label ?? "plan"}`}
            </button>
          )}
          {state.showPlans && state.showPortal ? (
            <Link href="/app/billing/manage" className="bp-cta-secondary">
              Manage billing
            </Link>
          ) : null}
          {!stripeConfigured && !portalPrimary ? (
            <p className="bp-fine">Checkout is not available right now.</p>
          ) : (
            <p className="bp-fine">
              {portalPrimary
                ? "Opens secure billing management."
                : "Cancel anytime. Secure payment."}
            </p>
          )}
          {message ? (
            <p className="bp-msg" role="status">
              {message}
            </p>
          ) : null}
        </div>

        <nav className="bp-foot" aria-label="Account">
          <Link href="/support">Support</Link>
          <span aria-hidden>{"\u00b7"}</span>
          <button type="button" onClick={onSignOut} disabled={signingOut}>
            Sign out
          </button>
        </nav>
      </main>
    </div>
  );
}