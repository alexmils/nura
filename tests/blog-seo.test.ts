import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_SLUGS,
} from "../lib/blog-categories.ts";
import {
  articleModifiedAt,
  clusterTimeRequired,
  clusterWordCount,
  estimateClusterReadMinutes,
  listClusterArticles,
} from "../lib/content-cluster.ts";
import { PUBLIC_ISR_PATHS } from "../lib/public-page-cache.ts";
import {
  BLOG_SEO_PAGE_IDS,
  SEO_PAGE_IDS,
  blogCategoryFromSeoPageId,
  blogCategorySeoPageId,
  isSeoPageId,
} from "../lib/seo-config.ts";
import {
  buildBlogCategoryJsonLd,
  buildClusterArticleJsonLd,
} from "../lib/seo-jsonld.ts";
import { resolveSiteSeoPages, SITE_SEO_DEFAULTS } from "../lib/site-seo.ts";
import { DEFAULT_PLATFORM_SEO } from "../lib/seo-config.ts";

describe("blog SEO registry", () => {
  it("registers one Admin → SEO row per category hub", () => {
    assert.equal(BLOG_SEO_PAGE_IDS.length, BLOG_CATEGORIES.length);
    for (const slug of BLOG_CATEGORY_SLUGS) {
      const id = blogCategorySeoPageId(slug);
      assert.equal(id, `blog-${slug}`);
      assert.ok(isSeoPageId(id!));
      assert.ok(SEO_PAGE_IDS.includes(id!));
      assert.equal(blogCategoryFromSeoPageId(id!), slug);
    }
    // Unknown values round-trip to null instead of inventing a page.
    assert.equal(blogCategorySeoPageId("not-a-category"), null);
    assert.equal(blogCategoryFromSeoPageId("blog"), null);
    assert.equal(blogCategoryFromSeoPageId("pricing"), null);
  });

  it("keeps the blog index row alongside the category rows", () => {
    assert.ok(SEO_PAGE_IDS.includes("blog"));
    assert.equal(
      SEO_PAGE_IDS.filter((id) => id.startsWith("blog-")).length,
      BLOG_CATEGORIES.length
    );
  });

  it("gives every category hub its own defaults and canonical", () => {
    const pages = resolveSiteSeoPages(DEFAULT_PLATFORM_SEO, "https://nurahelp.com");
    for (const category of BLOG_CATEGORIES) {
      const id = `blog-${category.slug}`;
      const page = pages.find((p) => p.id === id);
      assert.ok(page, id);
      assert.equal(page?.path, `/blog/category/${category.slug}`);
      assert.equal(page?.title, `${category.name}: EMDR guides`);
      assert.equal(page?.description, category.description);
      assert.equal(
        page?.canonical,
        `https://nurahelp.com/blog/category/${category.slug}`
      );
      // Own share image, not the site default lockup.
      assert.match(page?.ogImageUrl || "", /^https:\/\/nurahelp\.com\/og\?/);
      assert.match(page?.ogImageUrl || "", /kicker=Blog/);
    }
  });

  it("keeps category meta descriptions unique and value-first", () => {
    const descriptions = SITE_SEO_DEFAULTS.map((p) => p.description);
    assert.equal(new Set(descriptions).size, descriptions.length);
    for (const category of BLOG_CATEGORIES) {
      assert.doesNotMatch(category.description, /not a licensed therapist/i);
      assert.doesNotMatch(category.description, /when configured/i);
      assert.doesNotMatch(category.description, /—/);
    }
  });

  it("keeps ISR paths in step with the SEO defaults", () => {
    assert.deepEqual(
      [...PUBLIC_ISR_PATHS],
      SITE_SEO_DEFAULTS.map((page) => page.path)
    );
    for (const category of BLOG_CATEGORIES) {
      assert.ok(PUBLIC_ISR_PATHS.includes(`/blog/category/${category.slug}`));
    }
  });

  it("builds category JSON-LD with the hub url and its guides", () => {
    const category = BLOG_CATEGORIES[0]!;
    const posts = listClusterArticles().filter((a) =>
      a.categories.includes(category.slug)
    );
    assert.ok(posts.length > 0, "trauma should have guides");
    const data = buildBlogCategoryJsonLd(
      "https://nurahelp.com",
      {
        slug: category.slug,
        name: category.name,
        description: category.description,
      },
      posts
    );
    const page = data["@graph"].find(
      (n) => (n as { url?: string }).url ===
        `https://nurahelp.com/blog/category/${category.slug}`
    ) as { name?: string; mainEntity?: { numberOfItems: number } };
    assert.ok(page);
    assert.match(page.name || "", new RegExp(category.name));
    assert.equal(page.mainEntity?.numberOfItems, posts.length);
  });
});

describe("blog article SEO signals", () => {
  it("counts words and derives a matching timeRequired", () => {
    const article = listClusterArticles()[0]!;
    const words = clusterWordCount(article);
    assert.ok(words > 50);
    const minutes = estimateClusterReadMinutes(article);
    assert.equal(clusterTimeRequired(article), `PT${minutes}M`);
    assert.match(clusterTimeRequired(article), /^PT\d+M$/);
  });

  it("uses the edit time for dateModified, falling back to publication", () => {
    const article = listClusterArticles()[0]!;
    assert.equal(articleModifiedAt(article), article.publishedAt);
    const edited = { publishedAt: article.publishedAt, updatedAt: "2026-10-01T00:00:00.000Z" };
    assert.equal(articleModifiedAt(edited), "2026-10-01T00:00:00.000Z");
  });

  it("emits articleSection, keywords, wordCount, and timeRequired", () => {
    const article = listClusterArticles()[0]!;
    const data = buildClusterArticleJsonLd("https://nurahelp.com", article);
    const post = data["@graph"].find(
      (n) => (n as { "@type"?: string })["@type"] === "BlogPosting"
    ) as {
      datePublished: string;
      dateModified: string;
      articleSection: string[];
      keywords: string;
      wordCount: number;
      timeRequired: string;
    };
    assert.ok(post);
    assert.equal(post.datePublished, article.publishedAt);
    assert.equal(post.dateModified, article.publishedAt);
    assert.ok(Array.isArray(post.articleSection));
    assert.ok(post.articleSection.length >= 1);
    assert.match(post.keywords, /EMDR/);
    assert.equal(post.wordCount, clusterWordCount(article));
    assert.equal(post.timeRequired, clusterTimeRequired(article));
  });

  it("reflects a newer edit time in dateModified", () => {
    const article = listClusterArticles()[0]!;
    const edited = { ...article, updatedAt: "2026-10-02T09:00:00.000Z" };
    const data = buildClusterArticleJsonLd("https://nurahelp.com", edited);
    const post = data["@graph"].find(
      (n) => (n as { "@type"?: string })["@type"] === "BlogPosting"
    ) as { dateModified: string };
    assert.equal(post.dateModified, "2026-10-02T09:00:00.000Z");
  });

  it("falls back to the topic label when a guide has no categories", () => {
    const article = listClusterArticles().find((a) => a.categories.length === 0);
    assert.ok(article, "expected a guide without clinical categories");
    const data = buildClusterArticleJsonLd("https://nurahelp.com", article!);
    const post = data["@graph"].find(
      (n) => (n as { "@type"?: string })["@type"] === "BlogPosting"
    ) as { articleSection: string[] };
    assert.ok(post.articleSection[0]!.length > 0);
  });
});
