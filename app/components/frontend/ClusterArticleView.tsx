import Image from "next/image";
import Link from "next/link";
import { ClusterKeepReading } from "@/app/components/frontend/ClusterKeepReading";
import { blogCategoryName } from "@/lib/blog-categories";
import { BRAND_CIRCLE_AVATAR, BRAND_LIMITS_LINE, BRAND_SPOKEN } from "@/lib/brand";
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
    <article className="fe-cluster fe-cluster--post">
      <div className="fe-cluster-inner">
        <header className="fe-post-head">
          <div className="fe-post-meta">
            {article.categories.length ? (
              article.categories.map((slug) => (
                <Link
                  key={slug}
                  href={`/blog/category/${slug}`}
                  className="fe-post-pill"
                >
                  {blogCategoryName(slug)}
                </Link>
              ))
            ) : (
              // A guide with no clinical category still needs a clickable
              // section link, so it points at the blog index rather than
              // showing a topic label that looks like a category.
              <Link href="/blog" className="fe-post-pill">
                Blog
              </Link>
            )}
          </div>

          <h1 className="fe-post-title">{article.title}</h1>
          <p className="fe-cluster-dek fe-post-dek">{article.dek}</p>

          <div className="fe-post-byline">
            <Image
              src={BRAND_CIRCLE_AVATAR}
              alt=""
              width={40}
              height={40}
              className="fe-post-avatar"
            />
            <div className="fe-post-byline-text">
              <p className="fe-post-author">
                {BRAND_SPOKEN}
                <span className="fe-post-author-sep" aria-hidden>
                  ·
                </span>
                <Link href="/editorial" className="fe-post-author-link">
                  How we write
                </Link>
              </p>
              {date ? (
                <time className="fe-post-date" dateTime={article.publishedAt}>
                  Published {date}
                </time>
              ) : null}
            </div>
          </div>
        </header>

        {article.coverUrl ? (
          <div className="fe-cluster-hero">
            <Image
              src={article.coverUrl}
              // Decorative editorial still: an invented description would be fake
              // specificity, so the image is skipped by assistive tech.
              alt=""
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 1156px"
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
