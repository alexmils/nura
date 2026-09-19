/**
 * Public blog store — Postgres source of truth for `/blog`.
 *
 * The built-in corpus in `lib/content-cluster.ts` seeds the tables on first
 * run and stays as a read fallback when Postgres is unreachable, so the
 * public blog never 500s on a cold or missing database.
 *
 * Writes are used by the admin API (`/api/admin/blog`) and the MCP endpoint
 * (`/api/mcp`), where the agent picks the category it writes in.
 */

import { revalidatePath } from "next/cache";
import {
  BLOG_CATEGORIES,
  normalizeBlogCategorySlug,
  sanitizeBlogCategorySlugs,
} from "@/lib/blog-categories";
import {
  CLUSTER_ARTICLES,
  CLUSTER_TOPICS,
  type ClusterArticle,
  type ClusterSection,
  type ClusterTopic,
} from "@/lib/content-cluster";
import { ensureSchemaReady, getPool } from "@/lib/db";

export const BLOG_TITLE_MAX = 200;
export const BLOG_DESCRIPTION_MAX = 400;
export const BLOG_DEK_MAX = 400;
export const BLOG_ANCHOR_MAX = 300;
export const BLOG_SECTIONS_MAX = 40;
export const BLOG_PARAGRAPHS_MAX = 40;

let blogSchemaDone = false;

/** One warning is enough — the fallback keeps serving the seeds. */
let blogFallbackWarned = false;

export type BlogCategoryRecord = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  postCount: number;
};

export type BlogPostRecord = ClusterArticle & {
  id: string;
  published: boolean;
  updatedAt: string;
};

function warnFallback(err: unknown): void {
  if (blogFallbackWarned) return;
  blogFallbackWarned = true;
  console.warn(
    "[blog] Postgres unavailable or not migrated, serving built-in guides:",
    err instanceof Error ? err.message : err
  );
}

/* ------------------------------------------------------------------ */
/* Schema + seed                                                       */
/* ------------------------------------------------------------------ */

