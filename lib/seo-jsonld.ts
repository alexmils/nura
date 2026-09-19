import {
  BILLING_PLANS,
  TRIAL_DAYS,
  orderedBillingPlans,
} from "@/lib/billing-constants";
import { BRAND_SPOKEN } from "@/lib/brand";
import {
  CLINICAL_AUTHORITIES,
  MEDICAL_PAGE_AUDIENCE,
  MEDICAL_PAGE_SPECIALTY,
} from "@/lib/clinical-authorities";
import {
  CLUSTER_TOPICS,
  CLUSTER_TOPIC_LABEL,
  articleModifiedAt,
  clusterArticleFaqs,
  clusterArticlesByTopic,
  clusterTimeRequired,
  clusterWordCount,
  listClusterArticles,
  type ClusterArticle,
} from "@/lib/content-cluster";
import { blogCategoryName } from "@/lib/blog-categories";
import {
  CLINICAL_ADVISOR,
  hasClinicalAdvisorConfigured,
  legalEntityDisplayName,
} from "@/lib/legal-entity";
import { PRICING_FAQ_ITEMS } from "@/lib/pricing-faq";

export const SITE_CONTENT_LANGUAGE = "en";

/** Canonical + hreflang for the current (only) locale. Ready for more languages later. */
export function localeAlternates(canonical: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  return {
    canonical,
    languages: {
      "x-default": canonical,
      [SITE_CONTENT_LANGUAGE]: canonical,
    },
  };
}

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function breadcrumbJsonLd(origin: string, items: BreadcrumbItem[]) {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path === "/" ? `${base}/` : `${base}${item.path}`,
    })),
  };
}

export function organizationJsonLd(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_SPOKEN,
    legalName: legalEntityDisplayName(),
    alternateName: legalEntityDisplayName(),
    url: `${base}/`,
    email: "hello@nurahelp.com",
    description:
      "Guided EMDR practice and visual sets in a calm online app.",
  };
}

export function stringifyJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type ItemListEntry = {
  name: string;
  path: string;
};

export function itemListJsonLd(origin: string, items: ItemListEntry[]) {
  const base = origin.replace(/\/$/, "");
  return {
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${base}${item.path}`,
    })),
  };
}

export function collectionPageJsonLd({
  origin,
  path,
  name,
  description,
  types = ["CollectionPage"],
  items,
}: {
  origin: string;
  path: string;
  name: string;
  description: string;
  types?: string[];
  items: ItemListEntry[];
}) {
  const base = origin.replace(/\/$/, "");
  const url = `${base}${path}`;
  return {
    "@type": types.length === 1 ? types[0] : types,
    "@id": `${url}#page`,
    url,
    name,
    description,
    inLanguage: SITE_CONTENT_LANGUAGE,
    isPartOf: {
      "@type": "WebSite",
      name: BRAND_SPOKEN,
      url: `${base}/`,
    },
    mainEntity: itemListJsonLd(origin, items),
  };
}

/** Visible H1 + dek on `/learn` — JSON-LD must match the hub, not the meta title. */
export const LEARN_JSON_LD = {
  name: "How can we help?",
  description: "Short guides on EMDR, sets, and staying safe.",
} as const;

/** Visible H1 on `/knowledge` — matches meta keyword focus. */
export const KNOWLEDGE_JSON_LD = {
  name: "EMDR knowledge clips",
  description:
    "Short clips answering the questions people ask before a session: how AI agent-guided works, what Self-guided does, the trial, and when to stop.",
} as const;

/** Visible H1 + dek on `/blog` (dek without the Learn link markup). */
export const BLOG_INDEX_JSON_LD = {
  name: "EMDR articles, newest first",
  description:
    "Pick a theme, or read the newest guides. New here? Start on Learn for curated reading paths.",
} as const;

function articleListItems(posts: ClusterArticle[] = listClusterArticles()) {
  return posts.map((article) => ({
    name: article.title,
    path: `/blog/${article.slug}`,
  }));
}

function learnListItems() {
  const groups = clusterArticlesByTopic();
  return CLUSTER_TOPICS.flatMap((topic) =>
    groups[topic].map((article) => ({
      name: article.title,
      path: `/blog/${article.slug}`,
    })),
  );
}

export function buildLearnJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      collectionPageJsonLd({
        origin,
        path: "/learn",
        name: LEARN_JSON_LD.name,
        description: LEARN_JSON_LD.description,
        items: learnListItems(),
      }),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Learn", path: "/learn" },
      ]),
    ],
  };
}

