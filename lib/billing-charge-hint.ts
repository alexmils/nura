/** Days-until-first-charge copy for the /app workspace header. Trial users only. */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ChargeHintInput = {
  status?: string | null;
  accessTier?: string | null;
  trialEndsAt?: string | null;
  now?: Date;
};

export type ChargeHint = {
  days: number;
  /** ISO date used for the countdown */
  at: string;
  label: string;
};

/** Whole days remaining until `iso`, floored at 0. Uses ceil so partial days still show as 1+. */
export function daysUntilIso(iso: string, now: Date = new Date()): number | null {
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

function formatChargeLabel(days: number): string {
  if (days <= 0) return "Charges today";
  if (days === 1) return "Charges in 1 day";
  return `Charges in ${days} days`;
}

/**
 * Counts down to the first charge, for trial users only. Once someone has paid,
 * the renewal date is plan detail rather than a nudge — a countdown up there
 * reads like the payment never landed. Legacy, unpaid, and undated accounts get
 * nothing either.
 */
export function resolveChargeHint(input: ChargeHintInput): ChargeHint | null {
  const now = input.now ?? new Date();
  const status = (input.status ?? "").toLowerCase();
  const tier = (input.accessTier ?? "").toLowerCase();

  if (tier === "legacy" || status === "legacy") return null;
  if (status !== "trialing" && tier !== "trialing") return null;

  const trialIso = input.trialEndsAt?.trim() || null;
  if (!trialIso) return null;

  const days = daysUntilIso(trialIso, now);
  if (days === null) return null;

  return { days, at: trialIso, label: formatChargeLabel(days) };
}
