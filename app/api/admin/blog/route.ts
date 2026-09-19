import { NextResponse } from "next/server";
import {
  isAuthContext,
  requirePlatformAdmin,
  requirePlatformSettingsAccess,
} from "@/lib/api-auth";
import {
  deleteBlogPost,
  getBlogPostBySlugOrId,
  listAllBlogPosts,
  listBlogCategories,
  upsertBlogPost,
  type BlogPostInput,
} from "@/lib/blog-db";
import { writeAuditEvent } from "@/lib/audit-log";

export async function GET() {
  // Drafts are unpublished editorial copy, so reads are platform-admin only.
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const [posts, categories] = await Promise.all([
    listAllBlogPosts(),
    listBlogCategories(),
  ]);
  return NextResponse.json({ posts, categories });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    post?: BlogPostInput;
    slug?: string;
    id?: string;
    published?: boolean;
  };

  if (body.action === "delete" && (body.slug || body.id)) {
    const target = body.slug ?? body.id ?? "";
    const removed = await deleteBlogPost(target);
    if (!removed) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "blog.post_deleted",
      detail: { source: "admin", slug: target },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "publish" && (body.slug || body.id)) {
    const existing = await getBlogPostBySlugOrId(body.slug ?? body.id ?? "");
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const result = await upsertBlogPost({
      id: existing.id,
      published: body.published !== false,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "blog.post_updated",
      detail: {
        source: "admin",
        slug: result.post.slug,
        published: result.post.published,
      },
    });
    return NextResponse.json({ post: result.post });
  }

  if (body.action === "save" && body.post) {
    const result = await upsertBlogPost(body.post);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: body.post.id ? "blog.post_updated" : "blog.post_created",
      detail: {
        source: "admin",
        slug: result.post.slug,
        categories: result.post.categories,
        published: result.post.published,
      },
    });
    return NextResponse.json({ post: result.post });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
