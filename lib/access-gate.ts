import { APP_BASE, LOGIN_PATH, safeAppNext } from "@/lib/app-base";
import { isUnauthenticatedPublicPath } from "@/lib/public-paths";
import { isGuidePreviewUrl } from "@/lib/guide-preview";

/** Paths ordinary users may open before onboarding / payment is finished. */
export const ACCESS_ALLOWED_PREFIXES = [
  `${APP_BASE}/onboarding`,
  `${APP_BASE}/billing`,
  // Post-Google-sign-in hop back to the on-site checkout (/checkout).
  `${APP_BASE}/checkout`,
  `${APP_BASE}/settings`,
  `${APP_BASE}/feedback`,
  `${APP_BASE}/login`,
  `${APP_BASE}/forgot-password`,
  `${APP_BASE}/reset-password`,
  `${APP_BASE}/create-password`,
  `${APP_BASE}/create-account`,
] as const;

export function isAccessAllowedPath(pathname: string): boolean {
  return ACCESS_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Paths a signed-in user with no access (trial over, plan ended, payment
 * failed) can still reach: the /app allow-list plus anything middleware
 * treats as public, which includes /support and POST /api/auth/logout.
 */
export function isReachableWithoutAccess(pathname: string): boolean {
  return isAccessAllowedPath(pathname) || isUnauthenticatedPublicPath(pathname);
}

export type AccessRedirectInput = {
  role?: string | null;
  needsOnboarding?: boolean;
  /** Has access but has not finished the onboarding steps (see entitlements). */
  onboardingPending?: boolean;
  needsPayment?: boolean;
  canUseApp?: boolean;
  next?: string | null;
};

/** Where to send a user after login / when blocked from the main app. */
export function resolveAccessRedirect(input: AccessRedirectInput): string {
  if (input.role === "platform_admin" || input.role === "support") {
    // Staff signing in through the tour preview link land on the preview.
    if (isGuidePreviewUrl(input.next)) return input.next!.trim();
    return "/admin";
  }
  // The tour preview needs app access, not finished onboarding steps.
  if (
    input.onboardingPending &&
    !input.needsOnboarding &&
    input.canUseApp !== false &&
    isGuidePreviewUrl(input.next)
  ) {
    return input.next!.trim();
  }
  if (input.needsOnboarding || input.onboardingPending) {
    const next = input.next?.trim();
    if (
      next &&
      (next === `${APP_BASE}/onboarding` ||
        next.startsWith(`${APP_BASE}/onboarding?`) ||
        next.startsWith(`${APP_BASE}/onboarding/`))
    ) {
      return safeAppNext(next, `${APP_BASE}/onboarding`);
    }
    return `${APP_BASE}/onboarding`;
  }
  if (input.needsPayment && !input.canUseApp) {
    return `${APP_BASE}/billing`;
  }
  const dest = safeAppNext(input.next, APP_BASE);
  if (dest.startsWith(`${LOGIN_PATH}`)) return APP_BASE;
  return dest;
}
