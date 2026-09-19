/** ISR + on-demand revalidation for public marketing pages. */

export const SEO_CACHE_TAG = "seo";

/** Hourly ISR — copy/SEO change on edit, not per request. */
export const PUBLIC_PAGE_REVALIDATE_SECONDS = 3600;

/**
 * Public marketing routes that were `force-dynamic` (no-store HTML).
 * Keep in sync with `SITE_SEO_DEFAULTS` paths in `lib/site-seo.ts`
 * (same order — asserted by tests/public-page-cache.test.ts).
 */
import { BLOG_CATEGORIES } from "@/lib/blog-categories";

const BASE_ISR_PATHS = [
  "/",
  "/about",
  "/about/clinical-team",
  "/editorial",
  "/emdr",
  "/learn",
  "/knowledge",
  "/blog",
  "/pricing",
  "/faq",
  "/support",
  "/changelog",
  "/privacy",
  "/terms",
  "/safety",
  "/limits",
] as const;

export const PUBLIC_ISR_PATHS: readonly string[] = [
  ...BASE_ISR_PATHS,
  ...BLOG_CATEGORIES.map((category) => `/blog/category/${category.slug}`),
];

export type PublicIsrPath = string;
