import { rewriteRetiredBrandCopy } from "@/lib/brand";
import { ensureSchemaReady, getPool } from "@/lib/db";
import { SEED_RESOURCES } from "@/lib/resources-content";
import {
  RESOURCE_BODY_MAX_CHARS,
  RESOURCE_SUMMARY_MAX,
  RESOURCE_TITLE_MAX,
  extractMarkdownImageUrls,
  isResourceKind,
  isValidResourceCoverUrl,
  isValidResourceSlug,
  isValidResourceVideoUrl,
  normalizeResourceSlug,
  postToResourceCard,
  postToResourceItem,
  type ResourceItem,
  type ResourceKind,
  type ResourcePost,
} from "@/lib/resources";

let resourcesSchemaDone = false;

export async function ensureResourcesSchema(): Promise<void> {
  await ensureSchemaReady();
  if (resourcesSchemaDone) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT,
      cover_url TEXT,
      video_url TEXT,
      read_minutes INT,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_resources_enabled_kind
      ON resources(enabled, kind, sort_order ASC, title ASC);
    CREATE INDEX IF NOT EXISTS idx_resources_featured
      ON resources(featured, enabled) WHERE featured = TRUE;
  `);

  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM resources`
  );
  if (Number(rows[0]?.count ?? 0) === 0) {
    let order = 0;
    for (const seed of SEED_RESOURCES) {
      await db.query(
        `INSERT INTO resources (
           id, slug, kind, title, summary, body, cover_url, video_url,
           read_minutes, featured, enabled, sort_order, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,TRUE,$10,NOW(),NOW()
         )`,
        [
          crypto.randomUUID(),
          seed.slug,
          seed.kind,
          seed.title,
          seed.summary,
          seed.body ?? null,
          seed.videoUrl ?? null,
          seed.readMinutes ?? null,
          seed.featured === true,
          order++,
        ]
      );
    }
  }

  await remapRetiredResourceCopy(db);
  await syncFeaturedSeedSummaries(db);
  resourcesSchemaDone = true;
}

/** Refresh home-teaser blurbs when they still match the previous seed text. */
async function syncFeaturedSeedSummaries(
  db: ReturnType<typeof getPool>
): Promise<void> {
  const legacyBySlug: Record<string, string[]> = {
    "what-is-emdr": [
      "A short overview of the moving ball and how AI agent-guided sessions are structured in Nura.",
    ],
    "grounding-before-a-set": [
      "Simple ways to settle your nervous system before starting a set with the moving ball.",
    ],
    "when-to-pause": [
      "Signs that you should take a break, ground, or reach out for support.",
    ],
  };
  for (const seed of SEED_RESOURCES) {
    const legacy = legacyBySlug[seed.slug];
    if (!legacy?.length) continue;
    await db.query(
      `UPDATE resources
       SET summary = $1, updated_at = NOW()
       WHERE slug = $2 AND summary = ANY($3::text[])`,
      [seed.summary, seed.slug, legacy]
    );
  }
}

async function remapRetiredResourceCopy(
  db: ReturnType<typeof getPool>
): Promise<void> {
  const { rows } = await db.query<{
    id: string;
    title: string;
    summary: string;
    body: string | null;
  }>(`SELECT id, title, summary, body FROM resources`);
  for (const row of rows) {
    const title = rewriteRetiredBrandCopy(row.title);
    const summary = rewriteRetiredBrandCopy(row.summary);
    const body = row.body ? rewriteRetiredBrandCopy(row.body) : null;
    if (
      title === row.title &&
      summary === row.summary &&
      body === row.body
    ) {
      continue;
    }
    await db.query(
      `UPDATE resources SET title = $1, summary = $2, body = $3, updated_at = NOW()
       WHERE id = $4`,
      [title, summary, body, row.id]
    );
  }
}

