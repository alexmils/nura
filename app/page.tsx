import { HomeLandingV2 } from "@/app/components/frontend/HomeLandingV2";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { getLandingBlogPosts } from "@/lib/landing-blog-server";
import { buildHomeJsonLd } from "@/lib/json-ld";
import { faqPairs } from "@/lib/marketing-sections";
import { loadMarketingCopy } from "@/lib/marketing-sections-db";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("home");
}

export default async function HomePage() {
  const [blogPosts, copy] = await Promise.all([
    getLandingBlogPosts(20),
    loadMarketingCopy(),
  ]);

  return (
    <FrontendShell wide>
      <JsonLd data={buildHomeJsonLd(undefined, faqPairs(copy["home-faq"]))} />
      <HomeLandingV2 blogPosts={blogPosts} />
    </FrontendShell>
  );
}
