export type CheckoutNoticeKind = "success" | "error" | "info";

export type CheckoutNotice = {
  kind: CheckoutNoticeKind;
  message: string;
};

const FAILED_STATUSES = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "canceled",
]);

/** What to tell the person after Stripe sends them back. */
export function checkoutReturnNotice(input: {
  checkout: string | null;
  status?: string | null;
  canUseApp?: boolean;
}): CheckoutNotice | null {
  if (input.checkout === "canceled") {
    return {
      kind: "info",
      message: "Checkout canceled. You can choose a plan when you’re ready.",
    };
  }
  if (input.checkout !== "success") return null;

  const status = input.status ?? "";
  if (status === "trialing") {
    return {
      kind: "success",
      message: "Payment method saved. Your trial is ready.",
    };
  }
  if (status === "active" || input.canUseApp) {
    return {
      kind: "success",
      message: "Payment successful. Your subscription is active.",
    };
  }
  if (FAILED_STATUSES.has(status)) {
    return {
      kind: "error",
      message:
        "Payment did not go through. Try again, or update your card in Manage billing.",
    };
  }
  return {
    kind: "info",
    message: "Payment is still confirming. Wait a moment, then refresh.",
  };
}

/** Checkout never opened (API error or Stripe returned no URL). */
export function checkoutStartNotice(input: {
  ok: boolean;
  error?: string | null;
  url?: string | null;
}): CheckoutNotice | null {
  if (!input.ok) {
    return {
      kind: "error",
      message: input.error?.trim() || "Checkout unavailable.",
    };
  }
  if (!input.url) {
    return {
      kind: "error",
      message: "Checkout did not start. Try again.",
    };
  }
  return null;
}
