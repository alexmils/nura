/**
 * Nura blog MCP endpoint (Streamable HTTP, stateless JSON-RPC 2.0).
 *
 * Connect from Cursor:
 *   "nura-blog": {
 *     "url": "http://localhost:3471/api/mcp",
 *     "type": "streamableHttp",
 *     "headers": { "Authorization": "Bearer <NURA_MCP_TOKEN>" }
 *   }
 *
 * Tools let the editorial agent list categories, then create/update a guide
 * with an explicit `categories` choice so every post lands on a category page.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit-log";
import {
  deleteBlogPost,
  getBlogPostBySlugOrId,
  listAllBlogPosts,
  listBlogCategories,
  upsertBlogPost,
  type BlogPostInput,
  type BlogPostRecord,
} from "@/lib/blog-db";
import { BLOG_CATEGORY_SLUGS } from "@/lib/blog-categories";
import { CLUSTER_TOPICS } from "@/lib/content-cluster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "nura-blog", version: "1.0.0" };
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const SECTION_SCHEMA = {
  type: "object",
  required: ["heading", "paragraphs"],
  properties: {
    heading: { type: "string", description: "Section title, sentence case." },
    paragraphs: {
      type: "array",
      minItems: 1,
      items: {
        type: "string",
        description: "One paragraph. No em dash, no BLS acronym.",
      },
    },
  },
  additionalProperties: false,
} as const;

const POST_FIELDS = {
  title: { type: "string", description: "SEO title stem, no brand suffix." },
  description: {
    type: "string",
    description:
      "Meta description. Value only: no disclaimers, no 'not a licensed therapist'.",
  },
  dek: { type: "string", description: "One-line lead shown under the H1." },
  kicker: { type: "string", description: "Small uppercase label." },
  slug: {
    type: "string",
    description: "URL slug. Defaults to the title if omitted.",
  },
  topic: {
    type: "string",
    enum: [...CLUSTER_TOPICS],
    description:
      "Structural topic for /learn. Separate from clinical categories.",
  },
  categories: {
    type: "array",
    minItems: 1,
    items: { type: "string", enum: [...BLOG_CATEGORY_SLUGS] },
    description:
      "Clinical categories this guide belongs to. Required on create. Pick from list_blog_categories.",
  },
  sections: {
    type: "array",
    minItems: 1,
    items: SECTION_SCHEMA,
    description: "Article body: ordered sections.",
  },
  related: {
    type: "array",
    items: { type: "string" },
    description: "Slugs of related guides.",
  },
  coverUrl: {
    type: "string",
    description: "Site path (/marketing/...) or https image URL.",
  },
  emdrAnchor: {
    type: "string",
    description: "Descriptive link text back to /emdr.",
  },
  featured: { type: "boolean", description: "Show on the home blog grid." },
  published: {
    type: "boolean",
    description: "false saves a draft (default on create).",
  },
  publishedAt: {
    type: "string",
    description: "ISO date. Defaults to now.",
  },
} as const;

const TOOLS = [
  {
    name: "list_blog_categories",
    description:
      "List the clinical blog categories with slugs and post counts. Call this first, then pass one or more slugs to create_blog_post.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_blog_posts",
    description:
      "List blog posts (id, slug, title, categories, published). Optionally filter by category or publication state.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: [...BLOG_CATEGORY_SLUGS] },
        published: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_blog_post",
    description: "Get one post by slug or id, including full sections.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "create_blog_post",
    description:
      "Create a guide. `categories` is required: choose the theme it is written for so it appears on that category page. `emdrAnchor` is required too (the descriptive link back to /emdr). Saves as draft unless published=true. Copy must not use an em dash or the acronym BLS.",
    inputSchema: {
      type: "object",
      required: [
        "title",
        "description",
        "dek",
        "sections",
        "categories",
        "emdrAnchor",
      ],
      properties: POST_FIELDS,
      additionalProperties: false,
    },
  },
  {
    name: "update_blog_post",
    description:
      "Update an existing guide. `slug` selects the post; pass `newSlug` to rename it. Only the fields you pass change; passing categories replaces the category set.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        ...POST_FIELDS,
        newSlug: {
          type: "string",
          description: "Rename the post to this slug (optional).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "delete_blog_post",
    description: "Delete a guide by slug or id.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string" } },
      additionalProperties: false,
    },
  },
] as const;

type JsonRpcId = string | number | null;

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function text(value: unknown): { content: { type: "text"; text: string }[]; structuredContent?: unknown } {
  const json = JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text", text: json }],
    structuredContent: value,
  };
}

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function postSummary(post: BlogPostRecord) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    categories: post.categories,
    topic: post.topic,
    published: post.published,
    featured: post.featured,
    publishedAt: post.publishedAt,
    description: post.description,
    dek: post.dek,
    kicker: post.kicker,
    coverUrl: post.coverUrl,
    emdrAnchor: post.emdrAnchor,
    related: post.related,
    sectionCount: post.sections.length,
  };
}

function tokenAuthorized(request: Request): boolean {
  const expected = process.env.NURA_MCP_TOKEN?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_blog_categories": {
      const categories = await listBlogCategories();
      return text({
        categories,
        hint: "Pass these slugs in create_blog_post.categories.",
      });
    }

    case "list_blog_posts": {
      let posts = await listAllBlogPosts();
      const category = typeof args.category === "string" ? args.category : null;
      if (category) posts = posts.filter((p) => p.categories.includes(category));
      if (typeof args.published === "boolean") {
        posts = posts.filter((p) => p.published === args.published);
      }
      return text({ count: posts.length, posts: posts.map(postSummary) });
    }

    case "get_blog_post": {
      const slug = String(args.slug ?? "").trim();
      const post = await getBlogPostBySlugOrId(slug);
      if (!post) return toolError(`No post with slug "${slug}".`);
      return text({ ...postSummary(post), sections: post.sections });
    }

    case "create_blog_post": {
      const input = args as BlogPostInput;
      if (
        !Array.isArray(input.categories) ||
        input.categories.length === 0
      ) {
        return toolError(
          `categories is required. Choose from: ${BLOG_CATEGORY_SLUGS.join(", ")}.`
        );
      }
      const result = await upsertBlogPost({
        ...input,
        published: input.published === true,
      });
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "blog.post_created",
        detail: {
          source: "mcp",
          slug: result.post.slug,
          categories: result.post.categories,
          published: result.post.published,
        },
      });
      return text({
        ok: true,
        post: postSummary(result.post),
        url: `/blog/${result.post.slug}`,
        categoryPages: result.post.categories.map((c) => `/blog/category/${c}`),
      });
    }

    case "update_blog_post": {
      const slug = String(args.slug ?? "").trim();
      const newSlug = typeof args.newSlug === "string" ? args.newSlug.trim() : "";
      const existing = await getBlogPostBySlugOrId(slug);
      if (!existing) return toolError(`No post with slug "${slug}".`);
      // `slug` selected the post; `newSlug` is the rename. `id` would let the
      // caller address a different row, so it is stripped.
      const patch = { ...args } as BlogPostInput & { newSlug?: string };
      delete patch.id;
      delete patch.newSlug;
      delete patch.slug;
      if (newSlug) patch.slug = newSlug;
      const result = await upsertBlogPost({ ...patch, id: existing.id });
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "blog.post_updated",
        detail: {
          source: "mcp",
          slug: result.post.slug,
          previousSlug: existing.slug,
          categories: result.post.categories,
          published: result.post.published,
        },
      });
      return text({
        ok: true,
        post: postSummary(result.post),
        url: `/blog/${result.post.slug}`,
      });
    }

    case "delete_blog_post": {
      const slug = String(args.slug ?? "").trim();
      const removed = await deleteBlogPost(slug);
      if (!removed) return toolError(`No post with slug "${slug}".`);
      await writeAuditEvent({
        action: "blog.post_deleted",
        detail: { source: "mcp", slug },
      });
      return text({ ok: true, deleted: slug });
    }

    default:
      return toolError(`Unknown tool "${name}".`);
  }
}

export async function POST(request: Request) {
  if (!process.env.NURA_MCP_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error:
          "MCP is not configured. Set NURA_MCP_TOKEN in the environment, then reconnect the nura-blog MCP server.",
      },
      { status: 503 }
    );
  }
  if (!tokenAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
    });
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];

  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue;
    const message = raw as {
      jsonrpc?: string;
      id?: JsonRpcId;
      method?: string;
      params?: Record<string, unknown>;
    };
    const id = message.id ?? null;
    const method = message.method ?? "";

    if (method.startsWith("notifications/")) continue;

    switch (method) {
      case "initialize": {
        const requested = String(
          (message.params?.protocolVersion as string) ?? ""
        );
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_PROTOCOL_VERSIONS[0];
        responses.push(
          rpcResult(id, {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions:
              "Editorial blog tools for nurahelp.com. Always call list_blog_categories and pass the matching slugs as categories when you write a post.",
          })
        );
        break;
      }

      case "ping":
        responses.push(rpcResult(id, {}));
        break;

      case "tools/list":
        responses.push(rpcResult(id, { tools: TOOLS }));
        break;

      case "tools/call": {
        const name = String(message.params?.name ?? "");
        const args =
          (message.params?.arguments as Record<string, unknown> | undefined) ??
          {};
        try {
          const result = await callTool(name, args);
          responses.push(rpcResult(id, result));
        } catch (err) {
          responses.push(
            rpcResult(
              id,
              toolError(err instanceof Error ? err.message : "Tool failed")
            )
          );
        }
        break;
      }

      default:
        if (message.id !== undefined) {
          responses.push(rpcError(id, -32601, `Method not found: ${method}`));
        }
    }
  }

  if (responses.length === 0) {
    return new Response(null, { status: 202 });
  }
  return NextResponse.json(
    Array.isArray(payload) ? responses : responses[0]
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST for MCP JSON-RPC." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
