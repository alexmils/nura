import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BlogCategoryNav,
  BlogPostMasonry,
} from "@/app/components/frontend/BlogIndex";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import {
  BLOG_CATEGORIES,
  normalizeBlogCategorySlug,
} from "@/lib/blog-categories";
import {
  listBlogCategories,
  listPublishedBlogPosts,
  type BlogCategoryRecord,
} from "@/lib/blog-db";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { blogCategorySeoPageId } from "@/lib/seo-config";
import {
  buildBlogCategoryJsonLd,
  localeAlternates,
} from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import "./category.css";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((category) => ({ slug: category.slug }));
}

async function loadCategory(slug: string): Promise<{
  category: BlogCategoryRecord;
  posts: Awaited<ReturnType<typeof listPublishedBlogPosts>>;
  categories: BlogCategoryRecord[];
} | null> {
  // Categories are rows. A theme added through the admin UI or the MCP agent
  // gets its own page without a deploy; the built-in list is only the seed.
  const key = normalizeBlogCategorySlug(slug);
  const [categories, posts] = await Promise.all([
    listBlogCategories(),
    listPublishedBlogPosts({ category: key }),
  ]);
  const category = categories.find((c) => c.slug === key);
  if (!category) return null;
  return { category, posts, categories };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadCategory(slug);
  if (!loaded) return { title: "Category not found" };

  const { category, posts } = loaded;

  // A built-in category is registered in Admin → SEO, so the hub owns its
  // title, description, share image, and canonical. A category added at
  // runtime has no SeoPageId yet and falls back to its own name and copy.
  const seoPageId = blogCategorySeoPageId(category.slug);
  const meta = seoPageId ? await buildCachedPageMetadata(seoPageId) : null;

  return {
    ...(meta ?? {
      title: `${category.name}: EMDR guides`,
      description: category.description,
      alternates: localeAlternates(
        `${siteOrigin(undefined)}/blog/category/${category.slug}`
      ),
    }),
    // Thin until the first guide lands in this category.
    robots: posts.length ? undefined : { index: false, follow: true },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadCategory(slug);
  if (!loaded) notFound();
  const { category, posts, categories } = loaded;

  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }

  return (
    <FrontendShell>
      <JsonLd
        data={buildBlogCategoryJsonLd(
          siteOrigin(publicUrl),
          {
            slug: category.slug,
            name: category.name,
            description: category.description,
          },
          posts
        )}
      />
      <div className="fe-cluster fe-cluster--blog">
        <div className="fe-cluster-inner fe-cluster-inner--blog">
          <p className="fe-cluster-kicker">
            <Link href="/blog">Blog</Link>
          </p>
          <h1 className="fe-cluster-title">{category.name}</h1>
          <p className="fe-cluster-dek">{category.description}</p>

          <BlogCategoryNav
            categories={categories}
            activeSlug={category.slug}
          />
          <BlogPostMasonry
            posts={posts}
            emptyNote={`Nothing published in ${category.name} yet.`}
          />

          <aside className="fe-blog-cat-cta">
            <Image
              src="/marketing/landing/green-landscape.jpg"
              alt=""
              width={96}
              height={96}
              className="fe-blog-cat-cta-art"
            />
            <div>
              <p className="fe-blog-cat-cta-title">
                Bring this to a session
              </p>
              <p className="fe-blog-cat-cta-hint">
                AI agent-guided walks intake, grounding, and a set. Self-guided
                is sets you run yourself.
              </p>
            </div>
            <div className="fe-blog-cat-cta-actions">
              <Link href="/learn" className="fe-blog-cat-cta-ghost">
                Learn
              </Link>
              <Link href="/app/create-account" className="fe-blog-cat-cta-btn">
                Get started
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </FrontendShell>
  );
}
