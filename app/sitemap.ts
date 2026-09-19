import type { MetadataRoute } from "next";
import { listBlogCategories, listPublishedBlogPosts } from "@/lib/blog-db";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildPublicSitemap } from "@/lib/public-sitemap";
import { siteOrigin } from "@/lib/site-seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }

  const [posts, categories] = await Promise.all([
    listPublishedBlogPosts(),
    listBlogCategories(),
  ]);

  // Newest content per category, so each hub reports its own freshness.
  const newestByCategory = new Map<string, number>();
  for (const post of posts) {
    const stamp = Math.max(
      Date.parse(post.publishedAt),
      post.updatedAt ? Date.parse(post.updatedAt) : 0
    );
    for (const slug of post.categories) {
      newestByCategory.set(
        slug,
        Math.max(newestByCategory.get(slug) ?? 0, stamp)
      );
    }
  }

  return buildPublicSitemap(siteOrigin(publicUrl), {
    posts,
    categories: categories.map((category) => ({
      slug: category.slug,
      postCount: category.postCount,
      lastModified: newestByCategory.get(category.slug)
        ? new Date(newestByCategory.get(category.slug)!).toISOString()
        : undefined,
    })),
  });
}
