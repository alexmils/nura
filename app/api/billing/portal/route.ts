import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { resolveStripeClient } from "@/lib/stripe";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";

export async function POST() {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const sub = await getSubscriptionByUserId(auth.user.id);
  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing customer on file" },
      { status: 400 }
    );
  }

  const resolved = await resolveStripeClient({
    livemode: sub.stripe_livemode,
    objectId: sub.stripe_customer_id,
  });
  if (!resolved) {
    return NextResponse.json(
      { error: "Billing is not available right now. Try again later." },
      { status: 503 }
    );
  }

  try {
    const baseUrl = await getPublicAppUrl();
    const portal = await resolved.stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/app/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return NextResponse.json(
      { error: "Could not open billing portal" },
      { status: 500 }
    );
  }
}
