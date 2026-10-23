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
