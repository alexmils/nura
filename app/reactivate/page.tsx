import type { Metadata } from "next";
import { BrandLockup } from "@/app/components/BrandLockup";
import {
  ReactivateOfferView,
  type ReactivateViewState,
} from "@/app/components/ReactivateOfferView";
import {
  finalizeFromSuccessRedirect,
  loadReactivation,
} from "@/lib/reactivation-stripe";
import { firstChargeDate, REACTIVATION_TRIAL_DAYS } from "@/lib/reactivation-rules";
import { isExtensionMarker } from "@/lib/reactivation-extend";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";
import { activeStripeLivemode, getStripeConfig, resolveBillingPlans } from "@/lib/stripe";
import { getSession } from "@/lib/auth/session";
import "./reactivate.css";

export const dynamic = "force-dynamic";

/**
 * The "Charge reminder" email (cron /api/cron/trial-charge-reminders) goes out
 * about two days before a live trial's first charge (isTrialReminderDue).
 */
const CHARGE_REMINDER_DAYS = 2;

export const metadata: Metadata = {
  title: "Your personal invite",
  robots: { index: false, follow: false },
};

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function ReactivatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = one(params.token);
  const status = one(params.status);
  const sessionId = one(params.session_id);

  let state: ReactivateViewState = "invalid";
  let planLabel: string | null = null;
  let priceLabel: string | null = null;
  let chargeDate: string | null = null;
  let email: string | null = null;
  let name: string | null = null;
  let expiresAt: string | null = null;
  let currentChargeDate: string | null = null;

  const plans = resolveBillingPlans(await getStripeConfig());
  const session = await getSession().catch(() => null);

  if (token && status === "success" && sessionId) {
    const done = await finalizeFromSuccessRedirect({ token, sessionId }).catch((err) => {
      console.error("[reactivate] finalize", err);
      return null;
    });
    if (done && done.ok) {
      state = "done";
      chargeDate = firstChargeDate(done.trialEnd).toISOString();
    }
  }

  if (state !== "done") {
    const view = token
      ? await loadReactivation(token).catch(() => null)
      : null;
    state = view?.state ?? "invalid";
    email = view?.email ?? null;
    name = view?.name ?? null;
    expiresAt = view?.offer?.expiresAt ?? null;
    // Redeemed just now as "next 30 days free" (still paying): no checkout.
    if (
      state === "used" &&
      status === "extended" &&
      view?.offer &&
      isExtensionMarker(view.offer.checkoutSessionId)
    ) {
      state = "extended";
    }
    if (view?.offer) {
      const meta = plans[view.offer.plan];
      planLabel = meta?.label ?? view.offer.plan;
      priceLabel = meta ? `${meta.displayPrice}${meta.displayPeriod}` : null;
      chargeDate = firstChargeDate(null).toISOString();
    }
    if (state === "extend" && view) {
      currentChargeDate = view.nextChargeAt ?? null;
      chargeDate = view.extendedChargeAt ?? chargeDate;
    }
    if (state === "extended" && view?.offer) {
      const sub = await getSubscriptionByUserId(view.offer.userId).catch(() => null);
      chargeDate = sub?.trial_ends_at ? new Date(sub.trial_ends_at).toISOString() : null;
    }
    if ((state === "valid" || state === "extend") && session && view?.offer && session.sub !== view.offer.userId) {
      state = "wrong_account";
    }
  }

  // Reminder copy only where the reminder is really sent (live trials).
  const reminderDays =
    state === "valid" && (await activeStripeLivemode().catch(() => false))
      ? CHARGE_REMINDER_DAYS
      : null;

  return (
    <div className="reactivate-page">
      <div className={`reactivate-inner${state === "valid" ? " reactivate-inner--wide" : ""}`}>
        <div className="reactivate-brand">
          <BrandLockup tone="color" />
        </div>
        <ReactivateOfferView
          token={token}
          state={state}
          canceled={status === "canceled"}
          planLabel={planLabel}
          priceLabel={priceLabel}
          chargeDate={chargeDate}
          currentChargeDate={currentChargeDate}
          email={email}
          name={name}
          expiresAt={expiresAt}
          reminderDays={reminderDays}
          trialDays={REACTIVATION_TRIAL_DAYS}
          signedIn={Boolean(session)}
        />
      </div>
    </div>
  );
}
