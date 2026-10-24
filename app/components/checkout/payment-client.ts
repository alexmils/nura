"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/** Nura colours inside the payment form iframes (/checkout and /reactivate). */
export const PAYMENT_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#4a7234",
    colorText: "#2a3020",
    colorTextSecondary: "#5c6450",
    colorBackground: "#ffffff",
    colorDanger: "#b42318",
    borderRadius: "10px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    spacingUnit: "4px",
  },
};

const cache = new Map<string, Promise<Stripe | null>>();

/** One payment.js instance per publishable key. */
export function paymentClientFor(publishableKey: string): Promise<Stripe | null> {
  let p = cache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey, {
      developerTools: { assistant: { enabled: false } },
    });
    cache.set(publishableKey, p);
  }
  return p;
}
