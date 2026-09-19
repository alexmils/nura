import { BlogIndex } from "@/app/components/frontend/BlogIndex";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { listBlogCategories, listPublishedBlogPosts } from "@/lib/blog-db";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildBlogIndexJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  const meta = await buildCachedPageMetadata("blog");
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      types: {
        "application/rss+xml": [
          { url: "/blog/rss.xml", title: "Nura EMDR guides" },
          { url: "/feed.xml", title: "Nura EMDR guides" },
        ],
      },
    },
  };
}

export default async function BlogPage() {
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

  return (
    <FrontendShell>
      <JsonLd data={buildBlogIndexJsonLd(siteOrigin(publicUrl), posts)} />
      <BlogIndex posts={posts} categories={categories} />
    </FrontendShell>
  );
}
