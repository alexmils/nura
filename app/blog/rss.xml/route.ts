import { buildBlogRssXml } from "@/lib/blog-rss";
import { listPublishedBlogPosts } from "@/lib/blog-db";
import { PUBLIC_PAGE_REVALIDATE_SECONDS } from "@/lib/public-page-cache";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { siteOrigin } from "@/lib/site-seo";

export const revalidate = 3600;

export async function GET() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const articles = await listPublishedBlogPosts();
  const body = buildBlogRssXml(siteOrigin(publicUrl), articles);
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${PUBLIC_PAGE_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
