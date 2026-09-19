import type { MetadataRoute } from "next";
import { changelogFileMtime } from "@/lib/changelog-public";
import {
  clusterSitemapPaths,
  latestClusterModified,
} from "@/lib/content-cluster";

/** Last real edit dates for static marketing URLs (ISO date, midnight UTC). */
const STATIC_LASTMOD: Record<string, string> = {
  "/about": "2026-09-13",
  "/editorial": "2026-09-12",
  "/emdr": "2026-09-12",
  "/knowledge": "2026-09-13",
  "/pricing": "2026-09-13",
  "/faq": "2026-09-13",
  "/support": "2026-09-13",
  "/privacy": "2026-09-12",
  "/terms": "2026-09-13",
  "/about/clinical-team": "2026-09-13",
  "/changelog": "2026-09-12",
  "/safety": "2026-09-13",
  "/limits": "2026-09-12",
};

function atUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Live blog data, when available. Falls back to the built-in guides. */
export type PublicSitemapBlogInput = {
  posts?: { slug: string; publishedAt: string }[];
  categories?: { slug: string; postCount: number }[];
};

/**
 * Public sitemap. Google uses lastmod; changefreq/priority are omitted.
 */
export function buildPublicSitemap(
  origin: string,
  blog?: PublicSitemapBlogInput
): MetadataRoute.Sitemap {
  const base = origin.replace(/\/$/, "");
  const posts = blog?.posts;
  const clusterLatest = posts?.length
    ? new Date(
        posts.reduce(
          (latest, post) =>
            Date.parse(post.publishedAt) > latest
              ? Date.parse(post.publishedAt)
              : latest,
          0
        )
      )
    : latestClusterModified();

  const staticPaths = [
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

  const pages: MetadataRoute.Sitemap = staticPaths.map((path) => {
    const lastModified =
      path === "/changelog"
        ? changelogFileMtime() ?? atUtc(STATIC_LASTMOD[path] ?? "2026-09-12")
        : path === "/" || path === "/blog" || path === "/learn"
          ? clusterLatest
          : atUtc(STATIC_LASTMOD[path] ?? "2026-09-12");
    return {
      url: path === "/" ? `${base}/` : `${base}${path}`,
      lastModified,
    };
  });

  const articles: MetadataRoute.Sitemap = posts?.length
    ? posts.map((post) => ({
        url: `${base}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
      }))
    : clusterSitemapPaths().map(({ path, lastModified }) => ({
        url: `${base}${path}`,
        lastModified,
      }));

  const categoryPages: MetadataRoute.Sitemap = (blog?.categories ?? [])
    .filter((category) => category.postCount > 0)
    .map((category) => ({
      url: `${base}/blog/category/${category.slug}`,
      lastModified: clusterLatest,
    }));

  return [...pages, ...articles, ...categoryPages];
}
