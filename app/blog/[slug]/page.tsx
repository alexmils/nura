import { ClusterArticleView } from "@/app/components/frontend/ClusterArticleView";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import {
  getPublishedBlogPost,
  listPublishedBlogPostsBySlugs,
} from "@/lib/blog-db";
import { BRAND_SPOKEN } from "@/lib/brand";
import { listClusterArticles } from "@/lib/content-cluster";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { dynamicOgImageUrl } from "@/lib/seo-og-image";
import {
  buildClusterArticleJsonLd,
  localeAlternates,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return listClusterArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedBlogPost(slug);
  if (!article) return { title: "Guide not found" };

  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);
  const canonical = `${origin}/blog/${article.slug}`;
  const ogImage = dynamicOgImageUrl(origin, article.title, "Blog");

  return {
    title: article.title,
    description: article.description,
    alternates: localeAlternates(canonical),
    openGraph: {
      title: `${article.title} — ${BRAND_SPOKEN}`,
      description: article.description,
      url: canonical,
      type: "article",
      locale: "en",
      publishedTime: article.publishedAt,
      modifiedTime: article.publishedAt,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} — ${BRAND_SPOKEN}`,
      description: article.description,
      images: [ogImage],
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedBlogPost(slug);
  if (!article) notFound();

  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);
  const jsonLd = buildClusterArticleJsonLd(origin, article);
  const related = await listPublishedBlogPostsBySlugs(article.related);

  return (
    <FrontendShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLd(jsonLd),
        }}
      />
      <ClusterArticleView article={article} related={related} />
    </FrontendShell>
  );
}
