import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import { loadBillingManageSnapshot } from "@/lib/billing-manage-server";
import {
  getStripeConfig,
  resolveBillingPlans,
} from "@/lib/stripe";

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  const loaded = await loadBillingManageSnapshot(auth.user.id);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const stripeCfg = await getStripeConfig();
  return NextResponse.json({
    ...loaded.snapshot,
    plans: resolveBillingPlans(stripeCfg),
  });
}
