import Image from "next/image";
import Link from "next/link";
import "./public-cluster.css";

export type KeepReadingPost = {
  slug: string;
  title: string;
  dek?: string;
  coverUrl: string | null;
  tag?: string;
};

type ClusterKeepReadingProps = {
  posts: KeepReadingPost[];
  /** Extra link under the cards (e.g. all guides). */
  indexHref?: string;
  indexLabel?: string;
};

export function ClusterKeepReading({
  posts,
  indexHref = "/learn",
  indexLabel = "All articles",
}: ClusterKeepReadingProps) {
  const cards = posts.filter((p) => Boolean(p.coverUrl)).slice(0, 3);
  if (!cards.length) return null;

  return (
    <nav className="fe-cluster-related fe-cluster-related--cards" aria-label="Keep reading">
      <h2>Keep reading</h2>
      <ul className="fe-cluster-card-grid">
        {cards.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="fe-cluster-card">
              <span className="fe-cluster-card-media">
                <Image
                  src={post.coverUrl!}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 100vw, 33vw"
                  className="fe-cluster-card-image"
                />
              </span>
              {post.tag ? (
                <span className="fe-cluster-card-tag">{post.tag}</span>
              ) : null}
              <span className="fe-cluster-card-title">{post.title}</span>
              {post.dek ? (
                <span className="fe-cluster-card-dek">{post.dek}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <p className="fe-cluster-related-more">
        <Link href={indexHref}>{indexLabel}</Link>
      </p>
    </nav>
  );
}
