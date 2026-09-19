/**
 * Public blog store — Postgres source of truth for `/blog`.
 *
 * The built-in corpus in `lib/content-cluster.ts` seeds the tables and stays as
 * a read fallback when Postgres is unreachable, so the public blog never 500s
 * on a cold or missing database.
 *
 * Writes come from the admin API (`/api/admin/blog`) and the MCP endpoint
 * (`/api/mcp`), where the agent picks the category it writes in.
 */

import { revalidatePath } from "next/cache";
import {
  BLOG_CATEGORIES,
  normalizeBlogCategorySlug,
  sanitizeBlogCategorySlugs,
} from "@/lib/blog-categories";
import {
  BLOG_ANCHOR_MAX,
  BLOG_BODY_MAX_CHARS,
  BLOG_DEK_MAX,
  BLOG_DESCRIPTION_MAX,
  BLOG_KICKER_MAX,
  BLOG_TITLE_MAX,
  blogBodyLength,
  cleanCopy,
  defaultBlogCover,
  findBlsAcronym,
  isValidCoverUrl,
  parseSections,
  type BlogSectionInput,
} from "@/lib/blog-post-input";
import {
  CLUSTER_ARTICLES,
  CLUSTER_TOPICS,
  type ClusterArticle,
  type ClusterSection,
  type ClusterTopic,
} from "@/lib/content-cluster";
import { ensureSchemaReady, getPool } from "@/lib/db";

let blogSchemaDone = false;
let blogSchemaInflight: Promise<void> | null = null;

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

/**
 * Fallback reads must never hide a broken database. Every failure is logged
 * with its cause; the fallback keeps the public site up in the meantime.
 */
function warnFallback(where: string, err: unknown): void {
  console.warn(
    `[blog] ${where} failed, serving built-in guides:`,
    err instanceof Error ? err.message : err
  );
}

/* ------------------------------------------------------------------ */
/* Schema + seed                                                       */
/* ------------------------------------------------------------------ */

export async function ensureBlogSchema(): Promise<void> {
  if (blogSchemaDone) return;
  if (!blogSchemaInflight) {
    // Same inflight pattern as lib/db.ts: concurrent cold requests on a fresh
    // deploy must not race each other into duplicate-key failures.
    blogSchemaInflight = runBlogSchema()
      .then(() => {
        blogSchemaDone = true;
      })
      .catch((err) => {
        // Reset so the next request retries instead of caching the failure.
        blogSchemaInflight = null;
        throw err;
      });
  }
  return blogSchemaInflight;
}

async function runBlogSchema(): Promise<void> {
  await ensureSchemaReady();
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
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (post_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category
      ON blog_post_categories(category_id);
    ALTER TABLE blog_post_categories
      ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
  `);

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
        category.sortOrder,
      ]
    );
  }

  // Per-row and idempotent: a crashed or concurrent seed repairs itself on the
  // next request instead of freezing a truncated corpus forever.
  for (const article of CLUSTER_ARTICLES) {
    const postId = await insertSeedPost(db, article);
    const id =
      postId ?? (await findPostIdBySlug(db, article.slug));
    if (!id) continue;
    await ensurePostCategories(db, id, article.categories);
  }

  await backfillSeedCategoryOrder(db);
}

async function findPostIdBySlug(
  db: ReturnType<typeof getPool>,
  slug: string
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM blog_posts WHERE slug = $1`,
    [slug]
  );
  return rows[0]?.id ?? null;
}

/** Insert a built-in guide, or return null when another worker won the race. */
async function insertSeedPost(
  db: ReturnType<typeof getPool>,
  article: ClusterArticle
): Promise<string | null> {
  const id = crypto.randomUUID();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO blog_posts (
       id, slug, title, description, kicker, dek, topic, featured, published,
       cover_url, emdr_anchor, published_at, sections, related
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10,$11,$12::jsonb,$13::jsonb)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      id,
      article.slug,
      article.title,
      article.description,
      article.kicker,
      article.dek,
      article.topic,
      article.featured,
      article.coverUrl,
      article.emdrAnchor,
      article.publishedAt,
      JSON.stringify(article.sections),
      JSON.stringify(article.related),
    ]
  );
  return rows[0]?.id ?? null;
}

