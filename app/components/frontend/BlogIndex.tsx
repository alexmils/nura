import Image from "next/image";
import Link from "next/link";
import { categoriesWithPosts, blogCategoryName } from "@/lib/blog-categories";
import {
  CLUSTER_TOPIC_LABEL,
  estimateClusterReadMinutes,
  type ClusterArticle,
} from "@/lib/content-cluster";
import { formatBlogDate } from "@/lib/landing-blog";
import "./public-cluster.css";

export type BlogCategoryNavItem = {
  slug: string;
  name: string;
  postCount: number;
};

/** Nexsas blog pattern: fixed crop heights that stagger across 3 columns. */
const HEIGHT_CYCLE = [420, 320, 520] as const;
const COL_START = [0, 1, 2] as const;

function mediaHeight(col: number, row: number): number {
  return HEIGHT_CYCLE[(COL_START[col]! + row) % HEIGHT_CYCLE.length]!;
}

/** Round-robin into columns so the newest three sit across the top. */
function splitIntoColumns(articles: ClusterArticle[], cols: number) {
  const columns: ClusterArticle[][] = Array.from({ length: cols }, () => []);
  articles.forEach((article, i) => {
    columns[i % cols]!.push(article);
  });
  return columns;
}

/**
 * Category chips: All plus every category that has at least one guide.
 *
 * Empty categories are hidden rather than shown with a "0" badge — a chip
 * nobody can click through to is noise. `listBlogCategories()` still returns
 * them, so Admin → SEO and the blog MCP can see which themes need a post.
 */
/**
 * Category chips: All plus every category that has at least one guide.
 *
 * Empty categories are hidden rather than shown with a "0" badge — a chip
 * nobody can click through to is noise. `listBlogCategories()` still returns
 * them, so Admin → SEO and the blog MCP can see which themes need a post.
 */
export function BlogCategoryNav({
  categories,
  activeSlug,
}: {
  categories: BlogCategoryNavItem[];
  activeSlug?: string;
}) {
  const withPosts = categoriesWithPosts(categories);

  return (
    <nav className="fe-blog-cats" aria-label="Blog categories">
      <Link
        href="/blog"
        className="fe-blog-cat"
        aria-current={activeSlug ? undefined : "page"}
      >
        All
      </Link>
      {withPosts.map((category) => (
        <Link
          key={category.slug}
          href={`/blog/category/${category.slug}`}
          className="fe-blog-cat"
          aria-current={activeSlug === category.slug ? "page" : undefined}
        >
          {category.name}
          <span className="fe-blog-cat-count" aria-hidden>
            {category.postCount}
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function BlogPostMasonry({
  posts,
  emptyNote,
}: {
  posts: ClusterArticle[];
  emptyNote?: string;
}) {
  if (posts.length === 0) {
    return (
      <p className="fe-blog-empty">
        {emptyNote ?? "No guides in this category yet."}{" "}
        <Link href="/blog">Read every article</Link> in the meantime.
      </p>
    );
  }

  const columns = splitIntoColumns(posts, 3);

  return (
    <div className="fe-blog-masonry" role="list">
      {columns.map((colArticles, col) => (
        <div key={col} className="fe-blog-masonry-col" role="presentation">
          {colArticles.map((article, row) => {
            const date = formatBlogDate(article.publishedAt);
            const mins = estimateClusterReadMinutes(article);
            const height = mediaHeight(col, row);
            const tag = article.categories.length
              ? blogCategoryName(article.categories[0]!)
              : CLUSTER_TOPIC_LABEL[article.topic];
            return (
              <article
                key={article.slug}
                className="fe-blog-masonry-item"
                role="listitem"
              >
                <Link
                  href={`/blog/${article.slug}`}
                  className="fe-blog-masonry-card"
                >
                  <span className="fe-blog-masonry-media" style={{ height }}>
                    <Image
                      src={article.coverUrl}
                      alt=""
                      fill
                      sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
                      className="fe-blog-masonry-image"
                    />
                  </span>
                  <span className="fe-blog-masonry-body">
                    <span className="fe-blog-masonry-meta">
                      {date ? <span>{date}</span> : null}
                      <span>{tag}</span>
                      <span>{mins} min read</span>
                    </span>
                    <span className="fe-blog-masonry-title">
                      {article.title}
                    </span>
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function BlogIndex({
  posts,
  categories,
}: {
  posts: ClusterArticle[];
  categories: BlogCategoryNavItem[];
}) {
  return (
    <div className="fe-cluster fe-cluster--blog">
      <div className="fe-cluster-inner fe-cluster-inner--blog">
        <p className="fe-cluster-kicker">Blog</p>
        <h1 className="fe-cluster-title">EMDR articles, newest first</h1>
        <p className="fe-cluster-dek">
          Pick a theme, or read the newest guides. New here? Start on{" "}
          <Link href="/learn">Learn</Link> for curated reading paths.
        </p>

        <BlogCategoryNav categories={categories} />
        <BlogPostMasonry posts={posts} />
      </div>
    </div>
  );
}