export async function ensureBlogSchema(): Promise<void> {
  await ensureSchemaReady();
  if (blogSchemaDone) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_categories (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      kicker TEXT NOT NULL DEFAULT '',
      dek TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT 'understand',
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      cover_url TEXT NOT NULL DEFAULT '',
      emdr_anchor TEXT NOT NULL DEFAULT '',
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sections JSONB NOT NULL DEFAULT '[]'::jsonb,
      related JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_blog_posts_published
      ON blog_posts(published, published_at DESC);
    CREATE TABLE IF NOT EXISTS blog_post_categories (
      post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category
      ON blog_post_categories(category_id);
  `);

  // Built-in categories first (editorial set from the home topics grid).
  let order = 0;
  for (const category of BLOG_CATEGORIES) {
    await db.query(
      `INSERT INTO blog_categories (id, slug, name, description, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [
        `cat_${category.slug}`,
        category.slug,
        category.name,
        category.description,
        category.sortOrder || order * 10,
      ]
    );
    order += 1;
  }

  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM blog_posts`
  );
  if (Number(rows[0]?.count ?? 0) === 0) {
    for (const article of CLUSTER_ARTICLES) {
      const postId = await insertPostRow(db, {
        id: crypto.randomUUID(),
        slug: article.slug,
        title: article.title,
        description: article.description,
        kicker: article.kicker,
        dek: article.dek,
        topic: article.topic,
        featured: article.featured,
        published: true,
        coverUrl: article.coverUrl,
        emdrAnchor: article.emdrAnchor,
        publishedAt: article.publishedAt,
        sections: article.sections,
        related: article.related,
      });
      await replacePostCategories(db, postId, article.categories);
    }
  }

  blogSchemaDone = true;
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

function asSections(value: unknown): ClusterSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
    .map((s) => ({
      heading: typeof s.heading === "string" ? s.heading : "",
      paragraphs: Array.isArray(s.paragraphs)
        ? s.paragraphs.filter((p): p is string => typeof p === "string")
        : [],
    }))
    .filter((s) => s.heading.length > 0);
}

function asRelated(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((slug): slug is string => typeof slug === "string");
}

function rowToRecord(r: Record<string, unknown>): BlogPostRecord {
  const topic = CLUSTER_TOPICS.includes(r.topic as ClusterTopic)
    ? (r.topic as ClusterTopic)
    : "understand";
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? "",
    kicker: (r.kicker as string) ?? "",
    dek: (r.dek as string) ?? "",
    publishedAt: new Date(r.published_at as string).toISOString(),
    topic,
    categories: sanitizeBlogCategorySlugs(
      Array.isArray(r.category_slugs) ? r.category_slugs : []
    ),
    featured: Boolean(r.featured),
    coverUrl: (r.cover_url as string) ?? "",
    emdrAnchor: (r.emdr_anchor as string) ?? "",
    related: asRelated(r.related),
    sections: asSections(r.sections),
    published: Boolean(r.published),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

const POST_SELECT = `
  SELECT p.*,
         COALESCE(array_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL), '{}') AS category_slugs
  FROM blog_posts p
  LEFT JOIN blog_post_categories pc ON pc.post_id = p.id
  LEFT JOIN blog_categories c ON c.id = pc.category_id
`;

/* ------------------------------------------------------------------ */
/* Public reads (with built-in fallback)                               */
/* ------------------------------------------------------------------ */

function seedRecords(): BlogPostRecord[] {
  return [...CLUSTER_ARTICLES]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .map((article) => ({
      ...article,
      id: `seed_${article.slug}`,
      published: true,
      updatedAt: article.publishedAt,
    }));
}

function seedCategories(): BlogCategoryRecord[] {
  return BLOG_CATEGORIES.map((category) => ({
    slug: category.slug,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    postCount: CLUSTER_ARTICLES.filter((a) =>
      a.categories.includes(category.slug)
    ).length,
  }));
}

export async function listBlogCategories(): Promise<BlogCategoryRecord[]> {
  try {
    await ensureBlogSchema();
    const { rows } = await getPool().query<Record<string, unknown>>(
      `SELECT c.slug, c.name, c.description, c.sort_order,
              COUNT(p.id)::int AS post_count
       FROM blog_categories c
       LEFT JOIN blog_post_categories pc ON pc.category_id = c.id
       LEFT JOIN blog_posts p ON p.id = pc.post_id AND p.published = TRUE
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    return rows.map((r) => ({
      slug: r.slug as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      sortOrder: Number(r.sort_order ?? 0),
      postCount: Number(r.post_count ?? 0),
    }));
  } catch (err) {
    warnFallback(err);
    return seedCategories();
  }
}

export async function listPublishedBlogPosts(opts?: {
  category?: string;
  featuredOnly?: boolean;
  limit?: number;
}): Promise<ClusterArticle[]> {
  const category = opts?.category
    ? normalizeBlogCategorySlug(opts.category)
    : undefined;
  try {
    await ensureBlogSchema();
    const params: unknown[] = [];
    const where = ["p.published = TRUE"];
    if (category) {
      // Category filter must not multiply rows from the LEFT JOIN above.
      where.push(`EXISTS (
        SELECT 1 FROM blog_post_categories fpc
        JOIN blog_categories fc ON fc.id = fpc.category_id
        WHERE fpc.post_id = p.id AND fc.slug = $${params.length + 1}
      )`);
      params.push(category);
    }
    if (opts?.featuredOnly) where.push("p.featured = TRUE");
    let sql = `${POST_SELECT}
      WHERE ${where.join(" AND ")}
      GROUP BY p.id
      ORDER BY p.published_at DESC`;
    if (opts?.limit && opts.limit > 0) {
      params.push(opts.limit);
      sql += ` LIMIT $${params.length}`;
    }
    const { rows } = await getPool().query<Record<string, unknown>>(sql, params);
    return rows.map(rowToRecord);
  } catch (err) {
    warnFallback(err);
    let posts = seedRecords();
    if (category) posts = posts.filter((p) => p.categories.includes(category));
    if (opts?.featuredOnly) posts = posts.filter((p) => p.featured);
    if (opts?.limit && opts.limit > 0) posts = posts.slice(0, opts.limit);
    return posts;
  }
}

