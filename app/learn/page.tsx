import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { LearnHub } from "@/app/components/frontend/LearnHub";
import { listPublishedBlogPosts } from "@/lib/blog-db";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildLearnJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  const meta = await buildCachedPageMetadata("learn");
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

export default async function LearnPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }

  const posts = await listPublishedBlogPosts();

  return (
    <FrontendShell>
      <JsonLd data={buildLearnJsonLd(siteOrigin(publicUrl), posts)} />
      <LearnHub posts={posts} />
    </FrontendShell>
  );
}
