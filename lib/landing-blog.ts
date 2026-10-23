import type { ResourceKind, ResourcePost } from "@/lib/resources";

export type LandingBlogPost = {
  slug: string;
  title: string;
  summary: string;
  kind: ResourceKind;
  tag: string;
  coverUrl: string | null;
  createdAt: string;
  /** Estimated minutes — shown on home / blog cards. */
  readMinutes?: number;
};

const COVER_FALLBACKS = [
  "/marketing/landing/reading.jpg",
  "/marketing/landing/green-landscape.jpg",
  "/marketing/landing/practice-space.jpg",
] as const;

function blogTag(kind: ResourceKind, slug: string): string {
  if (kind === "safety") return "Safety";
  if (kind === "video") return "Video";
  if (slug.includes("ground")) return "Grounding";
  if (slug.includes("pause")) return "Safety";
  if (slug.includes("emdr")) return "EMDR";
  if (slug.includes("guided") || slug.includes("free")) return "Sessions";
  return "Guide";
}

export function formatBlogDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    // Fixed zone: the server and the visitor's browser must print the same
    // day (a post at 00:00Z read "October 9" west of UTC and failed hydration).
    timeZone: "UTC",
  }).format(d);
}

export function toLandingPost(post: ResourcePost, index: number): LandingBlogPost {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    kind: post.kind,
    tag: blogTag(post.kind, post.slug),
    coverUrl: post.coverUrl || COVER_FALLBACKS[index % COVER_FALLBACKS.length],
    createdAt: post.createdAt,
  };
}
