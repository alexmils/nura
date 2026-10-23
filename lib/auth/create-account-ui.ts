import { APP_BASE } from "@/lib/app-base";

/**
 * Create-account always opens on the method picker so Google remains
 * available after OAuth cancel/fail. Email form is user-initiated only.
 */
export function initialCreateAccountStep(
  _oauthError: string | null
): "methods" | "email" {
  return "methods";
}

/** Drop `error` from a search string; keep other params (e.g. `next`). */
export function stripAuthErrorSearch(search: string): string {
  const sp = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  sp.delete("error");
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function createAccountPathWithSearch(search: string): string {
  return `${APP_BASE}/create-account${stripAuthErrorSearch(search)}`;
}

/**
 * Marketing CTAs collect a name and email before sending people here. Those
 * values travel in sessionStorage rather than the URL, so they never land in
 * browser history, referrers, or server logs.
 */
export const SIGNUP_PREFILL_KEY = "nura:signup-prefill";

export type SignupPrefill = { name?: string; email?: string };

export function saveSignupPrefill(prefill: SignupPrefill): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SIGNUP_PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    /* Private mode or storage disabled: the form still works, just empty. */
  }
}

/** Read and remove the prefill so a later visit starts clean. */
export function takeSignupPrefill(): SignupPrefill | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(SIGNUP_PREFILL_KEY);
    window.sessionStorage.removeItem(SIGNUP_PREFILL_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SignupPrefill;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    return name || email ? { name, email } : null;
  } catch {
    return null;
  }
}
