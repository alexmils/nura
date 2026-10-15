import { BILLING_PLANS, type BillingPlanId } from "@/lib/billing-constants";
import type { SubscriptionCancelReasonId } from "@/lib/subscription-cancel-reasons";

export const RETENTION_DISCOUNT_PERCENT = 50;
export const RETENTION_ELIGIBLE_PLAN: BillingPlanId = "monthly";
export const RETENTION_TRIGGER_REASON: SubscriptionCancelReasonId =
  "too_expensive";

export type RetentionAction = "offered" | "accepted" | "declined";

export type RetentionOfferStats = {
  offered: number;
  accepted: number;
  declined: number;
  acceptanceRate: number | null;
};

export function formatRetentionActionLabel(action: RetentionAction): string {
  switch (action) {
    case "offered":
      return "Saw 50% offer";
    case "accepted":
      return "Accepted 50% and stayed";
    case "declined":
      return "Declined offer, canceled";
    default:
      return action;
  }
}

export function retentionReasonsEligible(
  reasonIds: SubscriptionCancelReasonId[]
): boolean {
  return reasonIds.includes(RETENTION_TRIGGER_REASON);
}

export function halfDisplayPrice(displayPrice: string): string {
  const match = displayPrice.match(/(\d+(?:\.\d+)?)/);
  if (!match) return `${RETENTION_DISCOUNT_PERCENT}% off`;
  const half = parseFloat(match[1]) / 2;
  const formatted =
    half % 1 === 0 ? String(half) : half.toFixed(2).replace(/0$/, "");
  if (displayPrice.trim().startsWith("$")) return `$${formatted}`;
  return formatted;
}

export function retentionOfferCopy(displayPrice: string): {
  headline: string;
  lead: string;
  priceLine: string;
} {
  const half = halfDisplayPrice(displayPrice);
  const full = displayPrice.trim();
  return {
    headline: "Stay for half price",
    lead: "Monthly plan only. One month at 50% off, then your usual rate.",
    priceLine: `${half} next month (usually ${full})`,
  };
}

export function defaultMonthlyDisplayPrice(): string {
  return BILLING_PLANS.monthly.displayPrice;
}
