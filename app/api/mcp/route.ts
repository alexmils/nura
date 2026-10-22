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

import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit-log";
import {
  bearerFromRequest,
  getMcpAuthState,
  mcpRequestAuthorized,
  recordMcpTokenUse,
  type McpAuthState,
} from "@/lib/mcp-auth";
import { getPlatformSettings } from "@/lib/platform-settings";
import type { McpScope, PlatformMcpConfig } from "@/lib/mcp-settings";
import { getSeoPage, listSeoPages, updateSeoPage } from "@/lib/mcp-seo";
import {
  deleteBlogCategory,
  deleteBlogPost,
  getBlogPostBySlugOrId,
  listAllBlogPosts,
  listBlogCategories,
  updateBlogCategory,
  upsertBlogCategory,
  upsertBlogPost,
  type BlogPostInput,
  type BlogPostRecord,
} from "@/lib/blog-db";
import { CLUSTER_TOPICS } from "@/lib/content-cluster";
import { hasBlsAcronym } from "@/lib/blog-post-input";
import {
  isResourceKind,
  RESOURCE_KINDS,
  type ResourcePost,
} from "@/lib/resources";
import { listResourcesAdmin, upsertResource } from "@/lib/resources-db";

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
        description:
          "One paragraph. No em dash, no BLS acronym. Markdown image syntax ![alt](https://…) is allowed and renders inline.",
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
    items: { type: "string" },
    description:
      "Clinical categories this guide belongs to. Required on create. Pick slugs from list_blog_categories, or add a new one with create_blog_category.",
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
    description:
      "Featured image shown on the card and at the top of the guide. A site path (/marketing/landing/calm-water.jpg) or any https image URL. Omit to use a fallback image.",
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

