import { notFound } from "next/navigation";
import { ResourceArticleView } from "@/app/components/ResourcesView";
import { getPublishedResourceBySlug } from "@/lib/resources-db";
import { postToResourceItem } from "@/lib/resources";

export default async function ResourceArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedResourceBySlug(slug);
  if (!post) notFound();
  if (!post.body && !post.videoUrl) notFound();

  return <ResourceArticleView item={postToResourceItem(post)} />;
}
