export type BillingManagePaymentMethod = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export type BillingManageSnapshot = {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  accessEndsAt: string | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  paymentMethod: BillingManagePaymentMethod | null;
  stripeSubscriptionId: string;
};
