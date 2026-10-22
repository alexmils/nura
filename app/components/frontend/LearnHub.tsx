import {
  learnReadingPath,
  type ClusterArticle,
  type ClusterTopic,
} from "@/lib/content-cluster";
import { listPublishedBlogPosts } from "@/lib/blog-db";
import {
  LearnHelpCenter,
  type LearnHelpArticle,
  type LearnHelpPath,
} from "@/app/components/frontend/LearnHelpCenter";

const TOPIC_ORDER: ClusterTopic[] = ["understand", "practice", "safety"];

const PATH_COPY: Record<
  ClusterTopic,
  {
    cardLabel: string;
    cardDek: string;
    panelTitle: string;
    panelAccent: string;
    panelDek: string;
    moreHref?: string;
    moreLabel?: string;
  }
> = {
  understand: {
    cardLabel: "Understand",
    cardDek: "What EMDR is",
    panelTitle: "Get started with",
    panelAccent: "EMDR.",
    panelDek: "Three guides. Read in order.",
  },
  practice: {
    cardLabel: "Practice",
    cardDek: "Sets between sessions",
    panelTitle: "Practice with",
    panelAccent: "session sets.",
    panelDek: "Sets, structure, between days.",
  },
  safety: {
    cardLabel: "Safety",
    cardDek: "When to pause",
    panelTitle: "Stay safe with",
    panelAccent: "grounding.",
    panelDek: "Pause, stop, or get a human.",
    moreHref: "/safety",
    moreLabel: "Read the full safety guide",
  },
};

function toHelpArticle(article: {
  slug: string;
  title: string;
  dek: string;
  topic: ClusterTopic;
}): LearnHelpArticle {
  return {
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    topic: article.topic,
    href: `/blog/${article.slug}`,
  };
}

/**
 * The blog hub. Every published post comes from the database, so an article
 * added in admin shows up here; the curated reading order still comes first
 * in each topic group, with anything new appended after it.
 */
export async function LearnHub({
  posts: postsProp,
}: {
  posts?: ClusterArticle[];
} = {}) {
  const posts = postsProp ?? (await listPublishedBlogPosts());
  const published = new Set(posts.map((post) => post.slug));
  const articles = posts.map(toHelpArticle);

  const paths: LearnHelpPath[] = TOPIC_ORDER.map((topic) => {
    const copy = PATH_COPY[topic];
    const curated = learnReadingPath(topic)
      .filter((article) => published.has(article.slug))
      .map(toHelpArticle);
    const chosen = new Set(curated.map((article) => article.slug));
    const rest = articles.filter(
      (article) => article.topic === topic && !chosen.has(article.slug)
    );
    return {
      topic,
      label: copy.cardLabel,
      cardDek: copy.cardDek,
      panelTitle: copy.panelTitle,
      panelAccent: copy.panelAccent,
      panelDek: copy.panelDek,
      moreHref: copy.moreHref,
      moreLabel: copy.moreLabel,
      articles: [...curated, ...rest],
    };
  }).filter((path) => path.articles.length > 0);

  return <LearnHelpCenter articles={articles} paths={paths} />;
}
