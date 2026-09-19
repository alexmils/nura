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
import { BLOG_CATEGORIES, blogCategoryBySlug } from "@/lib/blog-categories";
import {
  listBlogCategories,
  listPublishedBlogPosts,
  type BlogCategoryRecord,
} from "@/lib/blog-db";
import { getPublicAppUrl } from "@/lib/platform-settings";
import {
  buildBlogCategoryJsonLd,
  localeAlternates,
} from "@/lib/seo-jsonld";
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
  const def = blogCategoryBySlug(slug);
  if (!def) return null;
  const [posts, categories] = await Promise.all([
    listPublishedBlogPosts({ category: def.slug }),
    listBlogCategories(),
  ]);
  const category = categories.find((c) => c.slug === def.slug) ?? {
    slug: def.slug,
    name: def.name,
    description: def.description,
    sortOrder: def.sortOrder,
    postCount: posts.length,
  };
  return { category, posts, categories };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const def = blogCategoryBySlug(slug);
  if (!def) return { title: "Category not found" };

  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const canonical = `${siteOrigin(publicUrl)}/blog/category/${def.slug}`;
  const { posts } = (await loadCategory(def.slug)) ?? { posts: [] };

  return {
    title: `${def.name}: EMDR guides`,
    description: def.description,
    alternates: localeAlternates(canonical),
    // Thin until the first guide lands in this category.
    robots: posts.length
      ? undefined
      : { index: false, follow: true },
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
            <Link href="/app/create-account" className="fe-blog-cat-cta-btn">
              Get started
            </Link>
          </aside>
        </div>
      </div>
    </FrontendShell>
  );
}
