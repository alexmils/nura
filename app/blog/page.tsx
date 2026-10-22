import { permanentRedirect } from "next/navigation";

/**
 * The archive index moved to /learn, which groups the same posts by topic.
 * Articles keep their /blog/<slug> URLs, and so do categories and the RSS feed.
 */
export default function BlogIndexPage() {
  permanentRedirect("/learn");
}
