import type { Metadata } from "next";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { CheckoutView } from "@/app/components/checkout/CheckoutView";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/users";
import { TRIAL_DAYS } from "@/lib/billing-constants";
import { getStripeConfig, isStripeConfigured, resolveBillingPlans } from "@/lib/stripe";
import { parseCheckoutPlan, parseCheckoutSource } from "@/lib/checkout-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string }>;
}) {
  const sp = await searchParams;
  const [config, configured, session] = await Promise.all([
    getStripeConfig(),
    isStripeConfigured(),
    getSession(),
  ]);
  const plans = resolveBillingPlans(config);
  const plan = parseCheckoutPlan(sp.plan, plans.yearly ? "yearly" : undefined);
  const source = parseCheckoutSource(sp.from);

  let signedIn: { email: string; name: string | null; role: string } | null = null;
  if (session) {
    const user = await getUserById(session.sub).catch(() => null);
    if (user && user.status !== "disabled") {
      signedIn = { email: user.email, name: user.name ?? null, role: user.role };
    }
  }

  return (
    <FrontendShell>
      <CheckoutView
        initialPlan={plans[plan] ? plan : "yearly"}
        plans={plans}
        source={source}
        trialDays={TRIAL_DAYS}
        stripeConfigured={configured}
        signedIn={signedIn}
      />
    </FrontendShell>
  );
}