/** Add missing seed links without touching an editor's category changes. */
async function ensurePostCategories(
  db: ReturnType<typeof getPool>,
  postId: string,
  categorySlugs: string[]
): Promise<void> {
  const slugs = sanitizeBlogCategorySlugs(categorySlugs);
  for (let i = 0; i < slugs.length; i++) {
    await db.query(
      `INSERT INTO blog_post_categories (post_id, category_id, sort_order)
       SELECT $1, c.id, $3
       FROM blog_categories c
       WHERE c.slug = $2
       ON CONFLICT (post_id, category_id) DO NOTHING`,
      [postId, slugs[i], i]
    );
  }
}

/**
 * One-time repair: posts seeded before category order was stored got
 * `sort_order = 0` and rendered in canonical instead of editorial order.
 */
async function backfillSeedCategoryOrder(
  db: ReturnType<typeof getPool>
): Promise<void> {
  const { rows: applied } = await db.query<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = 'blog_category_order_v1'`
  );
  if (applied.length) return;

  for (const article of CLUSTER_ARTICLES) {
    if (article.categories.length < 2) continue;
    const { rows } = await db.query<{ id: string; slugs: string[] }>(
      `SELECT p.id,
              COALESCE(array_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL), '{}') AS slugs
       FROM blog_posts p
       LEFT JOIN blog_post_categories pc ON pc.post_id = p.id
       LEFT JOIN blog_categories c ON c.id = pc.category_id
       WHERE p.slug = $1
       GROUP BY p.id`,
      [article.slug]
    );
    const row = rows[0];
    if (!row) continue;
    const stored = [...row.slugs].sort();
    const seed = [...article.categories].sort();
    const sameSet =
      stored.length === seed.length && stored.every((s, i) => s === seed[i]);
    // Only rewrite when the editor has not changed which categories apply.
    if (sameSet) {
      await replacePostCategories(db, row.id, article.categories);
    }
  }

  await db.query(
    `INSERT INTO schema_migrations (id) VALUES ('blog_category_order_v1')
     ON CONFLICT DO NOTHING`
  );
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
  const slug = r.slug as string;
  return {
    id: r.id as string,
    slug,
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
    // Never hand an empty src to next/image.
    coverUrl: (r.cover_url as string)?.trim() || defaultBlogCover(slug),
    emdrAnchor: (r.emdr_anchor as string) ?? "",
    related: asRelated(r.related),
    sections: asSections(r.sections),
    published: Boolean(r.published),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

const CATEGORY_AGG = `
  COALESCE(
    array_agg(c.slug ORDER BY pc.sort_order ASC, c.sort_order ASC)
      FILTER (WHERE c.slug IS NOT NULL),
    '{}'
  ) AS category_slugs`;

const POST_FROM = `
  FROM blog_posts p
  LEFT JOIN blog_post_categories pc ON pc.post_id = p.id
  LEFT JOIN blog_categories c ON c.id = pc.category_id`;

const POST_SELECT_FULL = `SELECT p.*, ${CATEGORY_AGG} ${POST_FROM}`;

/** Card/feed shape: skips the `sections` JSONB, which lists never render. */
const POST_SELECT_CARD = `SELECT
  p.id, p.slug, p.title, p.description, p.kicker, p.dek, p.topic,
  p.featured, p.published, p.cover_url, p.emdr_anchor, p.published_at,
  p.updated_at, p.related, '[]'::jsonb AS sections, ${CATEGORY_AGG} ${POST_FROM}`;

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
    warnFallback("listBlogCategories", err);
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
      // Filter via EXISTS so it cannot multiply rows from the category join.
      where.push(`EXISTS (
        SELECT 1 FROM blog_post_categories fpc
        JOIN blog_categories fc ON fc.id = fpc.category_id
        WHERE fpc.post_id = p.id AND fc.slug = $${params.length + 1}
      )`);
      params.push(category);
    }
    if (opts?.featuredOnly) where.push("p.featured = TRUE");
    let sql = `${POST_SELECT_CARD}
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
    warnFallback("listPublishedBlogPosts", err);
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
      `${POST_SELECT_FULL}
       WHERE p.slug = $1 AND p.published = TRUE
       GROUP BY p.id
       LIMIT 1`,
      [clean]
    );
    // No seed fallback here on purpose: the seed is idempotent, so a missing
    // row means an editor deleted it and it must stay deleted.
    return rows[0] ? rowToRecord(rows[0]) : null;
  } catch (err) {
    warnFallback("getPublishedBlogPost", err);
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
      `${POST_SELECT_CARD}
       WHERE p.published = TRUE AND p.slug = ANY($1::text[])
       GROUP BY p.id
       ORDER BY p.published_at DESC`,
      [slugs]
    );
    const bySlug = new Map(rows.map((r) => [r.slug as string, rowToRecord(r)]));
    return slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ClusterArticle[];
  } catch (err) {
    warnFallback("listPublishedBlogPostsBySlugs", err);
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
    `${POST_SELECT_FULL} GROUP BY p.id ORDER BY p.published_at DESC`
  );
  return rows.map(rowToRecord);
}

