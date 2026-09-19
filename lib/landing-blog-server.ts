import { listPublishedBlogPosts } from "@/lib/blog-db";
import { clusterToLandingPost } from "@/lib/content-cluster";
import type { LandingBlogPost } from "@/lib/landing-blog";

/**
 * Featured public posts for the home blog grid. Published DB posts win;
 * the built-in corpus is the store's fallback when Postgres is unavailable.
 */
export async function getLandingBlogPosts(
  limit = 3
): Promise<LandingBlogPost[]> {
  const posts = await listPublishedBlogPosts();
  const featured = posts.filter((post) => post.featured);
  const rest = posts.filter((post) => !post.featured);
  return [...featured, ...rest].slice(0, limit).map(clusterToLandingPost);
}
