import type { BillingPlanId, BillingPlanMeta } from "@/lib/billing-constants";

/**
 * Pure helpers for the split checkout (/checkout): order summary copy, the
 * yearly upsell, the trial "$0 today, billing starts on ..." line and the live
 * password checklist. No payment-provider wording, ever.
 */

/** What every paid plan includes (left panel checklist). */
export const CHECKOUT_FEATURES = [
  "Unlimited AI agent-guided sessions",
  "Unlimited Self-guided sets",
  "Full protocol phases and check-ins",
  "Resources library access",
  "Keep your history and settings",
  "Cancel anytime from Manage billing",
];

/** One-line summary under the price. */
export const CHECKOUT_PLAN_SUMMARY: Record<BillingPlanId, string> = {
  yearly: "Lowest cost per month, billed once a year.",
  monthly: "Billed monthly. Switch or cancel anytime.",
  weekly: "Billed weekly. The smallest step to get started.",
};

/** "$14.99" -> 14.99; null when the label has no number. */
export function priceNumber(label: string | null | undefined): number | null {
  const n = Number.parseFloat(String(label ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

const PER_YEAR: Record<BillingPlanMeta["interval"], number> = { week: 52, month: 12, year: 1 };

/** Yearly cost of a plan at its display price. */
export function yearlyCost(meta: BillingPlanMeta | undefined): number | null {
  if (!meta) return null;
  const p = priceNumber(meta.displayPrice);
  return p === null ? null : p * PER_YEAR[meta.interval];
}

/**
 * Upsell chip: on Weekly/Monthly, how much Yearly saves per year; on Yearly,
 * what it works out to per month. Null when prices are unknown.
 */
export function checkoutUpsell(
  plans: Partial<Record<BillingPlanId, BillingPlanMeta>>,
  plan: BillingPlanId
): { kind: "switch"; target: "yearly"; save: string } | { kind: "value"; perMonth: string } | null {
  const yearly = plans.yearly;
  const yearlyTotal = yearlyCost(yearly);
  if (!yearly || yearlyTotal === null) return null;
  if (plan === "yearly") return { kind: "value", perMonth: formatMoney(yearlyTotal / 12) };
  const current = yearlyCost(plans[plan]);
  if (current === null || current <= yearlyTotal) return null;
  return { kind: "switch", target: "yearly", save: formatMoney(Math.floor(current - yearlyTotal)) };
}

/** Largest yearly saving across plans, for the "Save $X" badge on Yearly. */
export function yearlySavingBadge(
  plans: Partial<Record<BillingPlanId, BillingPlanMeta>>
): string | null {
  const y = yearlyCost(plans.yearly);
  const m = yearlyCost(plans.monthly);
  if (y === null || m === null || m <= y) return null;
  return `Save ${formatMoney(Math.floor(m - y))}`;
}

/** First charge after a trial; dates render the same on server and client. */
export function trialBillingStart(trialDays: number, now = new Date()): string {
  const d = new Date(now.getTime() + trialDays * 86_400_000);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Live checklist; mirrors validatePassword() in lib/auth/password.ts. */
export function passwordRules(password: string): { id: string; label: string; ok: boolean }[] {
  return [
    { id: "length", label: "At least 8 characters", ok: password.length >= 8 },
    { id: "letter", label: "Has a letter", ok: /[A-Za-z]/.test(password) },
    { id: "number", label: "Has a number", ok: /[0-9]/.test(password) },
  ];
}

export function passwordOk(password: string): boolean {
  return passwordRules(password).every((r) => r.ok);
}

/** Main button label. */
export function payButtonLabel(meta: BillingPlanMeta | undefined, trialDays: number): string {
  if (trialDays > 0) return "Start free trial";
  return meta ? `Pay ${meta.displayPrice}` : "Subscribe";
}
