"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { APP_BASE } from "@/lib/app-base";
import {
  isAccessAllowedPath,
  resolveAccessRedirect,
} from "@/lib/access-gate";

type AccessPayload = {
  needsOnboarding?: boolean;
  onboardingPending?: boolean;
  needsPayment?: boolean;
  canUseApp?: boolean;
  role?: string;
  redirectTo?: string;
};

/**
 * Client gate for ordinary users who still need onboarding or payment.
 * Fails closed on errors. Server APIs also enforce entitlements.
 */
export function AppAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAccessAllowedPath(pathname)) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const res = await fetch("/api/auth/access");
        const data = (await res.json()) as AccessPayload & { error?: string };
        if (cancelled) return;

        if (!res.ok) {
          router.replace(`${APP_BASE}/login`);
          return;
        }

        if (data.role === "platform_admin" || data.role === "support") {
          setReady(true);
          return;
        }

        // Paid or trialing but onboarding steps not done yet (e.g. paid on
        // /checkout first): same onboarding as a normal signup before the app.
        if (!data.canUseApp || data.onboardingPending) {
          const dest =
            data.redirectTo ??
            resolveAccessRedirect({
              role: data.role,
              needsOnboarding: data.needsOnboarding,
              onboardingPending: data.onboardingPending,
              needsPayment: data.needsPayment,
              canUseApp: data.canUseApp,
            });
          if (dest !== pathname) {
            router.replace(dest);
            return;
          }
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          router.replace(`${APP_BASE}/login`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready && !isAccessAllowedPath(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] text-[13px] text-[var(--text-secondary)]">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
