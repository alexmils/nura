import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_SPOKEN } from "../lib/brand.ts";
import { CLINICAL_AUTHORITIES } from "../lib/clinical-authorities.ts";
import {
  CLUSTER_TOPICS,
  clusterArticlesByTopic,
  listClusterArticles,
} from "../lib/content-cluster.ts";
import { hasClinicalAdvisorConfigured } from "../lib/legal-entity.ts";
import { buildHomeJsonLd, serializeJsonLd } from "../lib/json-ld.ts";
import { LANDING_FAQ_ITEMS } from "../lib/landing-faq.ts";
import {
  BLOG_INDEX_JSON_LD,
  CLINICAL_REVIEW_JSON_LD,
  LEARN_JSON_LD,
  buildBlogIndexJsonLd,
  buildClinicalReviewJsonLd,
  buildClusterArticleJsonLd,
  buildEmdrJsonLd,
  buildLearnJsonLd,
  buildPricingJsonLd,
  reviewablePageJsonLd,
} from "../lib/seo-jsonld.ts";
import {
  RETIRED_SEO_DESCRIPTIONS,
  resolveSiteSeoPages,
} from "../lib/site-seo.ts";
import { DEFAULT_PLATFORM_SEO } from "../lib/seo-config.ts";

describe("homepage JSON-LD", () => {
  it("emits Organization, WebSite, SoftwareApplication, and FAQPage", () => {
    const data = buildHomeJsonLd("https://nurahelp.com");
    const types = data["@graph"].map((node) => node["@type"]);
    assert.deepEqual(types, [
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
    ]);
    assert.equal(data["@graph"][0]?.name, BRAND_SPOKEN);
    assert.equal(data["@graph"][0]?.legalName, "Receptly LLC");
    assert.deepEqual(data["@graph"][0]?.sameAs, [
      "https://www.instagram.com/nurahelpco/",
      "https://www.facebook.com/profile.php?id=61594147808052",
    ]);
    const app = data["@graph"].find(
      (node) => node["@type"] === "SoftwareApplication"
    );
    assert.equal(app?.operatingSystem, "Web");
    assert.equal(app?.name, BRAND_SPOKEN);
    const offers = app?.offers as {
      priceCurrency?: string;
      url?: string;
    };
    assert.equal(offers?.priceCurrency, "USD");
    assert.equal(offers?.url, "https://nurahelp.com/pricing");
  });

  it("mirrors the visible FAQ strings", () => {
    const data = buildHomeJsonLd("https://nurahelp.com");
    const faq = data["@graph"].find((node) => node["@type"] === "FAQPage");
    const entities = faq?.mainEntity as {
      name: string;
      acceptedAnswer: { text: string };
    }[];
    assert.equal(entities.length, LANDING_FAQ_ITEMS.length);
    for (const [i, item] of LANDING_FAQ_ITEMS.entries()) {
      assert.equal(entities[i]?.name, item.q);
      assert.equal(entities[i]?.acceptedAnswer.text, item.a);
    }
    assert.equal(faq?.url, "https://nurahelp.com/faq");
  });

  it("does not invent native apps, BLS jargon, or a clinical reviewer", () => {
    const raw = serializeJsonLd(buildHomeJsonLd("https://nurahelp.com"));
    assert.equal(/BLS/i.test(raw), false);
    assert.equal(raw.includes("iOS"), false);
    assert.equal(raw.includes("Android"), false);
    assert.equal(raw.includes("MedicalWebPage"), false);
    assert.equal(raw.includes("reviewedBy"), false);
    assert.equal(raw.includes("NuraHelp AI"), false);
  });

  it("escapes < in JSON-LD payloads", () => {
    assert.equal(serializeJsonLd({ a: "<script>" }), '{"a":"\\u003cscript>"}');
  });
});

function graphTypes(data: { "@graph": { "@type": unknown }[] }) {
  return data["@graph"].map((node) => node["@type"]);
}

