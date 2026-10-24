import { isBillingPlanId, type BillingPlanId } from "@/lib/billing-constants";

/**
 * On-site checkout (/checkout). Every Subscribe button lands here instead of
 * the account screen or Stripe's hosted page; the page signs people in or up
 * inline, then mounts Stripe Checkout Elements for the same subscription
 * Checkout Session the hosted flow uses.
 */
export const CHECKOUT_PAGE_PATH = "/checkout";

/**
 * Stripe API version for `ui_mode: "elements"` sessions. Must match the
 * Stripe.js major in package.json (@stripe/stripe-js 10 = Endive). The rest of
 * the app stays pinned to the version in lib/stripe.ts.
 */
export const CHECKOUT_ELEMENTS_API_VERSION = "2026-09-30.endive";

export type CheckoutSource = "pricing" | "onboarding" | "billing" | "upgrade";

const SOURCES = new Set<CheckoutSource>([
  "pricing",
  "onboarding",
  "billing",
  "upgrade",
]);

export function parseCheckoutPlan(
  value: string | null | undefined,
  fallback: BillingPlanId = "yearly"
): BillingPlanId {
  return isBillingPlanId(value) ? value : fallback;
}

export function parseCheckoutSource(
  value: string | null | undefined
): CheckoutSource {
  return value && SOURCES.has(value as CheckoutSource)
    ? (value as CheckoutSource)
    : "pricing";
}

/** Link for a Subscribe button. */
export function checkoutPageHref(
  plan: BillingPlanId,
  source?: CheckoutSource
): string {
  const params = new URLSearchParams({ plan });
  if (source && source !== "pricing") params.set("from", source);
  return `${CHECKOUT_PAGE_PATH}?${params.toString()}`;
}

/** Where Stripe sends the member back (`{CHECKOUT_SESSION_ID}` is filled in by Stripe). */
export function checkoutReturnPath(
  to: "onboarding" | "billing",
  outcome: "success" | "canceled"
): string {
  const base = to === "onboarding" ? "/app/onboarding" : "/app/billing";
  return outcome === "success"
    ? `${base}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    : `${base}?checkout=canceled`;
}

/** "Back" link on the checkout page. */
export function checkoutBackHref(source: CheckoutSource, signedIn: boolean): string {
  if (source === "onboarding") return "/app/onboarding";
  if (source === "billing" || source === "upgrade") {
    return signedIn ? "/app/billing" : "/pricing";
  }
  return "/pricing";
}

/** Session-start conflicts (HTTP 409) send the member to Manage billing. */
export function checkoutConflictRedirect(code: unknown): string | null {
  return code === "already_subscribed" || code === "use_portal"
    ? "/app/billing/manage"
    : null;
}