export function buildKnowledgeJsonLd(origin: string, faq: FaqItem[]) {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      {
        "@type": "WebPage",
        "@id": `${base}/knowledge`,
        url: `${base}/knowledge`,
        name: KNOWLEDGE_JSON_LD.name,
        description: KNOWLEDGE_JSON_LD.description,
        isPartOf: { "@id": `${base}/#website` },
      },
      faqPageJsonLd(faq),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: KNOWLEDGE_JSON_LD.name, path: "/knowledge" },
      ]),
    ],
  };
}

export function buildBlogIndexJsonLd(
  origin: string,
  posts: ClusterArticle[] = listClusterArticles()
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      collectionPageJsonLd({
        origin,
        path: "/blog",
        name: BLOG_INDEX_JSON_LD.name,
        description: BLOG_INDEX_JSON_LD.description,
        types: ["CollectionPage", "Blog"],
        items: articleListItems(posts),
      }),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
      ]),
    ],
  };
}

/** Category hub: CollectionPage of the guides in one clinical category. */
export function buildBlogCategoryJsonLd(
  origin: string,
  category: { slug: string; name: string; description: string },
  posts: ClusterArticle[]
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      collectionPageJsonLd({
        origin,
        path: `/blog/category/${category.slug}`,
        name: `${category.name} — EMDR guides`,
        description: category.description,
        types: ["CollectionPage", "Blog"],
        items: articleListItems(posts),
      }),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: category.name, path: `/blog/category/${category.slug}` },
      ]),
    ],
  };
}

export type FaqItem = { q: string; a: string };

export function faqPageJsonLd(items: FaqItem[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** Blog guide leaf: BlogPosting + MedicalWebPage + FAQPage (no fake reviewedBy). */
export function buildClusterArticleJsonLd(
  origin: string,
  article: ClusterArticle
) {
  const base = origin.replace(/\/$/, "");
  const path = `/blog/${article.slug}`;
  const url = `${base}${path}`;
  const editorial = `${base}/editorial`;
  const faqs = clusterArticleFaqs(article);

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      reviewablePageJsonLd({
        origin,
        path,
        name: article.title,
        description: article.description,
      }),
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        dateModified: articleModifiedAt(article),
        inLanguage: SITE_CONTENT_LANGUAGE,
        url,
        mainEntityOfPage: url,
        isPartOf: { "@id": `${url}#page` },
        // Section + keywords let Google tie the guide to its category hub.
        articleSection: article.categories.length
          ? article.categories.map(blogCategoryName)
          : [CLUSTER_TOPIC_LABEL[article.topic]],
        keywords: [
          ...article.categories.map(blogCategoryName),
          CLUSTER_TOPIC_LABEL[article.topic],
          "EMDR",
        ].join(", "),
        wordCount: clusterWordCount(article),
        timeRequired: clusterTimeRequired(article),
        author: {
          "@type": "Organization",
          name: BRAND_SPOKEN,
          url: editorial,
        },
        publisher: {
          "@type": "Organization",
          name: BRAND_SPOKEN,
          url: `${base}/`,
        },
      },
      {
        ...faqPageJsonLd(faqs),
        "@id": `${url}#faq`,
        url,
        mainEntityOfPage: url,
      },
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: article.title, path },
      ]),
    ],
  };
}

/**
 * YMYL page node. Always `MedicalWebPage` with audience + specialty + citations.
 * Adds `reviewedBy` / `lastReviewed` only when a real advisor is in
 * `CLINICAL_ADVISOR` — never invent credentials.
 */
export function reviewablePageJsonLd({
  origin,
  path,
  name,
  description,
}: {
  origin: string;
  path: string;
  name: string;
  description: string;
}) {
  const base = origin.replace(/\/$/, "");
  const url = `${base}${path}`;
  const node: Record<string, unknown> = {
    "@type": "MedicalWebPage",
    "@id": `${url}#page`,
    url,
    name,
    description,
    inLanguage: SITE_CONTENT_LANGUAGE,
    isPartOf: { "@type": "WebSite", name: BRAND_SPOKEN, url: `${base}/` },
    audience: { ...MEDICAL_PAGE_AUDIENCE },
    specialty: MEDICAL_PAGE_SPECIALTY,
    citation: CLINICAL_AUTHORITIES.map((a) => ({
      "@type": "CreativeWork",
      name: a.name,
      url: a.url,
    })),
  };
  if (hasClinicalAdvisorConfigured()) {
    if (CLINICAL_ADVISOR.lastReviewedAt) {
      node.lastReviewed = CLINICAL_ADVISOR.lastReviewedAt;
    }
    node.reviewedBy = {
      "@type": "Person",
      name: CLINICAL_ADVISOR.name,
      ...(CLINICAL_ADVISOR.credentials
        ? { hasCredential: CLINICAL_ADVISOR.credentials }
        : {}),
    };
  }
  return node;
}

