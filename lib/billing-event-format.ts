/** Client-safe billing event labels (no server / db imports). */

export function describeInvoicePayment(input: {
  eventType: string;
  amountCents: number;
  currency: string;
  plan?: string | null;
  billingReason?: string | null;
}): string {
  const money = `${(input.amountCents / 100).toFixed(
    input.amountCents % 100 === 0 ? 0 : 2
  )} ${(input.currency || "USD").toUpperCase()}`;
  if (input.eventType === "invoice.payment_failed") {
    return `Payment failed (${money})`;
  }
  if (input.billingReason === "subscription_create") {
    return input.plan
      ? `First invoice · ${input.plan} (${money})`
      : `First invoice (${money})`;
  }
  if (input.billingReason === "subscription_cycle") {
    return input.plan
      ? `Renewal · ${input.plan} (${money})`
      : `Subscription renewal (${money})`;
  }
  return input.plan ? `Invoice · ${input.plan} (${money})` : `Invoice (${money})`;
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case "succeeded":
      return "Paid";
    case "failed":
      return "Failed";
    case "trial_started":
      return "Trial started";
    case "subscription_cancel_scheduled":
      return "Cancel scheduled";
    case "subscription_canceled":
      return "Subscription ended";
    case "checkout":
      return "Checkout";
    default:
      return status;
  }
}
