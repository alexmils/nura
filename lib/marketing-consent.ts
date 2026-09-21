import { captureAttribution } from "@/lib/attribution";
import { isFrontendPublicPath } from "@/lib/public-paths";

export const CONSENT_STORAGE_KEY = "nura_consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "nura:open-cookie-settings";
export const CONSENT_UPDATE_EVENT = "nura_consent_update";

export type ConsentChoice = {
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export type ConsentModeState = {
  analytics_storage: "granted" | "denied";
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
};

export function normalizePathname(pathname: string): string {
  return (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
}

/**
 * Public marketing pages — never the logged-in console or admin.
 *
 * Delegates to the canonical frontend list: a locally kept copy drifted and
 * silently dropped `/pricing`, `/faq`, and `/support`, so an ad landing there
 * got no tags and no captured click.
 */
export function isMarketingPublicPath(pathname: string): boolean {
  return isFrontendPublicPath(normalizePathname(pathname));
}

/** Where GTM / Clarity / GA4 may load (marketing + conversion funnels). */
export function isGtmAllowedPath(pathname: string): boolean {
  if (isMarketingPublicPath(pathname)) return true;
  const path = normalizePathname(pathname);
  const funnels = [
    "/app/create-account",
    "/app/onboarding",
    "/app/billing",
  ] as const;
  return funnels.some((p) => path === p || path.startsWith(`${p}/`));
}

export function consentToMode(choice: ConsentChoice | null): ConsentModeState {
  const analytics = choice?.analytics === true;
  const marketing = choice?.marketing === true;
  return {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: marketing ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied",
  };
}

/** Clarity Consent API v2 keys (capital S) — see Microsoft Learn. */
export type ClarityConsentV2 = {
  ad_Storage: "granted" | "denied";
  analytics_Storage: "granted" | "denied";
};

export function consentToClarityV2(
  choice: ConsentChoice | null
): ClarityConsentV2 {
  const mode = consentToMode(choice);
  return {
    ad_Storage: mode.ad_storage,
    analytics_Storage: mode.analytics_storage,
  };
}

function parseChoice(raw: string): ConsentChoice | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentChoice>;
    if (
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }
    return {
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return parseChoice(raw);
  } catch {
    return null;
  }
}

export function writeConsent(partial: {
  analytics: boolean;
  marketing: boolean;
}): ConsentChoice {
  const previous = readConsent();
  const choice: ConsentChoice = {
    analytics: partial.analytics,
    marketing: partial.marketing,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
    } catch {
      /* private mode / quota */
    }
  }
  applyConsentToGtag(choice, { previous });
  // Mirror the decision into the attribution cookie: the Stripe webhook decides
  // which platforms to notify days later, with no browser to ask.
  captureAttribution({ analytics: choice.analytics, marketing: choice.marketing });
  return choice;
}

export function applyConsentToClarity(choice: ConsentChoice | null): void {
  if (typeof window === "undefined") return;
  if (typeof window.clarity !== "function") return;
  window.clarity("consentv2", consentToClarityV2(choice));
}

export function analyticsConsentJustGranted(
  previous: ConsentChoice | null | undefined,
  next: ConsentChoice | null
): boolean {
  return next?.analytics === true && previous?.analytics !== true;
}

/**
 * Sync Consent Mode (+ Clarity). When analytics flips from denied → granted,
 * send a page_view so GA4 Realtime counts this visit without a full reload.
 */
export function applyConsentToGtag(
  choice: ConsentChoice | null,
  opts?: { previous?: ConsentChoice | null }
): void {
  if (typeof window === "undefined") return;
  const mode = consentToMode(choice);
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- gtag.js dataLayer contract
      window.dataLayer!.push(arguments);
    };
  }
  window.gtag("consent", "update", mode);
  applyConsentToClarity(choice);

  if (analyticsConsentJustGranted(opts?.previous, choice)) {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search,
      page_title: document.title,
    });
  }

  window.dataLayer.push({
    event: CONSENT_UPDATE_EVENT,
    analytics_storage: mode.analytics_storage,
    ad_storage: mode.ad_storage,
    ad_user_data: mode.ad_user_data,
    ad_personalization: mode.ad_personalization,
  });
  window.dispatchEvent(new Event(CONSENT_UPDATE_EVENT));
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}
