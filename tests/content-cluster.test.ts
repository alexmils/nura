import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLUSTER_ARTICLES,
  LEARN_READING_ORDER,
  clusterArticleFaqs,
  clusterHasBlsAcronym,
  clusterSitemapPaths,
  featuredClusterPosts,
  getClusterArticle,
  learnReadingPath,
  listClusterArticles,
  relatedClusterArticles,
} from "../lib/content-cluster.ts";
import { isFrontendPublicPath } from "../lib/public-paths.ts";

const REQUIRED_SLUGS = [
  "what-is-bilateral-stimulation",
  "emdr-vs-cbt",
  "emdr-between-sessions",
  "can-you-do-emdr-alone",
  "how-long-does-emdr-take",
  "emdr-for-anxiety",
  "emdr-for-ptsd",
] as const;

describe("content cluster", () => {
  it("ships 15–20 public articles with unique slugs", () => {
    assert.ok(CLUSTER_ARTICLES.length >= 15);
    assert.ok(CLUSTER_ARTICLES.length <= 20);
    const slugs = CLUSTER_ARTICLES.map((a) => a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const slug of REQUIRED_SLUGS) {
      assert.ok(getClusterArticle(slug), slug);
    }
  });

  it("gives every article a descriptive /emdr anchor and valid related slugs", () => {
    for (const article of CLUSTER_ARTICLES) {
      assert.match(article.emdrAnchor, /Nura|session|visual set|moving ball/i);
      assert.ok(article.emdrAnchor.length > 24, article.slug);
      for (const related of relatedClusterArticles(article)) {
        assert.ok(related.slug);
        assert.notEqual(related.slug, article.slug);
      }
      assert.equal(
        relatedClusterArticles(article).length,
        article.related.length,
        article.slug
      );
    }
  });

  it("never says BLS in user-facing cluster copy", () => {
    assert.equal(clusterHasBlsAcronym(), false);
  });

  it("exposes /blog paths as public frontend routes", () => {
    assert.equal(isFrontendPublicPath("/blog"), true);
    assert.equal(isFrontendPublicPath("/blog/what-is-emdr"), true);
    for (const { path } of clusterSitemapPaths()) {
      assert.equal(isFrontendPublicPath(path), true);
      assert.match(path, /^\/blog\/[a-z0-9-]+$/);
    }
  });

  it("spreads publication instead of one 10-day burst", () => {
    const times = CLUSTER_ARTICLES.map((article) => Date.parse(article.publishedAt)).sort(
      (a, b) => a - b
    );
    const spanDays = (times.at(-1)! - times[0]!) / 86_400_000;
    assert.ok(spanDays >= 60, `span ${spanDays}`);
    for (let i = 1; i < times.length; i++) {
      const gapDays = (times[i]! - times[i - 1]!) / 86_400_000;
      assert.ok(gapDays >= 3, `gap ${gapDays}`);
    }
    const days = new Set(times.map((t) => new Date(t).toISOString().slice(0, 10)));
    assert.equal(days.size, times.length);
  });

  it("lists newest first and features enough posts for the home grid", () => {
    const listed = listClusterArticles();
    assert.equal(listed[0]?.slug, CLUSTER_ARTICLES.at(-1)?.slug);
    const featured = featuredClusterPosts(5);
    assert.equal(featured.length, 5);
    assert.ok(featured.every((p) => p.slug && p.title && p.summary));
    assert.ok(featured.every((p) => typeof p.readMinutes === "number"));
  });

  it("exposes every slug for blog/[slug] static params (no empty hub)", () => {
    const params = listClusterArticles().map((a) => ({ slug: a.slug }));
    assert.equal(params.length, CLUSTER_ARTICLES.length);
    assert.equal(params.length, 18);
    assert.ok(params.some((p) => p.slug === "what-is-emdr"));
    assert.ok(params.some((p) => p.slug === "what-is-bilateral-stimulation"));
    assert.ok(params.some((p) => p.slug === "visual-sets-and-the-moving-ball"));
  });

  it("curates a short /learn path per topic (not the full archive)", () => {
    for (const topic of ["understand", "practice", "safety"] as const) {
      const path = learnReadingPath(topic);
      assert.equal(path.length, LEARN_READING_ORDER[topic].length);
      assert.ok(path.length >= 2 && path.length <= 4, topic);
      assert.ok(path.every((a) => a.topic === topic));
    }
    const allLearn = (
      ["understand", "practice", "safety"] as const
    ).flatMap((t) => LEARN_READING_ORDER[t]);
    assert.ok(allLearn.length < CLUSTER_ARTICLES.length);
  });

  it("builds at least two FAQ items per article for schema + on-page block", () => {
    for (const article of CLUSTER_ARTICLES) {
      const faqs = clusterArticleFaqs(article);
      assert.ok(faqs.length >= 2, article.slug);
      for (const item of faqs) {
        assert.match(item.q, /\?$/);
        assert.ok(item.a.length >= 40, `${article.slug}: ${item.q}`);
      }
    }
  });
});