describe("learn hub JSON-LD", () => {
  const origin = "https://nurahelp.com";
  const data = buildLearnJsonLd(origin);
  const page = data["@graph"].find((node) => node["@type"] === "CollectionPage");
  const crumbs = data["@graph"].find((node) => node["@type"] === "BreadcrumbList");

  it("emits Organization, CollectionPage, and BreadcrumbList", () => {
    assert.deepEqual(graphTypes(data), [
      "Organization",
      "CollectionPage",
      "BreadcrumbList",
    ]);
    assert.equal(page?.name, LEARN_JSON_LD.name);
    assert.equal(page?.url, `${origin}/learn`);
  });

  it("lists guides in on-page topic order", () => {
    const groups = clusterArticlesByTopic();
    const expected = CLUSTER_TOPICS.flatMap((topic) => groups[topic]);
    const list = page?.mainEntity as {
      numberOfItems: number;
      itemListElement: { name: string; url: string; position: number }[];
    };
    assert.equal(list.numberOfItems, expected.length);
    assert.equal(list.itemListElement.length, expected.length);
    for (const [i, article] of expected.entries()) {
      assert.equal(list.itemListElement[i]?.position, i + 1);
      assert.equal(list.itemListElement[i]?.name, article.title);
      assert.equal(
        list.itemListElement[i]?.url,
        `${origin}/blog/${article.slug}`,
      );
    }
  });

  it("breadcrumbs Home → Learn", () => {
    const items = crumbs?.itemListElement as { name: string; item: string }[];
    assert.deepEqual(
      items.map((item) => [item.name, item.item]),
      [
        ["Home", `${origin}/`],
        ["Learn", `${origin}/learn`],
      ],
    );
  });
});

describe("blog index JSON-LD", () => {
  const origin = "https://nurahelp.com";
  const data = buildBlogIndexJsonLd(origin);
  const page = data["@graph"].find((node) =>
    Array.isArray(node["@type"])
      ? node["@type"].includes("Blog")
      : node["@type"] === "Blog",
  );
  const crumbs = data["@graph"].find((node) => node["@type"] === "BreadcrumbList");

  it("emits Organization, CollectionPage+Blog, and BreadcrumbList", () => {
    assert.deepEqual(graphTypes(data), [
      "Organization",
      ["CollectionPage", "Blog"],
      "BreadcrumbList",
    ]);
    assert.equal(page?.name, BLOG_INDEX_JSON_LD.name);
    assert.equal(page?.url, `${origin}/blog`);
  });

  it("lists posts newest first", () => {
    const articles = listClusterArticles();
    const list = page?.mainEntity as {
      numberOfItems: number;
      itemListElement: { name: string; url: string }[];
    };
    assert.equal(list.numberOfItems, articles.length);
    assert.equal(list.itemListElement[0]?.name, articles[0]?.title);
    assert.equal(
      list.itemListElement[0]?.url,
      `${origin}/blog/${articles[0]?.slug}`,
    );
    assert.equal(
      list.itemListElement.at(-1)?.url,
      `${origin}/blog/${articles.at(-1)?.slug}`,
    );
  });

  it("breadcrumbs Home → Blog", () => {
    const items = crumbs?.itemListElement as { name: string; item: string }[];
    assert.deepEqual(
      items.map((item) => [item.name, item.item]),
      [
        ["Home", `${origin}/`],
        ["Blog", `${origin}/blog`],
      ],
    );
  });

  it("does not invent BLS jargon or a clinical reviewer", () => {
    const raw = serializeJsonLd(data);
    assert.equal(/BLS/i.test(raw), false);
    assert.equal(raw.includes("MedicalWebPage"), false);
    assert.equal(raw.includes("NuraHelp AI"), false);
  });
});