const RESOURCE_FIELDS = {
  slug: {
    type: "string",
    description: "URL slug. Defaults to the title when omitted on create.",
  },
  kind: {
    type: "string",
    enum: [...RESOURCE_KINDS],
    description: "article, video, or safety.",
  },
  title: { type: "string" },
  summary: {
    type: "string",
    description: "One-line summary shown on the card (max 500 characters).",
  },
  body: {
    type: "string",
    description: "Markdown body for articles. Images are allowed.",
  },
  coverUrl: {
    type: "string",
    description: "https image URL or a small data URL.",
  },
  videoUrl: {
    type: "string",
    description: "YouTube, Vimeo, or an https .mp4/.webm link.",
  },
  readMinutes: { type: "number", description: "Shown as the card's read time." },
  featured: { type: "boolean" },
  enabled: {
    type: "boolean",
    description: "false hides it from /app/resources (default on create).",
  },
  sortOrder: { type: "number", description: "Lower comes first." },
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
        category: { type: "string" },
        published: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_blog_category",
    description:
      "Create or update a clinical blog category. Categories are rows, so a new one is usable immediately, no deploy. The category page exists as soon as the row does.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          description: "Display name, for example Dissociation.",
        },
        slug: { type: "string", description: "Defaults to the name." },
        description: {
          type: "string",
          description: "Hub and meta copy (≤400 characters).",
        },
        sortOrder: {
          type: "number",
          description: "Order on the blog; lower comes first (default 100).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_blog_category",
    description:
      "Rename or retitle a category. Tagged posts stay attached because the join uses the id; changing the slug changes the hub URL.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: "Current slug." },
        newSlug: { type: "string", description: "Rename the slug (optional)." },
        name: { type: "string" },
        description: { type: "string" },
        sortOrder: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "delete_blog_category",
    description:
      "Delete an empty category that was added at runtime. Built-in categories, and categories that still have posts, are refused.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string" } },
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
  {
    name: "list_seo_pages",
    description:
      "List the public pages that can carry their own search title and description.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_seo_page",
    description:
      "Read the search title, description and Open Graph override for one page. Empty fields mean the page falls back to its built-in copy.",
    inputSchema: {
      type: "object",
      required: ["page"],
      properties: {
        page: { type: "string", description: "Page id from list_seo_pages." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_seo_page",
    description:
      "Set the search title, description or Open Graph override for one page. Only the fields you pass change; an empty string clears a field. Saved immediately and the SEO cache is dropped.",
    inputSchema: {
      type: "object",
      required: ["page"],
      properties: {
        page: { type: "string", description: "Page id from list_seo_pages." },
        title: { type: "string", description: "Search title." },
        description: { type: "string", description: "Meta description." },
        ogTitle: { type: "string", description: "Title shown when shared." },
        ogImageUrl: {
          type: "string",
          description: "Absolute https image URL for link previews.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_resources",
    description:
      "List the in-app Resources library shown at /app/resources. Optionally filter by kind or by whether each item is enabled.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...RESOURCE_KINDS] },
        enabled: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_resource",
    description:
      "Read one in-app Resource by slug or id, including its markdown body.",
    inputSchema: {
      type: "object",
      required: ["resource"],
      properties: { resource: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "create_resource",
    description:
      "Create an in-app Resource. kind is article, video, or safety. Saves disabled unless enabled=true. Copy must not use an em dash or the acronym BLS.",
    inputSchema: {
      type: "object",
      required: ["title", "kind"],
      properties: RESOURCE_FIELDS,
      additionalProperties: false,
    },
  },
  {
    name: "update_resource",
    description:
      "Update an in-app Resource by slug or id. Only the fields you pass change; an empty coverUrl or videoUrl clears it. Set enabled=false to hide it without deleting.",
    inputSchema: {
      type: "object",
      required: ["resource"],
      properties: {
        ...RESOURCE_FIELDS,
        resource: {
          type: "string",
          description: "Current slug or id of the Resource.",
        },
      },
      additionalProperties: false,
    },
  },
] as const;

/** Which scope a tool needs. A tool missing here is not exposed. */
const TOOL_SCOPES: Record<string, McpScope> = {
  list_blog_categories: "blog:read",
  create_blog_category: "blog:write",
  update_blog_category: "blog:write",
  delete_blog_category: "blog:write",
  list_blog_posts: "blog:read",
  get_blog_post: "blog:read",
  create_blog_post: "blog:write",
  update_blog_post: "blog:write",
  delete_blog_post: "blog:write",
  list_seo_pages: "seo:read",
  get_seo_page: "seo:read",
  update_seo_page: "seo:write",
  list_resources: "resources:read",
  get_resource: "resources:read",
  create_resource: "resources:write",
  update_resource: "resources:write",
};

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

function resourceSummary(resource: ResourcePost) {
  return {
    id: resource.id,
    slug: resource.slug,
    kind: resource.kind,
    title: resource.title,
    summary: resource.summary,
    enabled: resource.enabled,
    featured: resource.featured,
    readMinutes: resource.readMinutes,
    hasBody: Boolean(resource.body),
    videoUrl: resource.videoUrl,
    coverUrl: resource.coverUrl,
    sortOrder: resource.sortOrder,
  };
}

function resourceArgs(args: Record<string, unknown>) {
  const str = (value: unknown) =>
    typeof value === "string" ? value : undefined;
  return {
    slug: str(args.slug),
    kind: isResourceKind(args.kind) ? args.kind : undefined,
    title: str(args.title),
    summary: str(args.summary),
    body: str(args.body),
    coverUrl: str(args.coverUrl),
    videoUrl: str(args.videoUrl),
    readMinutes: typeof args.readMinutes === "number" ? args.readMinutes : undefined,
    featured: typeof args.featured === "boolean" ? args.featured : undefined,
    enabled: typeof args.enabled === "boolean" ? args.enabled : undefined,
    sortOrder: typeof args.sortOrder === "number" ? args.sortOrder : undefined,
  };
}

/** The same brand gate the blog uses: no em dash, no internal acronym. */
function copyProblem(parts: (string | null | undefined)[]): string | null {
  const copy = parts.filter((part): part is string => Boolean(part)).join("\n");
  if (copy.includes("—")) {
    return "Copy must not use an em dash. Replace it with a comma, a period, or a colon.";
  }
  if (hasBlsAcronym(copy)) {
    return "Copy must not use the acronym BLS. Say self-guided set time or session set.";
  }
  return null;
}

async function authorized(
  request: Request
): Promise<{ ok: boolean; state: McpAuthState; config: PlatformMcpConfig }> {
  const settings = await getPlatformSettings();
  const state = await getMcpAuthState(settings.mcp);
  const ok = mcpRequestAuthorized(bearerFromRequest(request), state);
  return { ok, state, config: settings.mcp };
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
        hint: "Pass these slugs in create_blog_post.categories. Add a new one with create_blog_category.",
      });
    }

    case "create_blog_category": {
      const result = await upsertBlogCategory({
        name: typeof args.name === "string" ? args.name : "",
        slug: typeof args.slug === "string" ? args.slug : undefined,
        description:
          typeof args.description === "string" ? args.description : undefined,
        sortOrder:
          typeof args.sortOrder === "number" ? args.sortOrder : undefined,
      });
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "blog.category_created",
        detail: { source: "mcp", slug: result.category.slug },
      });
      return text(result.category);
    }

    case "update_blog_category": {
      const slug = String(args.slug ?? "").trim();
      if (!slug) return toolError("slug is required.");
      const result = await updateBlogCategory({
        slug,
        newSlug: typeof args.newSlug === "string" ? args.newSlug : undefined,
        name: typeof args.name === "string" ? args.name : undefined,
        description:
          typeof args.description === "string" ? args.description : undefined,
        sortOrder:
          typeof args.sortOrder === "number" ? args.sortOrder : undefined,
      });
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "blog.category_updated",
        detail: { source: "mcp", slug: result.category.slug },
      });
      return text(result.category);
    }

    case "delete_blog_category": {
      const slug = String(args.slug ?? "").trim();
      if (!slug) return toolError("slug is required.");
      const result = await deleteBlogCategory(slug);
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "blog.category_deleted",
        detail: { source: "mcp", slug: result.slug },
      });
      return text({ ok: true, deleted: result.slug });
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
          "categories is required. Call list_blog_categories for the current slugs, or create a new one with create_blog_category."
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

    case "list_seo_pages": {
      const pages = await listSeoPages();
      return text({ count: pages.length, pages });
    }

    case "get_seo_page": {
      const page = String(args.page ?? "").trim();
      if (!page) return toolError("page is required.");
      try {
        return text(await getSeoPage(page));
      } catch (err) {
        return toolError(err instanceof Error ? err.message : "Could not read page.");
      }
    }

    case "update_seo_page": {
      const page = String(args.page ?? "").trim();
      if (!page) return toolError("page is required.");
      const patch = {
        ...(typeof args.title === "string" ? { title: args.title } : {}),
        ...(typeof args.description === "string"
          ? { description: args.description }
          : {}),
        ...(typeof args.ogTitle === "string" ? { ogTitle: args.ogTitle } : {}),
        ...(typeof args.ogImageUrl === "string"
          ? { ogImageUrl: args.ogImageUrl }
          : {}),
      };
      try {
        const next = await updateSeoPage(page, patch);
        await writeAuditEvent({
          action: "settings.seo_updated",
          detail: { source: "mcp", page, fields: Object.keys(patch) },
        });
        return text(next);
      } catch (err) {
        return toolError(
          err instanceof Error ? err.message : "Could not update page."
        );
      }
    }

    case "list_resources": {
      let items = await listResourcesAdmin();
      if (isResourceKind(args.kind)) {
        items = items.filter((item) => item.kind === args.kind);
      }
      if (typeof args.enabled === "boolean") {
        items = items.filter((item) => item.enabled === args.enabled);
      }
      return text({ count: items.length, resources: items.map(resourceSummary) });
    }

    case "get_resource": {
      const key = String(args.resource ?? "").trim();
      const found = (await listResourcesAdmin()).find(
        (item) => item.id === key || item.slug === key
      );
      if (!found) return toolError(`No resource with slug or id "${key}".`);
      return text(found);
    }

    case "create_resource": {
      const input = resourceArgs(args);
      if (!input.title?.trim()) return toolError("title is required.");
      if (!input.kind) {
        return toolError(`kind is required: ${RESOURCE_KINDS.join(", ")}.`);
      }
      const problem = copyProblem([input.title, input.summary, input.body]);
      if (problem) return toolError(problem);

      const result = await upsertResource({
        slug: input.slug ?? "",
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        body: input.body,
        coverUrl: input.coverUrl,
        videoUrl: input.videoUrl,
        readMinutes: input.readMinutes,
        featured: input.featured,
        // Editorial writes start hidden until someone reviews them on the page.
        enabled: input.enabled === true,
        sortOrder: input.sortOrder,
      });
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "resource.created",
        detail: { source: "mcp", slug: result.post.slug },
      });
      return text(resourceSummary(result.post));
    }

    case "update_resource": {
      const key = String(args.resource ?? "").trim();
      const existing = (await listResourcesAdmin()).find(
        (item) => item.id === key || item.slug === key
      );
      if (!existing) return toolError(`No resource with slug or id "${key}".`);

      const input = resourceArgs(args);
      const title = input.title ?? existing.title;
      const summary = input.summary ?? existing.summary;
      const problem = copyProblem([title, summary, input.body]);
      if (problem) return toolError(problem);

      const result = await upsertResource({
        id: existing.id,
        slug: input.slug ?? existing.slug,
        kind: input.kind ?? existing.kind,
        title,
        summary,
        body: input.body,
        coverUrl: input.coverUrl,
        videoUrl: input.videoUrl,
        readMinutes: input.readMinutes,
        featured: input.featured,
        enabled: input.enabled,
        sortOrder: input.sortOrder,
      });
      if (!result.ok) return toolError(result.error);
      await writeAuditEvent({
        action: "resource.updated",
        detail: {
          source: "mcp",
          slug: result.post.slug,
          fields: Object.keys(args).filter((keyName) => keyName !== "resource"),
        },
      });
      return text(resourceSummary(result.post));
    }

    default:
      return toolError(`Unknown tool "${name}".`);
  }
}

