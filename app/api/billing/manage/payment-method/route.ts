import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import { requireManageableSubscription } from "@/lib/billing-manage-server";
import { getPublicAppUrl } from "@/lib/platform-settings";

export async function POST() {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const ctx = await requireManageableSubscription(auth.user.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { sub, resolved } = ctx;
  if (!sub.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing customer on file" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = await getPublicAppUrl();
    const session = await resolved.stripe.checkout.sessions.create({
      mode: "setup",
      customer: sub.stripe_customer_id,
      client_reference_id: auth.user.id,
      success_url: `${baseUrl}/app/billing/manage?setup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/app/billing/manage?setup=canceled`,
      payment_method_types: ["card"],
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start card update" },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/manage/payment-method]", err);
    return NextResponse.json(
      { error: "Could not start card update" },
      { status: 500 }
    );
  }
}
