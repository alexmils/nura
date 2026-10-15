/** Labels for /app/billing summary rows. */

export function billingSummaryStatusLabel(
  status: string,
  cancelAtPeriodEnd: boolean
): string {
  if (cancelAtPeriodEnd) return "Canceling at period end";
  return status.replace(/_/g, " ");
}