export async function getBlogPostBySlugOrId(
  value: string
): Promise<BlogPostRecord | null> {
  await ensureBlogSchema();
  const { rows } = await getPool().query<Record<string, unknown>>(
    `${POST_SELECT_FULL}
     WHERE p.slug = $1 OR p.id = $1
     GROUP BY p.id
     LIMIT 1`,
    [value.trim()]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

async function replacePostCategories(
  db: ReturnType<typeof getPool>,
  postId: string,
  categorySlugs: string[]
): Promise<void> {
  await db.query(`DELETE FROM blog_post_categories WHERE post_id = $1`, [postId]);
  const slugs = sanitizeBlogCategorySlugs(categorySlugs);
  // Array position is the editor's order (first slug = card chip).
  for (let i = 0; i < slugs.length; i++) {
    await db.query(
      `INSERT INTO blog_post_categories (post_id, category_id, sort_order)
       SELECT $1, c.id, $3
       FROM blog_categories c
       WHERE c.slug = $2
       ON CONFLICT (post_id, category_id) DO NOTHING`,
      [postId, slugs[i], i]
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

/**
 * Create or update one post. On create, `categories`, `emdrAnchor`, and
 * `sections` are required so a published post cannot render empty slots.
 */
export async function upsertBlogPost(
  input: BlogPostInput
): Promise<BlogWriteResult> {
  try {
    await ensureBlogSchema();
  } catch (err) {
    warnFallback("upsertBlogPost/schema", err);
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

  const slug = normalizeBlogCategorySlug(input.slug ?? existing?.slug ?? title);
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

  const kicker = cleanCopy((input.kicker ?? existing?.kicker ?? "").trim(), "body");
  if (kicker.length > BLOG_KICKER_MAX) {
    return { ok: false, error: `Kicker must be ≤ ${BLOG_KICKER_MAX} characters` };
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

  let sections: BlogSectionInput[];
  if (input.sections === undefined) {
    sections = existing?.sections ?? [];
    if (sections.length === 0) {
      return { ok: false, error: "Sections are required" };
    }
  } else {
    const parsed = parseSections(input.sections);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    sections = parsed.sections;
  }
  if (blogBodyLength(sections) > BLOG_BODY_MAX_CHARS) {
    return {
      ok: false,
      error: `Body is too long (max ${BLOG_BODY_MAX_CHARS} characters)`,
    };
  }

  const anchor = cleanCopy(
    (input.emdrAnchor ?? existing?.emdrAnchor ?? "").trim(),
    "body"
  );
  const anchorProvided = input.emdrAnchor !== undefined;
  // Required for new posts: the article page links to /emdr with this text.
  if (!existing && !anchor) {
    return {
      ok: false,
      error:
        "emdrAnchor is required: the descriptive link text back to /emdr (e.g. \"how a guided session is structured in Nura\")",
    };
  }
  if (anchorProvided && !anchor) {
    return { ok: false, error: "emdrAnchor cannot be empty" };
  }
  if (anchor.length > BLOG_ANCHOR_MAX) {
    return { ok: false, error: `Anchor must be ≤ ${BLOG_ANCHOR_MAX} characters` };
  }

  // Brand rule: BLS is internal jargon and must never reach a public page.
  const offending = findBlsAcronym({
    title,
    description,
    dek,
    kicker,
    emdrAnchor: anchor,
    sections,
  });
  if (offending) {
    return {
      ok: false,
      error:
        "Copy must not use the acronym BLS. Say self-guided set time or session set instead.",
    };
  }

  const coverUrlRaw =
    input.coverUrl === undefined
      ? existing?.coverUrl ?? ""
      : (input.coverUrl ?? "").trim();
  if (!isValidCoverUrl(coverUrlRaw)) {
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
  // Unpublishing must not silently drop the home-grid flag.
  const featured =
    input.featured === undefined
      ? existing?.featured ?? false
      : input.featured === true;

  const id = existing?.id ?? input.id?.trim() ?? crypto.randomUUID();
  const db = getPool();

  const payload = {
    id,
    slug,
    title,
    description,
    kicker,
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
      await db.query(
        `INSERT INTO blog_posts (
           id, slug, title, description, kicker, dek, topic, featured, published,
           cover_url, emdr_anchor, published_at, sections, related
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)`,
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
