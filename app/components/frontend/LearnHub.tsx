"use client";

import {
  learnReadingPath,
  listClusterArticles,
  type ClusterTopic,
} from "@/lib/content-cluster";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { SectionEdit } from "@/app/components/frontend/section-editor/SectionEdit";
import { useSectionConfig } from "@/app/components/frontend/section-editor/MarketingCopy";
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

export function LearnHub() {
  const page = useSectionConfig("learn-hub");
  const savedPaths = sectionList(page, "paths");
  const articles = listClusterArticles().map(toHelpArticle);
  const pathOrder = [
    ...savedPaths
      .map((row) => row.id)
      .filter((id): id is ClusterTopic => TOPIC_ORDER.includes(id as ClusterTopic)),
    ...TOPIC_ORDER.filter((topic) => !savedPaths.some((row) => row.id === topic)),
  ];
  const paths: LearnHelpPath[] = pathOrder.map((topic) => {
    const copy = PATH_COPY[topic];
    const saved = savedPaths.find((row) => row.id === topic);
    const moreHref = saved?.moreHref || copy.moreHref;
    const moreLabel = saved?.moreLabel || copy.moreLabel;
    return {
      topic,
      label: saved?.label || copy.cardLabel,
      cardDek: saved?.cardDek || copy.cardDek,
      panelTitle: saved?.panelTitle || copy.panelTitle,
      panelAccent: saved?.panelAccent || copy.panelAccent,
      panelDek: saved?.panelDek || copy.panelDek,
      moreHref: moreHref || undefined,
      moreLabel: moreLabel || undefined,
      articles: learnReadingPath(topic).map(toHelpArticle),
    };
  }).filter((path) => path.articles.length > 0);

  return (
    <div className="fe-has-edit" data-section="learn-hub">
      <SectionEdit id="learn-hub" lift />
      <LearnHelpCenter
        articles={articles}
        paths={paths}
        badge={sectionText(page, "badge")}
        badgeHref={sectionText(page, "badgeHref")}
        title={sectionText(page, "title")}
        dek={sectionText(page, "dek")}
        searchPlaceholder={sectionText(page, "search")}
      />
    </div>
  );
}
