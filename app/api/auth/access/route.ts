import { NextResponse } from "next/server";
import { requireAuth, isAuthContext } from "@/lib/api-auth";
import {
  getEntitlementForUser,
  publicEntitlement,
} from "@/lib/entitlements";
import { ensureUserAccessStub } from "@/lib/user-access";
import { resolveAccessRedirect } from "@/lib/access-gate";
import { markPostTrialAppUse } from "@/lib/email/post-trial-app-use";
import { isWithinPostTrialAnchorWindow } from "@/lib/email/post-trial-checkin-policy";

/** Lightweight access check for middleware + client gates (DB-backed). */
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthContext(auth)) return auth;

  if (auth.user.role === "user") {
    await ensureUserAccessStub(auth.user.id);
  }

  const entitlement = await getEntitlementForUser({
    userId: auth.user.id,
    role: auth.user.role,
    onboardingCompletedAt: auth.user.onboardingCompletedAt,
  });

  // This gate is the first thing an app page hits, so it is also the earliest
  // honest signal that someone is using the app after their trial. The write
  // is a no-op after the first call, and must never block access on failure.
  if (
    entitlement.canUseApp &&
    entitlement.trialEndsAt &&
    isWithinPostTrialAnchorWindow(new Date(entitlement.trialEndsAt))
  ) {
    await markPostTrialAppUse(auth.user.id).catch((err) => {
      console.error("[access] could not record post-trial app use", err);
    });
  }

  const redirectTo = resolveAccessRedirect({
    role: auth.user.role,
    needsOnboarding: entitlement.needsOnboarding,
    needsPayment: entitlement.needsPayment,
    canUseApp: entitlement.canUseApp,
  });

  return NextResponse.json({
    role: auth.user.role,
    ...publicEntitlement(entitlement),
    redirectTo,
  });
}
