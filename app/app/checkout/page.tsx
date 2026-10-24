import { redirect } from "next/navigation";
import {
  checkoutPageHref,
  parseCheckoutPlan,
  parseCheckoutSource,
} from "@/lib/checkout-page";

/**
 * Google sign-in can only return to /app paths, so the checkout page sends
 * `next=/app/checkout?plan=...` and this hop forwards to the public /checkout.
 */
export default async function AppCheckoutRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string }>;
}) {
  const sp = await searchParams;
  redirect(
    checkoutPageHref(parseCheckoutPlan(sp.plan), parseCheckoutSource(sp.from))
  );
}
