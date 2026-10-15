/** User-facing copy for on-site manage billing (cancel / win-back). */

export function manageBillingFarewellCopy(accessEndsLabel: string) {
  return {
    headline: "We're sorry to see you go",
    lead: `You still have full access until ${accessEndsLabel}. Your sessions and progress stay in your account.`,
    invite:
      "If you change your mind, tap Keep subscription. Renewal turns back on with no new checkout.",
  };
}

export function manageBillingCancelScheduledToast(accessEndsLabel: string): string {
  return `We heard you. Access stays on until ${accessEndsLabel}. You can turn renewal back on anytime below.`;
}

export function manageBillingResumeToast(): string {
  return "Welcome back. Your plan will renew as usual.";
}
