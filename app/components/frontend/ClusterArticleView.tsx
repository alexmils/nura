import Image from "next/image";
import Link from "next/link";
import { ClusterKeepReading } from "@/app/components/frontend/ClusterKeepReading";
import { blogCategoryName } from "@/lib/blog-categories";
import { BRAND_LIMITS_LINE, BRAND_SPOKEN } from "@/lib/brand";
import {
  CLUSTER_TOPIC_LABEL,
  clusterArticleFaqs,
  learnTopicHref,
  relatedClusterArticles,
  type ClusterArticle,
} from "@/lib/content-cluster";
import { formatBlogDate } from "@/lib/landing-blog";
import "./public-cluster.css";

export function ClusterArticleView({
  article,
  related: relatedProp,
}: {
  article: ClusterArticle;
  related?: ClusterArticle[];
}) {
  const related = relatedProp ?? relatedClusterArticles(article);
  const date = formatBlogDate(article.publishedAt);
  const learnHref = learnTopicHref(article.topic);
  const faqs = clusterArticleFaqs(article);

  return (
    <article className="fe-cluster">
      <div className="fe-cluster-inner">
        <p className="fe-cluster-kicker">
          <Link href={learnHref}>{CLUSTER_TOPIC_LABEL[article.topic]}</Link>
          {" · "}
          <Link href="/learn">Learn</Link>
        </p>
        <h1>{article.title}</h1>
        <p className="fe-cluster-dek">{article.dek}</p>
        {article.categories.length ? (
          <p className="fe-cluster-cats">
            {article.categories.map((slug, i) => (
              <span key={slug}>
                {i > 0 ? " · " : null}
                <Link href={`/blog/category/${slug}`}>
                  {blogCategoryName(slug)}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        {date ? (
          <p className="fe-cluster-meta">
            <time dateTime={article.publishedAt}>{date}</time>
            {" · "}
            {BRAND_SPOKEN} editorial
            {" · "}
            <Link href="/editorial">How we write</Link>
          </p>
        ) : null}

        {article.coverUrl ? (
          <div className="fe-cluster-hero">
            <Image
              src={article.coverUrl}
              // Decorative editorial still: an invented description would be fake
              // specificity, so the image is skipped by assistive tech.
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 1156px"
              className="fe-cluster-hero-image"
            />
          </div>
        ) : null}

        <div className="fe-cluster-body">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </section>
          ))}
        </div>

        {faqs.length ? (
          <section className="fe-cluster-faq" aria-label="Common questions">
            <h2>Common questions</h2>
            {faqs.map((item) => (
              <div key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </section>
        ) : null}

        {article.emdrAnchor ? (
          <p className="fe-cluster-emdr">
            In the app:{" "}
            <Link href="/emdr">{article.emdrAnchor}</Link>.
          </p>
        ) : null}

        <p className="fe-cluster-note">
          {BRAND_LIMITS_LINE}{" "}
          <Link href="/limits">Read the limits</Link>.
        </p>
      </div>

      {related.length ? (
        <ClusterKeepReading
          posts={related.map((item) => ({
            slug: item.slug,
            title: item.title,
            dek: item.dek,
            coverUrl: item.coverUrl,
            tag: item.categories.length
              ? blogCategoryName(item.categories[0]!)
              : CLUSTER_TOPIC_LABEL[item.topic],
          }))}
          indexHref={learnHref}
          indexLabel={`More in ${CLUSTER_TOPIC_LABEL[article.topic]}`}
        />
      ) : null}
    </article>
  );
}
