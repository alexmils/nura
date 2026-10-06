import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldNoindexPath } from "../lib/crawl-headers.ts";
import { listClusterArticles } from "../lib/content-cluster.ts";
import { buildPublicSitemap } from "../lib/public-sitemap.ts";
import { ROBOTS_DISALLOW, buildRobotsTxt } from "../lib/robots-txt.ts";
import {
  localeAlternates,
  SITE_CONTENT_LANGUAGE,
} from "../lib/seo-jsonld.ts";
import {
  metadataFromResolved,
  resolveSiteSeoPages,
} from "../lib/site-seo.ts";
import { DEFAULT_PLATFORM_SEO } from "../lib/seo-config.ts";

describe("console crawl leak", () => {
  it("noindexes /app/resources (signed-in library, not the public hub)", () => {
    assert.equal(shouldNoindexPath("/app/resources"), true);
    assert.equal(shouldNoindexPath("/app"), true);
    assert.equal(shouldNoindexPath("/admin"), true);
    assert.equal(shouldNoindexPath("/learn"), false);
    assert.equal(shouldNoindexPath("/blog"), false);
    assert.equal(shouldNoindexPath("/editorial"), false);
    assert.equal(shouldNoindexPath("/health"), true);
    assert.equal(shouldNoindexPath("/dev/ground-mock"), true);
    assert.equal(shouldNoindexPath("/"), false);
  });

  it("robots Disallow: /app is a prefix — /app/resources is not crawlable", () => {
    assert.ok(ROBOTS_DISALLOW.includes("/app"));
    const body = buildRobotsTxt("https://nurahelp.com");
    assert.match(body, /^Disallow: \/app$/m);
    assert.doesNotMatch(body, /Allow: \/app/);
  });
});

describe("public sitemap", () => {
  const entries = buildPublicSitemap("https://nurahelp.com");

  it("sets lastModified and omits changefreq/priority", () => {
    assert.ok(entries.length >= 8 + listClusterArticles().length);
    for (const entry of entries) {
      assert.ok(entry.lastModified, entry.url);
      assert.equal("changeFrequency" in entry, false, entry.url);
      assert.equal("priority" in entry, false, entry.url);
    }
  });

  it("includes editorial and cluster slugs", () => {
    const urls = new Set(entries.map((e) => e.url));
    assert.ok(urls.has("https://nurahelp.com/editorial"));
    assert.ok(urls.has("https://nurahelp.com/learn"));
    assert.ok(urls.has("https://nurahelp.com/knowledge"));
    assert.ok(urls.has("https://nurahelp.com/pricing"));
    assert.ok(urls.has("https://nurahelp.com/faq"));
    assert.ok(urls.has("https://nurahelp.com/support"));
    assert.ok(urls.has("https://nurahelp.com/blog"));
    assert.ok(urls.has("https://nurahelp.com/changelog"));
    assert.ok(urls.has("https://nurahelp.com/blog/what-is-emdr"));
  });
});

describe("hreflang", () => {
  it("localeAlternates pins en and x-default to the same canonical", () => {
    const alt = localeAlternates("https://nurahelp.com/about");
    assert.equal(alt.canonical, "https://nurahelp.com/about");
    assert.equal(alt.languages["x-default"], "https://nurahelp.com/about");
    assert.equal(alt.languages[SITE_CONTENT_LANGUAGE], "https://nurahelp.com/about");
  });

  it("metadataFromResolved uses locale alternates", () => {
    const pages = resolveSiteSeoPages(
      DEFAULT_PLATFORM_SEO,
      "https://nurahelp.com"
    );
    const meta = metadataFromResolved("editorial", pages, DEFAULT_PLATFORM_SEO);
    assert.equal(meta.alternates?.canonical, "https://nurahelp.com/editorial");
    assert.equal(
      meta.alternates?.languages?.["x-default"],
      "https://nurahelp.com/editorial"
    );
    assert.equal(
      meta.alternates?.languages?.en,
      "https://nurahelp.com/editorial"
    );
  });

  it("does not use home metadata when a page id is missing from a stale cache", () => {
    const stale = resolveSiteSeoPages(
      DEFAULT_PLATFORM_SEO,
      "https://nurahelp.com"
    ).filter((p) => p.id !== "editorial");
    const meta = metadataFromResolved("editorial", stale, DEFAULT_PLATFORM_SEO);
    assert.equal(meta.alternates?.canonical, "https://nurahelp.com/editorial");
  });
});