/** H1 + lead mirrored into JSON-LD for `/about/clinical-team`. */
export const CLINICAL_REVIEW_JSON_LD = {
  name: "How clinical review works",
  description:
    "How Nura checks intake screening, safety copy, and protocol barriers — citing EMDRIA, APA, NICE, WHO, and PubMed. Named clinician listed only after a real review.",
} as const;

export function buildClinicalReviewJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      reviewablePageJsonLd({
        origin,
        path: "/about/clinical-team",
        name: CLINICAL_REVIEW_JSON_LD.name,
        description: CLINICAL_REVIEW_JSON_LD.description,
      }),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
        { name: "Clinical review", path: "/about/clinical-team" },
      ]),
    ],
  };
}

/** H1 + lead on `/emdr` — JSON-LD name/description mirror the page, not the meta. */
export const EMDR_JSON_LD = {
  name: "AI-guided EMDR therapy online",
  description:
    "A guided self-help tool for bilateral stimulation — visual, audio, and tactile sets with an AI that paces the session, prompts grounding, and closes it properly. Not therapy, and not a substitute for a clinician.",
} as const;

/** H1 + lead on `/safety`. */
export const SAFETY_JSON_LD = {
  name: "Using AI-guided EMDR safely",
  description:
    "When to stop a session, when to contact a clinician, and crisis lines to call if you are not safe. Nura is self-help software, not emergency care.",
} as const;

/** H1 + lead on `/limits`. */
export const LIMITS_JSON_LD = {
  name: "What Nura does not do",
  description:
    "The honest limits of AI-guided EMDR: no diagnosis, no treatment, no clinical judgment, no crisis care. What a tool can and cannot do on its own.",
} as const;

export function buildEmdrJsonLd(origin: string, faqItems: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      reviewablePageJsonLd({
        origin,
        path: "/emdr",
        name: EMDR_JSON_LD.name,
        description: EMDR_JSON_LD.description,
      }),
      faqPageJsonLd(faqItems),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "EMDR", path: "/emdr" },
      ]),
    ],
  };
}

export function buildSafetyJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      reviewablePageJsonLd({
        origin,
        path: "/safety",
        name: SAFETY_JSON_LD.name,
        description: SAFETY_JSON_LD.description,
      }),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Safety", path: "/safety" },
      ]),
    ],
  };
}

export function buildLimitsJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      reviewablePageJsonLd({
        origin,
        path: "/limits",
        name: LIMITS_JSON_LD.name,
        description: LIMITS_JSON_LD.description,
      }),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Limits", path: "/limits" },
      ]),
    ],
  };
}

function offerAmount(displayPrice: string): string {
  const n = displayPrice.replace(/[^\d.]/g, "");
  if (!n) return "0";
  return n.includes(".") ? n : `${n}.00`;
}

/** H1 + lead mirrored into JSON-LD for `/pricing`. */
export const PRICING_JSON_LD = {
  name: "Plans tailored to your pace",
  description: `${TRIAL_DAYS}-day trial. Same full app on every plan — pick how often you pay.`,
} as const;

/** H1 mirrored into JSON-LD for `/faq`. */
export const PUBLIC_FAQ_JSON_LD = {
  name: "EMDR App FAQ",
  description:
    "Answers to the questions people ask before starting: is guided EMDR safe, how long a session takes, what happens if you feel worse, and how billing works.",
} as const;

/** H1 + lead mirrored into JSON-LD for `/support`. */
export const SUPPORT_JSON_LD = {
  name: "Support — Get Help With Your Account",
  description:
    "Get help with your Nura account, billing, sessions, or data. How to reach us and what to include so we can fix it fast.",
} as const;

