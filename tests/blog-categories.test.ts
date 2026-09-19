import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_SLUGS,
  blogCategoryBySlug,
  blogCategoryName,
  normalizeBlogCategorySlug,
  sanitizeBlogCategorySlugs,
} from "../lib/blog-categories.ts";
import {
  CLUSTER_ARTICLES,
  clusterArticlesByCategory,
} from "../lib/content-cluster.ts";

const EXPECTED = [
  "trauma",
  "ptsd",
  "anxiety",
  "panic",
  "grief",
  "phobias",
  "childhood-memories",
  "self-worth",
] as const;

describe("blog categories", () => {
  it("ships the eight clinical themes with unique slugs", () => {
    assert.deepEqual([...BLOG_CATEGORY_SLUGS], [...EXPECTED]);
    assert.equal(BLOG_CATEGORIES.length, 8);
    const names = BLOG_CATEGORIES.map((c) => c.name);
    assert.deepEqual(names, [
      "Trauma",
      "PTSD",
      "Anxiety",
      "Panic",
      "Grief",
      "Phobias",
      "Childhood memories",
      "Self-worth",
    ]);
    for (const category of BLOG_CATEGORIES) {
      assert.ok(category.description.length > 20, category.slug);
      assert.ok(!category.description.includes("—"), category.slug);
    }
  });

  it("normalizes and resolves slugs", () => {
    assert.equal(normalizeBlogCategorySlug("Childhood Memories"), "childhood-memories");
    assert.equal(blogCategoryName("self-worth"), "Self-worth");
    assert.equal(blogCategoryBySlug("nope"), null);
    assert.equal(blogCategoryBySlug("PTSD")?.name, "PTSD");
  });

  it("sanitizes unknown slugs and keeps canonical order", () => {
    assert.deepEqual(
      sanitizeBlogCategorySlugs(["anxiety", "not-a-category", "trauma", "anxiety"]),
      ["trauma", "anxiety"]
    );
    assert.deepEqual(sanitizeBlogCategorySlugs("trauma"), []);
    assert.deepEqual(sanitizeBlogCategorySlugs([1, null, "panic"]), ["panic"]);
  });

  it("only assigns known categories to built-in guides", () => {
    for (const article of CLUSTER_ARTICLES) {
      for (const slug of article.categories) {
        assert.ok(
          BLOG_CATEGORY_SLUGS.includes(slug),
          `${article.slug}: ${slug}`
        );
      }
    }
    assert.ok(clusterArticlesByCategory("anxiety").some((a) => a.slug === "emdr-for-anxiety"));
    assert.ok(clusterArticlesByCategory("ptsd").some((a) => a.slug === "emdr-for-ptsd"));
    // Categories people have not written for yet are simply empty.
    assert.deepEqual(clusterArticlesByCategory("grief"), []);
    // Every built-in article is still reachable from the index.
    assert.ok(CLUSTER_ARTICLES.length >= 15);
  });
});
