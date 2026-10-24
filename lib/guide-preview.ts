import { APP_BASE } from "@/lib/app-base";

/**
 * `/app?tour=frost1` opens the product guide intro as a preview: for any
 * signed-in account (platform admins included), regardless of tour, consent
 * or onboarding state, and without persisting anything.
 */
export const GUIDE_PREVIEW_PARAM = "tour";
export const GUIDE_PREVIEW_VALUE = "frost1";

export function isGuidePreviewSearch(
  search: string | URLSearchParams | null | undefined
): boolean {
  if (!search) return false;
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get(GUIDE_PREVIEW_PARAM) === GUIDE_PREVIEW_VALUE;
}

/** True only for the session home (`/app`) with the preview param. */
export function isGuidePreviewUrl(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return false;
  const q = raw.indexOf("?");
  const path = (q === -1 ? raw : raw.slice(0, q)).replace(/\/+$/, "") || "/";
  if (path !== APP_BASE) return false;
  return q !== -1 && isGuidePreviewSearch(raw.slice(q + 1).split("#")[0]);
}