export async function getPublishedBlogPost(
  slug: string
): Promise<ClusterArticle | null> {
  const clean = normalizeBlogCategorySlug(slug);
  if (!clean) return null;
  try {
    await ensureBlogSchema();
    const { rows } = await getPool().query<Record<string, unknown>>(
      `${POST_SELECT}
       WHERE p.slug = $1 AND p.published = TRUE
       GROUP BY p.id
       LIMIT 1`,
      [clean]
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  } catch (err) {
    warnFallback(err);
    return seedRecords().find((p) => p.slug === clean) ?? null;
  }
}

/** Related guides for one article, DB-first so DB-only posts resolve too. */
export async function listPublishedBlogPostsBySlugs(
  slugs: string[]
): Promise<ClusterArticle[]> {
  if (slugs.length === 0) return [];
  try {
    await ensureBlogSchema();
    const { rows } = await getPool().query<Record<string, unknown>>(
      `${POST_SELECT}
       WHERE p.published = TRUE AND p.slug = ANY($1::text[])
       GROUP BY p.id
       ORDER BY p.published_at DESC`,
      [slugs]
    );
    const bySlug = new Map(rows.map((r) => [r.slug as string, rowToRecord(r)]));
    return slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ClusterArticle[];
  } catch (err) {
    warnFallback(err);
    const seeds = seedRecords();
    return slugs
      .map((slug) => seeds.find((p) => p.slug === slug))
      .filter(Boolean) as ClusterArticle[];
  }
}

/* ------------------------------------------------------------------ */
/* Admin reads + writes                                                */
/* ------------------------------------------------------------------ */

export async function listAllBlogPosts(): Promise<BlogPostRecord[]> {
  await ensureBlogSchema();
  const { rows } = await getPool().query<Record<string, unknown>>(
    `${POST_SELECT} GROUP BY p.id ORDER BY p.published_at DESC`
  );
  return rows.map(rowToRecord);
}

export async function getBlogPostBySlugOrId(
  value: string
): Promise<BlogPostRecord | null> {
  await ensureBlogSchema();
  const { rows } = await getPool().query<Record<string, unknown>>(
    `${POST_SELECT}
     WHERE p.slug = $1 OR p.id = $1
     GROUP BY p.id
     LIMIT 1`,
    [value.trim()]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

async function insertPostRow(
  db: ReturnType<typeof getPool>,
  input: {
    id: string;
    slug: string;
    title: string;
    description: string;
    kicker: string;
    dek: string;
    topic: ClusterTopic;
    featured: boolean;
    published: boolean;
    coverUrl: string;
    emdrAnchor: string;
    publishedAt: string;
    sections: ClusterSection[];
    related: string[];
  }
): Promise<string> {
  await db.query(
    `INSERT INTO blog_posts (
       id, slug, title, description, kicker, dek, topic, featured, published,
       cover_url, emdr_anchor, published_at, sections, related
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)`,
    [
      input.id,
      input.slug,
      input.title,
      input.description,
      input.kicker,
      input.dek,
      input.topic,
      input.featured,
      input.published,
      input.coverUrl,
      input.emdrAnchor,
      input.publishedAt,
      JSON.stringify(input.sections),
      JSON.stringify(input.related),
    ]
  );
  return input.id;
}

async function replacePostCategories(
  db: ReturnType<typeof getPool>,
  postId: string,
  categorySlugs: string[]
): Promise<void> {
  await db.query(`DELETE FROM blog_post_categories WHERE post_id = $1`, [postId]);
  for (const slug of sanitizeBlogCategorySlugs(categorySlugs)) {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM blog_categories WHERE slug = $1`,
      [slug]
    );
    if (!rows[0]) continue;
    await db.query(
      `INSERT INTO blog_post_categories (post_id, category_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [postId, rows[0].id]
    );
  }
}

export type BlogPostInput = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  kicker?: string;
  dek?: string;
  topic?: string;
  categories?: unknown;
  featured?: boolean;
  published?: boolean;
  coverUrl?: string | null;
  emdrAnchor?: string;
  publishedAt?: string;
  sections?: unknown;
  related?: unknown;
};

export type BlogWriteResult =
  | { ok: true; post: BlogPostRecord }
  | { ok: false; error: string };

/** Em dash reads as AI copy; new posts get a separator instead. */
function stripEmDash(value: string, separator: string): string {
  return value.replace(/\s*—\s*/g, separator).replace(/\s+/g, " ").trim();
}

function cleanCopy(value: string, mode: "title" | "body"): string {
  return stripEmDash(value, mode === "title" ? ": " : ", ");
}

function parseSections(value: unknown): ClusterSection[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > BLOG_SECTIONS_MAX) return null;
  const out: ClusterSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const section = raw as { heading?: unknown; paragraphs?: unknown };
    const heading = typeof section.heading === "string" ? cleanCopy(section.heading, "body") : "";
    if (!heading) return null;
    const paragraphs = Array.isArray(section.paragraphs)
      ? section.paragraphs
          .filter((p): p is string => typeof p === "string")
          .map((p) => cleanCopy(p, "body"))
          .filter(Boolean)
      : [];
    if (paragraphs.length === 0) return null;
    if (paragraphs.length > BLOG_PARAGRAPHS_MAX) return null;
    out.push({ heading, paragraphs });
  }
  return out;
}

