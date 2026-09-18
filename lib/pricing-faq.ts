import { TRIAL_DAYS } from "@/lib/billing-constants";
import { BRAND_SPOKEN } from "@/lib/brand";

export type PricingFaqItem = {
  q: string;
  a: string;
};

/** Visible `/pricing` FAQ — keep short; JSON-LD should match. */
export const PRICING_FAQ_ITEMS: readonly PricingFaqItem[] = [
  {
    q: "What's included in every plan?",
    a: "The same full app: AI agent-guided sessions, self-guided visual sets, session controls, and your history. Plans only change how often you are billed.",
  },
  {
    q: "How does the trial work?",
    a: `New accounts get a ${TRIAL_DAYS}-day trial with a limited number of AI agent-guided sessions and self-guided set time. Paid plans remove those caps.`,
  },
  {
    q: "What's the difference between weekly, monthly, and yearly?",
    a: "Same product. Weekly bills each week, monthly each month, yearly once a year at the lowest cost per month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel in the customer portal from your account. You keep access through the period you already paid for.",
  },
  {
    q: `Is ${BRAND_SPOKEN} therapy?`,
    a: `${BRAND_SPOKEN} is self-help software for practice between sessions. It is not a licensed therapist, diagnosis, or crisis care.`,
  },
  {
    q: "Do I need a credit card for the trial?",
    a: "Checkout starts your trial with a payment method on file. You can cancel before the trial ends if you do not want to continue.",
  },
];
