"use client";

import Link from "next/link";
import { appPath } from "@/lib/app-base";
import { resolveChargeHint } from "@/lib/billing-charge-hint";
import { useApp } from "./AppProvider";

/** Subtle top-right header text: days until the trial's first charge. */
export function BillingChargeHint() {
  const { entitlement } = useApp();
  const hint = resolveChargeHint({
    status: entitlement?.status,
    accessTier: entitlement?.accessTier,
    trialEndsAt: entitlement?.trialEndsAt,
  });

  if (!hint) return null;

  return (
    <Link
      href={appPath("/billing")}
      className="billing-charge-hint"
      title="View billing — trial ends soon"
    >
      {hint.label}
    </Link>
  );
}