function rowPost(r: Record<string, unknown>): ResourcePost {
  return {
    id: r.id as string,
    slug: r.slug as string,
    kind: r.kind as ResourceKind,
    title: r.title as string,
    summary: (r.summary as string) ?? "",
    body: (r.body as string | null) ?? null,
    coverUrl: (r.cover_url as string | null) ?? null,
    videoUrl: (r.video_url as string | null) ?? null,
    readMinutes:
      r.read_minutes === null || r.read_minutes === undefined
        ? null
        : Number(r.read_minutes),
    featured: Boolean(r.featured),
    enabled: Boolean(r.enabled),
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listResourcesAdmin(): Promise<ResourcePost[]> {
  await ensureResourcesSchema();
  const { rows } = await getPool().query(
    `SELECT * FROM resources
     ORDER BY sort_order ASC, title ASC`
  );
  return rows.map(rowPost);
}

export async function listPublishedResources(opts?: {
  kind?: ResourceKind;
  featuredOnly?: boolean;
  limit?: number;
}): Promise<ResourcePost[]> {
  await ensureResourcesSchema();
  const params: unknown[] = [];
  const where = ["enabled = TRUE"];
  if (opts?.kind) {
    params.push(opts.kind);
    where.push(`kind = $${params.length}`);
  }
  if (opts?.featuredOnly) {
    where.push(`featured = TRUE`);
  }
  let sql = `SELECT * FROM resources WHERE ${where.join(" AND ")}
    ORDER BY sort_order ASC, title ASC`;
  if (opts?.limit && opts.limit > 0) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }
  const { rows } = await getPool().query(sql, params);
  return rows.map(rowPost);
}

export async function getResourceById(
  id: string
): Promise<ResourcePost | null> {
  await ensureResourcesSchema();
  const { rows } = await getPool().query(
    `SELECT * FROM resources WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowPost(rows[0]) : null;
}

export async function getPublishedResourceBySlug(
  slug: string
): Promise<ResourcePost | null> {
  await ensureResourcesSchema();
  const { rows } = await getPool().query(
    `SELECT * FROM resources WHERE slug = $1 AND enabled = TRUE`,
    [slug]
  );
  return rows[0] ? rowPost(rows[0]) : null;
}

export type ResourceUpsertInput = {
  id?: string;
  slug: string;
  kind: ResourceKind;
  title: string;
  summary?: string;
  body?: string | null;
  coverUrl?: string | null;
  videoUrl?: string | null;
  readMinutes?: number | null;
  featured?: boolean;
  enabled?: boolean;
  sortOrder?: number;
};

export type ResourceUpsertResult =
  | { ok: true; post: ResourcePost }
  | { ok: false; error: string };

export async function upsertResource(
  input: ResourceUpsertInput
): Promise<ResourceUpsertResult> {
  await ensureResourcesSchema();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > RESOURCE_TITLE_MAX) {
    return { ok: false, error: `Title must be ≤ ${RESOURCE_TITLE_MAX} characters` };
  }

  const slug = normalizeResourceSlug(input.slug || title);
  if (!isValidResourceSlug(slug)) {
    return { ok: false, error: "Invalid slug" };
  }
  if (!isResourceKind(input.kind)) {
    return { ok: false, error: "Invalid kind" };
  }

  const existing = input.id ? await getResourceById(input.id) : null;

  const coverUrl =
    input.coverUrl === undefined
      ? undefined
      : input.coverUrl?.trim()
        ? input.coverUrl.trim()
        : null;
  if (coverUrl && !isValidResourceCoverUrl(coverUrl)) {
    return { ok: false, error: "Invalid cover image" };
  }

  const videoUrl =
    input.videoUrl === undefined
      ? undefined
      : input.videoUrl?.trim()
        ? input.videoUrl.trim()
        : null;
  if (videoUrl && !isValidResourceVideoUrl(videoUrl)) {
    return {
      ok: false,
      error: "Video URL must be YouTube, Vimeo, or an https .mp4/.webm link",
    };
  }

  const summaryRaw = (input.summary ?? "").trim();
  if (summaryRaw.length > RESOURCE_SUMMARY_MAX) {
    return {
      ok: false,
      error: `Summary must be ≤ ${RESOURCE_SUMMARY_MAX} characters`,
    };
  }
  const summary = summaryRaw;

  const body =
    input.body === undefined
      ? undefined
      : input.body?.trim()
        ? input.body.trim()
        : null;
  if (body && body.length > RESOURCE_BODY_MAX_CHARS) {
    return {
      ok: false,
      error: `Body must be ≤ ${RESOURCE_BODY_MAX_CHARS} characters`,
    };
  }
  if (body) {
    for (const imgUrl of extractMarkdownImageUrls(body)) {
      if (!isValidResourceCoverUrl(imgUrl)) {
        return {
          ok: false,
          error:
            "Body images must be https URLs or jpeg/png/webp data URLs under the size limit",
        };
      }
    }
  }

  const readMinutes =
    input.readMinutes === undefined
      ? undefined
      : input.readMinutes === null || Number.isNaN(Number(input.readMinutes))
        ? null
        : Math.max(0, Math.min(120, Math.round(Number(input.readMinutes))));

  const id = input.id?.trim() || crypto.randomUUID();
  const featured =
    input.featured === undefined
      ? (existing?.featured ?? false)
      : input.featured === true;
  const enabled =
    input.enabled === undefined
      ? (existing?.enabled ?? true)
      : input.enabled !== false;
  const sortOrder =
    input.sortOrder === undefined
      ? (existing?.sortOrder ?? 0)
      : Math.max(0, Math.round(Number(input.sortOrder) || 0));

  try {
    const { rows } = await getPool().query(
      `INSERT INTO resources (
         id, slug, kind, title, summary, body, cover_url, video_url,
         read_minutes, featured, enabled, sort_order, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         kind = EXCLUDED.kind,
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         body = EXCLUDED.body,
         cover_url = EXCLUDED.cover_url,
         video_url = EXCLUDED.video_url,
         read_minutes = EXCLUDED.read_minutes,
         featured = EXCLUDED.featured,
         enabled = EXCLUDED.enabled,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        slug,
        input.kind,
        title,
        summary,
        body === undefined ? (existing?.body ?? null) : body,
        coverUrl === undefined ? (existing?.coverUrl ?? null) : coverUrl,
        videoUrl === undefined ? (existing?.videoUrl ?? null) : videoUrl,
        readMinutes === undefined
          ? (existing?.readMinutes ?? null)
          : readMinutes,
        featured,
        enabled,
        sortOrder,
      ]
    );
    return { ok: true, post: rowPost(rows[0]) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("resources_slug_key") || msg.includes("unique")) {
      return { ok: false, error: "Slug already in use" };
    }
    throw err;
  }
}

export async function deleteResource(id: string): Promise<void> {
  await ensureResourcesSchema();
  await getPool().query(`DELETE FROM resources WHERE id = $1`, [id]);
}

export async function listPublishedResourceItems(opts?: {
  kind?: ResourceKind;
  featuredOnly?: boolean;
  limit?: number;
}): Promise<ResourceItem[]> {
  const posts = await listPublishedResources(opts);
  return posts.map(postToResourceCard);
}