describe("YMYL MedicalWebPage (no invented reviewer)", () => {
  const origin = "https://nurahelp.com";

  it("emits MedicalWebPage with audience, specialty, and citations", () => {
    assert.equal(hasClinicalAdvisorConfigured(), false);
    const node = reviewablePageJsonLd({
      origin,
      path: "/emdr",
      name: "Test",
      description: "Test page",
    });
    assert.equal(node["@type"], "MedicalWebPage");
    const audience = node.audience as {
      "@type": string;
      audienceType: string;
    };
    assert.equal(audience["@type"], "MedicalAudience");
    assert.equal(audience.audienceType, "Patient");
    assert.equal(node.specialty, "https://schema.org/Psychiatric");
    assert.equal(Array.isArray(node.citation), true);
    assert.equal(
      (node.citation as unknown[]).length,
      CLINICAL_AUTHORITIES.length,
    );
    assert.equal("reviewedBy" in node, false);
    assert.equal("lastReviewed" in node, false);
  });

  it("clinical-team graph has no reviewedBy while advisor is unset", () => {
    const data = buildClinicalReviewJsonLd(origin);
    const raw = serializeJsonLd(data);
    assert.ok(raw.includes("MedicalWebPage"));
    assert.equal(raw.includes("reviewedBy"), false);
    assert.ok(raw.includes("EMDR International Association"));
    const page = data["@graph"].find(
      (n) => n["@type"] === "MedicalWebPage",
    ) as { name?: string; description?: string };
    assert.equal(page?.name, CLINICAL_REVIEW_JSON_LD.name);
    assert.equal(page?.description, CLINICAL_REVIEW_JSON_LD.description);
  });

  it("/emdr JSON-LD is MedicalWebPage without a fake reviewer", () => {
    const data = buildEmdrJsonLd(origin, [{ q: "Q?", a: "A." }]);
    const raw = serializeJsonLd(data);
    assert.ok(raw.includes("MedicalWebPage"));
    assert.equal(raw.includes("reviewedBy"), false);
    assert.equal(/BLS/i.test(raw), false);
  });
});

describe("clinical-team meta (F8 placeholder retired)", () => {
  it("does not ship the 'named advisor listed when configured' description", () => {
    const pages = resolveSiteSeoPages(
      DEFAULT_PLATFORM_SEO,
      "https://nurahelp.com",
    );
    const page = pages.find((p) => p.id === "clinical-team");
    assert.ok(page);
    assert.equal(page.description.includes("when configured"), false);
    assert.equal(page.description.includes("named advisor listed"), false);
    assert.ok(page.description.includes("EMDRIA"));
    assert.ok(
      RETIRED_SEO_DESCRIPTIONS.has(
        "How clinical review works for Nura’s self-help EMDR Support app — named advisor listed when configured.",
      ),
    );
  });
});

describe("cluster article JSON-LD (R5h)", () => {
  it("emits MedicalWebPage and BlogPosting without fake reviewedBy", () => {
    const article = listClusterArticles()[0];
    assert.ok(article);
    const data = buildClusterArticleJsonLd("https://nurahelp.com", article);
    const types = data["@graph"].map((n: { "@type"?: string }) => n["@type"]);
    assert.ok(types.includes("Organization"));
    assert.ok(types.includes("MedicalWebPage"));
    assert.ok(types.includes("BlogPosting"));
    assert.ok(types.includes("BreadcrumbList"));
    // The auto-generated FAQ block is gone; no FAQPage without visible Q&A.
    assert.equal(types.includes("FAQPage"), false);
    const raw = JSON.stringify(data);
    assert.equal(raw.includes("reviewedBy"), hasClinicalAdvisorConfigured());
    if (!hasClinicalAdvisorConfigured()) {
      assert.equal(raw.includes("lastReviewed"), false);
    }
    assert.ok(raw.includes("EMDRIA") || raw.includes("emdria"));
  });
});

describe("pricing JSON-LD", () => {
  it("emits Product/SoftwareApplication with Offer prices", () => {
    const data = buildPricingJsonLd("https://nurahelp.com");
    const raw = JSON.stringify(data);
    assert.ok(raw.includes("SoftwareApplication"));
    assert.ok(raw.includes("Product"));
    assert.ok(raw.includes("AggregateOffer"));
    assert.match(raw, /"price":"4\.99"/);
    assert.match(raw, /"price":"14\.99"/);
    assert.match(raw, /"price":"99\.00"/);
    assert.ok(raw.includes("trial"));
  });
});
