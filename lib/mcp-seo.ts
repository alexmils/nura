/**
 * Page-level SEO for the MCP endpoint.
 *
 * Only the public title/description/OG overrides are reachable here. Analytics
 * IDs, verification tokens and ad credentials live in the same settings object
 * and stay out of an editorial agent's hands.
 */

import { getPlatformSettings, savePlatformSettings } from "@/lib/platform-settings";
import {
  isSeoPageId,
  SEO_PAGE_IDS,
  type SeoPageId,
  type SeoPageOverride,
} from "@/lib/seo-config";
import { mergeSeoConfigPatch, validateSeoConfigPatch } from "@/lib/seo-admin-settings";
import { revalidatePublicSeo } from "@/lib/site-seo-cache";

export type SeoPagePatch = SeoPageOverride;

function requirePage(id: string): SeoPageId {
  if (!isSeoPageId(id)) {
    throw new Error(
      `Unknown page "${id}". Call list_seo_pages for the valid ids.`
    );
  }
  return id;
}

/** Every page that can carry an override, with what is set today. */
export async function listSeoPages() {
  const settings = await getPlatformSettings();
  return SEO_PAGE_IDS.map((id) => {
    const override = settings.seo.pages[id];
    return {
      id,
      title: override?.title ?? "",
      description: override?.description ?? "",
    };
  });
}

export async function getSeoPage(id: string) {
  const pageId = requirePage(id);
  const settings = await getPlatformSettings();
  return { id: pageId, ...(settings.seo.pages[pageId] ?? {}) };
}

/**
 * Merge one page's override and drop the public SEO cache so the change shows
 * without a deploy. An empty string clears a field.
 */
export async function updateSeoPage(id: string, patch: SeoPagePatch) {
  const pageId = requirePage(id);
  const errors = validateSeoConfigPatch({ pages: { [pageId]: patch } });
  if (errors.length) throw new Error(errors[0]);

  const current = await getPlatformSettings();
  const nextSeo = mergeSeoConfigPatch(current.seo, {
    pages: { [pageId]: patch },
  });
  await savePlatformSettings({ ...current, seo: nextSeo });
  revalidatePublicSeo();
  return { id: pageId, ...(nextSeo.pages[pageId] ?? {}) };
}