function isValidCover(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Create or update one post. On create, `categories` must name at least one
 * known clinical category, so every published post lands on a category page.
 */
export async function upsertBlogPost(
  input: BlogPostInput
): Promise<BlogWriteResult> {
  try {
    await ensureBlogSchema();
  } catch (err) {
    warnFallback(err);
    return { ok: false, error: "Blog storage is unavailable" };
  }

  const existing = input.id
    ? await getBlogPostBySlugOrId(input.id)
    : input.slug
      ? await getBlogPostBySlugOrId(normalizeBlogCategorySlug(input.slug))
      : null;

  if (input.id && !existing) {
    return { ok: false, error: "Post not found" };
  }

  const titleRaw = (input.title ?? existing?.title ?? "").trim();
  if (!titleRaw) return { ok: false, error: "Title is required" };
  const title = cleanCopy(titleRaw, "title");
  if (title.length > BLOG_TITLE_MAX) {
    return { ok: false, error: `Title must be ≤ ${BLOG_TITLE_MAX} characters` };
  }

  const slug = normalizeBlogCategorySlug(
    input.slug ?? existing?.slug ?? title
  );
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
    return { ok: false, error: "Invalid slug" };
  }

  const description = cleanCopy(
    (input.description ?? existing?.description ?? "").trim(),
    "body"
  );
  if (!description) return { ok: false, error: "Description is required" };
  if (description.length > BLOG_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description must be ≤ ${BLOG_DESCRIPTION_MAX} characters`,
    };
  }

  const dek = cleanCopy((input.dek ?? existing?.dek ?? "").trim(), "body");
  if (!dek) return { ok: false, error: "Dek is required" };
  if (dek.length > BLOG_DEK_MAX) {
    return { ok: false, error: `Dek must be ≤ ${BLOG_DEK_MAX} characters` };
  }

  const topicRaw = input.topic ?? existing?.topic ?? "understand";
  if (!CLUSTER_TOPICS.includes(topicRaw as ClusterTopic)) {
    return {
      ok: false,
      error: `Topic must be one of: ${CLUSTER_TOPICS.join(", ")}`,
    };
  }
  const topic = topicRaw as ClusterTopic;

  const categories =
    input.categories === undefined
      ? existing?.categories ?? []
      : sanitizeBlogCategorySlugs(input.categories);
  if (categories.length === 0) {
    return {
      ok: false,
      error:
        "Choose at least one category (trauma, ptsd, anxiety, panic, grief, phobias, childhood-memories, self-worth)",
    };
  }

  const sections =
    input.sections === undefined
      ? existing?.sections ?? []
      : parseSections(input.sections);
  if (!sections || sections.length === 0) {
    return {
      ok: false,
      error: "Sections are required (at least one heading with paragraphs)",
    };
  }

  const anchor = cleanCopy(
    (input.emdrAnchor ?? existing?.emdrAnchor ?? "").trim(),
    "body"
  );
  if (anchor.length > BLOG_ANCHOR_MAX) {
    return { ok: false, error: `Anchor must be ≤ ${BLOG_ANCHOR_MAX} characters` };
  }

  const coverUrlRaw =
    input.coverUrl === undefined
      ? existing?.coverUrl ?? ""
      : (input.coverUrl ?? "").trim();
  if (!isValidCover(coverUrlRaw)) {
    return { ok: false, error: "Cover must be a site path or https URL" };
  }

  const related =
    input.related === undefined
      ? existing?.related ?? []
      : Array.isArray(input.related)
        ? input.related
            .filter((s): s is string => typeof s === "string")
            .map((s) => normalizeBlogCategorySlug(s))
            .filter(Boolean)
        : null;
  if (!related) return { ok: false, error: "Related must be an array of slugs" };

  const publishedAtRaw = input.publishedAt ?? existing?.publishedAt;
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    return { ok: false, error: "Invalid publishedAt" };
  }

  const published =
    input.published === undefined
      ? existing?.published ?? false
      : input.published === true;
  const featured =
    input.featured === undefined
      ? (existing?.featured ?? false) && published
      : input.featured === true && published;

  const id = existing?.id ?? input.id?.trim() ?? crypto.randomUUID();
  const db = getPool();

  const payload = {
    id,
    slug,
    title,
    description,
    kicker: cleanCopy((input.kicker ?? existing?.kicker ?? "").trim(), "body"),
    dek,
    topic,
    featured,
    published,
    coverUrl: coverUrlRaw,
    emdrAnchor: anchor,
    publishedAt: publishedAt.toISOString(),
    sections,
    related,
  };

  try {
    if (existing) {
      await db.query(
        `UPDATE blog_posts SET
           slug = $2, title = $3, description = $4, kicker = $5, dek = $6,
           topic = $7, featured = $8, published = $9, cover_url = $10,
           emdr_anchor = $11, published_at = $12, sections = $13::jsonb, related = $14::jsonb,
           updated_at = NOW()
         WHERE id = $1`,
        [
          id,
          payload.slug,
          payload.title,
          payload.description,
          payload.kicker,
          payload.dek,
          payload.topic,
          payload.featured,
          payload.published,
          payload.coverUrl,
          payload.emdrAnchor,
          payload.publishedAt,
          JSON.stringify(payload.sections),
          JSON.stringify(payload.related),
        ]
      );
    } else {
      await insertPostRow(db, payload);
    }
    await replacePostCategories(db, id, categories);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("blog_posts_slug_key") || msg.includes("unique")) {
      return { ok: false, error: "Slug already in use" };
    }
    throw err;
  }

  const post = await getBlogPostBySlugOrId(id);
  if (!post) return { ok: false, error: "Post could not be saved" };
  revalidateBlogPost(post.slug, post.categories);
  return { ok: true, post };
}

export async function deleteBlogPost(value: string): Promise<boolean> {
  await ensureBlogSchema();
  const post = await getBlogPostBySlugOrId(value);
  if (!post) return false;
  await getPool().query(`DELETE FROM blog_posts WHERE id = $1`, [post.id]);
  revalidateBlogPost(post.slug, post.categories);
  return true;
}

export type BlogCategoryInput = {
  slug?: string;
  name?: string;
  description?: string;
  sortOrder?: number;
};

export async function upsertBlogCategory(
  input: BlogCategoryInput
): Promise<{ ok: true; category: BlogCategoryRecord } | { ok: false; error: string }> {
  try {
    await ensureBlogSchema();
  } catch (err) {
    warnFallback(err);
    return { ok: false, error: "Blog storage is unavailable" };
  }
  const slug = normalizeBlogCategorySlug(input.slug ?? input.name ?? "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
    return { ok: false, error: "Invalid category slug" };
  }
  const name = (input.name ?? slug).trim();
  if (!name) return { ok: false, error: "Category name is required" };
  const description = cleanCopy((input.description ?? "").trim(), "body");
  const sortOrder = Number.isFinite(input.sortOrder)
    ? Math.max(0, Math.round(Number(input.sortOrder)))
    : 999;

  await getPool().query(
    `INSERT INTO blog_categories (id, slug, name, description, sort_order)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()`,
    [`cat_${slug}`, slug, name, description, sortOrder]
  );
  const all = await listBlogCategories();
  const category = all.find((c) => c.slug === slug);
  if (!category) return { ok: false, error: "Category could not be saved" };
  revalidatePath("/blog");
  return { ok: true, category };
}

/** Refresh every cached surface a blog post can appear on. */
function revalidateBlogPost(slug: string, categorySlugs: string[]): void {
  const paths = [
    "/",
    "/blog",
    `/blog/${slug}`,
    "/blog/rss.xml",
    "/feed.xml",
    "/sitemap.xml",
    "/llms.txt",
    ...categorySlugs.map((c) => `/blog/category/${c}`),
  ];
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Called outside a request scope (scripts/tests) — nothing to refresh.
    }
  }
}