export async function POST(request: Request) {
  const auth = await authorized(request);
  if (auth.state.source === "none") {
    return NextResponse.json(
      {
        error:
          "MCP has no token. Generate one in Admin → MCP (or set NURA_MCP_TOKEN), then reconnect the nura-blog MCP server.",
      },
      { status: 503 }
    );
  }
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Stamped at most hourly; failure here must not fail the call.
  void recordMcpTokenUse(auth.config);

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
              "Editorial and page-SEO tools for nurahelp.com. Only the tools granted to this token are listed. For a guide, always call list_blog_categories and pass the matching slugs as categories.",
          })
        );
        break;
      }

      case "ping":
        responses.push(rpcResult(id, {}));
        break;

      case "tools/list": {
        // Only advertise what this token can actually call, so an editorial
        // agent never plans around SEO tools it cannot use.
        const tools = TOOLS.filter((tool) => {
          const scope = TOOL_SCOPES[tool.name];
          return scope ? auth.state.scopes.includes(scope) : false;
        });
        responses.push(rpcResult(id, { tools }));
        break;
      }

      case "tools/call": {
        const name = String(message.params?.name ?? "");
        const required = TOOL_SCOPES[name];
        if (required && !auth.state.scopes.includes(required)) {
          responses.push(
            rpcResult(
              id,
              toolError(
                `This token lacks the ${required} scope. Generate a token with that scope in Admin → MCP.`
              )
            )
          );
          break;
        }
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
