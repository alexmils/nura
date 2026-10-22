import { APP_BASE, LOGIN_PATH, safeAppNext } from "@/lib/app-base";

/** Paths ordinary users may open before onboarding / payment is finished. */
export const ACCESS_ALLOWED_PREFIXES = [
  `${APP_BASE}/onboarding`,
  `${APP_BASE}/billing`,
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

export type AccessRedirectInput = {
  role?: string | null;
  needsOnboarding?: boolean;
  needsPayment?: boolean;
  canUseApp?: boolean;
  next?: string | null;
};

/** Where to send a user after login / when blocked from the main app. */
export function resolveAccessRedirect(input: AccessRedirectInput): string {
  if (input.role === "platform_admin" || input.role === "support") {
    return "/admin";
  }
  if (input.needsOnboarding) {
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
