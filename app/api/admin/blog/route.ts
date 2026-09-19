import { NextResponse } from "next/server";
import {
  isAuthContext,
  requireAdminAccess,
  requirePlatformAdmin,
} from "@/lib/api-auth";
import {
  deleteBlogPost,
  getBlogPostBySlugOrId,
  listAllBlogPosts,
  listBlogCategories,
  upsertBlogCategory,
  upsertBlogPost,
  type BlogPostInput,
} from "@/lib/blog-db";

export async function GET() {
  const auth = await requireAdminAccess();
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
    category?: { slug?: string; name?: string; description?: string; sortOrder?: number };
    slug?: string;
    id?: string;
    published?: boolean;
  };

  if (body.action === "delete" && (body.slug || body.id)) {
    const removed = await deleteBlogPost(body.slug ?? body.id ?? "");
    if (!removed) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
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
    return NextResponse.json({ post: result.post });
  }

  if (body.action === "category" && body.category) {
    const result = await upsertBlogCategory(body.category);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ category: result.category });
  }

  if (body.action === "save" && body.post) {
    const result = await upsertBlogPost(body.post);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ post: result.post });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
