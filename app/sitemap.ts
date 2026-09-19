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

  // Newest guide per category, so each hub reports its own freshness.
  const newestByCategory = new Map<string, string>();
  for (const post of posts) {
    for (const slug of post.categories) {
      const current = newestByCategory.get(slug);
      if (!current || Date.parse(post.publishedAt) > Date.parse(current)) {
        newestByCategory.set(slug, post.publishedAt);
      }
    }
  }

  return buildPublicSitemap(siteOrigin(publicUrl), {
    posts,
    categories: categories.map((category) => ({
      slug: category.slug,
      postCount: category.postCount,
      lastModified: newestByCategory.get(category.slug),
    })),
  });
}
