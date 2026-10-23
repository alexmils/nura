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
import { getStripeConfig, resolveBillingPlans } from "@/lib/stripe";
import { getSession } from "@/lib/auth/session";
import "./reactivate.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "30 days of Nura, on us | Nura",
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
    if (view?.offer) {
      const meta = plans[view.offer.plan];
      planLabel = meta?.label ?? view.offer.plan;
      priceLabel = meta ? `${meta.displayPrice}${meta.displayPeriod}` : null;
      chargeDate = firstChargeDate(null).toISOString();
    }
    if (state === "valid" && session && view?.offer && session.sub !== view.offer.userId) {
      state = "wrong_account";
    }
  }

  return (
    <div className="reactivate-page">
      <div className="reactivate-inner">
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
          email={email}
          trialDays={REACTIVATION_TRIAL_DAYS}
          signedIn={Boolean(session)}
        />
      </div>
    </div>
  );
}
