import type { LucideIcon } from "lucide-react";
import { Calendar, HeartHandshake, Sparkles } from "lucide-react";
import type { BillingPlanId } from "@/lib/billing-constants";

/** Shared marketing plan cards — home `#prices` and `/pricing`. */
export type MarketingPricingCard = {
  id: BillingPlanId;
  icon: LucideIcon;
  title: string;
  badge?: string;
  featured?: boolean;
  details: string;
  periodNote?: string;
  features: string[];
};

export const MARKETING_PRICING_CARDS: MarketingPricingCard[] = [
  {
    id: "weekly",
    icon: Calendar,
    title: "Weekly",
    details:
      "Flexible billing if you want to stay light — same full app, billed each week.",
    features: [
      "Unlimited AI agent-guided sessions",
      "Full Self-guided sessions (sets you run yourself)",
      "No ads on paid plans",
      "Cancel anytime in the portal",
      "Same session workspace as other plans",
    ],
  },
  {
    id: "yearly",
    icon: HeartHandshake,
    title: "Yearly",
    badge: "Best value",
    featured: true,
    details:
      "One calm price for a full year — the lowest cost per month if Nura is part of your routine.",
    periodNote: "≈ $8.25 / month",
    features: [
      "Everything in Monthly",
      "Lowest cost per month",
      "Pay once, fewer interruptions",
      "Customer portal for billing",
      "Keep your history and settings",
    ],
  },
  {
    id: "monthly",
    icon: Sparkles,
    title: "Monthly",
    badge: "Most popular",
    details:
      "The everyday plan for practice between sessions — billed monthly, cancel anytime.",
    features: [
      "Unlimited AI agent-guided + Self-guided sessions",
      "Full protocol phases & check-ins",
      "Resources library access",
      "Customer portal for billing",
      "Upgrade or switch plans later",
    ],
  },
];
