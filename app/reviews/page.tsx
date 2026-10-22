import type { Metadata } from "next";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { listPublishedReviews } from "@/lib/feedback-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews | Nura",
  description:
    "Unedited notes from people who tried Nura's guided EMDR-style sessions.",
  alternates: { canonical: "/reviews" },
};

/**
 * The public side of the reviews the admin chooses to publish. Private
 * feedback never reaches this page; only rows with a `published_at` do.
 */
export default async function ReviewsPage() {
  const reviews = await listPublishedReviews().catch(() => []);

  return (
    <FrontendShell>
      <section className="fe-reviews-page">
        <header className="fe-reviews-head">
          <p className="fe-reviews-kicker">Reviews</p>
          <h1 className="fe-reviews-title">In their words</h1>
          <p className="fe-reviews-lead">
            Unedited notes from people who tried Nura. We publish a review only
            after the member agrees, and we never show their email.
          </p>
        </header>

        {reviews.length === 0 ? (
          <p className="fe-reviews-empty">
            Reviews will appear here as members share them.
          </p>
        ) : (
          <div className="fe-reviews-grid">
            {reviews.map((review) => (
              <article
                key={review.id}
                className={`fe-review-card${review.featured ? " is-featured" : ""}`}
              >
                <p className="fe-review-score">
                  {review.score}
                  <span>/10</span>
                </p>
                <blockquote className="fe-review-quote">
                  {review.comment}
                </blockquote>
                <footer className="fe-review-author">
                  <span>{review.author}</span>
                  <time dateTime={review.publishedAt}>
                    {new Date(review.publishedAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </FrontendShell>
  );
}