export function buildPricingJsonLd(origin: string) {
  const base = origin.replace(/\/$/, "");
  const plans = orderedBillingPlans(BILLING_PLANS);
  const offerNodes = plans.map((plan, i) => ({
    "@type": "Offer" as const,
    "@id": `${base}/pricing#offer-${plan.id}`,
    position: i + 1,
    name: `${BRAND_SPOKEN} ${plan.label}`,
    description: `${plan.label} plan after a ${TRIAL_DAYS}-day trial. AI agent-guided and Self-guided sessions included.`,
    price: offerAmount(plan.displayPrice),
    priceCurrency: "USD",
    url: `${base}/pricing`,
    availability: "https://schema.org/InStock",
    category: plan.interval,
  }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      {
        "@type": "WebPage",
        "@id": `${base}/pricing#page`,
        url: `${base}/pricing`,
        name: PRICING_JSON_LD.name,
        description: PRICING_JSON_LD.description,
        inLanguage: SITE_CONTENT_LANGUAGE,
        isPartOf: {
          "@type": "WebSite",
          name: BRAND_SPOKEN,
          url: `${base}/`,
        },
        mainEntity: { "@id": `${base}/pricing#product` },
      },
      {
        "@type": ["Product", "SoftwareApplication"],
        "@id": `${base}/pricing#product`,
        name: BRAND_SPOKEN,
        description: PRICING_JSON_LD.description,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        url: `${base}/pricing`,
        brand: {
          "@type": "Brand",
          name: BRAND_SPOKEN,
        },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: offerAmount(BILLING_PLANS.weekly.displayPrice),
          highPrice: offerAmount(BILLING_PLANS.yearly.displayPrice),
          offerCount: plans.length,
          url: `${base}/pricing`,
          offers: offerNodes,
        },
      },
      ...offerNodes,
      faqPageJsonLd([...PRICING_FAQ_ITEMS]),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Pricing", path: "/pricing" },
      ]),
    ],
  };
}

export function buildPublicFaqJsonLd(origin: string, faqItems: FaqItem[]) {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      {
        "@type": "WebPage",
        "@id": `${base}/faq#page`,
        url: `${base}/faq`,
        name: PUBLIC_FAQ_JSON_LD.name,
        description: PUBLIC_FAQ_JSON_LD.description,
        inLanguage: SITE_CONTENT_LANGUAGE,
      },
      {
        ...faqPageJsonLd(faqItems),
        "@id": `${base}/faq#faq`,
        url: `${base}/faq`,
      },
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "EMDR App FAQ", path: "/faq" },
      ]),
    ],
  };
}

export function buildSupportJsonLd(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...organizationJsonLd(origin),
        email: "hello@nurahelp.com",
        contactPoint: {
          "@type": "ContactPoint",
          email: "hello@nurahelp.com",
          contactType: "customer support",
        },
      },
      {
        "@type": ["WebPage", "ContactPage"],
        "@id": `${base}/support#page`,
        url: `${base}/support`,
        name: SUPPORT_JSON_LD.name,
        description: SUPPORT_JSON_LD.description,
        inLanguage: SITE_CONTENT_LANGUAGE,
        isPartOf: {
          "@type": "WebSite",
          name: BRAND_SPOKEN,
          url: `${base}/`,
        },
      },
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "Support", path: "/support" },
      ]),
    ],
  };
}

export const ABOUT_JSON_LD = {
  name: "About the EMDR therapy online app",
  description:
    "Nura is an online app for guided EMDR therapy between sessions — AI agent-guided practice and self-guided visual sets on your schedule.",
} as const;

export function buildAboutJsonLd(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      {
        "@type": "AboutPage",
        "@id": `${base}/about#page`,
        url: `${base}/about`,
        name: ABOUT_JSON_LD.name,
        description: ABOUT_JSON_LD.description,
        inLanguage: SITE_CONTENT_LANGUAGE,
        isPartOf: { "@type": "WebSite", name: BRAND_SPOKEN, url: `${base}/` },
      },
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ]),
    ],
  };
}

export function buildLegalWebPageJsonLd({
  origin,
  path,
  name,
  description,
}: {
  origin: string;
  path: string;
  name: string;
  description: string;
}) {
  const base = origin.replace(/\/$/, "");
  const url = `${base}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name,
        description,
        inLanguage: SITE_CONTENT_LANGUAGE,
        isPartOf: { "@type": "WebSite", name: BRAND_SPOKEN, url: `${base}/` },
      },
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name, path },
      ]),
    ],
  };
}
