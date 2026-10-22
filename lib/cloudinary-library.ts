import { cloudinaryErrorMessage, signCloudinaryParams, type CloudinaryCredentials } from "@/lib/cloudinary";
import { getPool } from "@/lib/db";

/**
 * Cloudinary library data for the media picker (ported from the alexandermils
 * studio: folder tree, per-folder Search, paged listing, move). Every call runs
 * on the server with the saved credentials; secrets never reach the client.
 */

const API_ROOT = "https://api.cloudinary.com/v1_1";

export type CloudinaryLibraryAsset = {
  /** Stable across folder moves; labels key on it. */
  assetId?: string;
  publicId: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  /** MD5 of the stored file. */
  etag?: string;
};

export type CloudinaryFolderNode = { name: string; path: string; children: CloudinaryFolderNode[] };

type RawAsset = {
  asset_id?: string;
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  etag?: string;
};

export class CloudinaryRateLimitError extends Error {
  constructor() {
    super("Cloudinary's hourly API limit is used up. Try again within the hour.");
    this.name = "CloudinaryRateLimitError";
  }
}

function basicAuth(creds: CloudinaryCredentials): string {
  return `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString("base64")}`;
}

const root = (creds: CloudinaryCredentials) => `${API_ROOT}/${encodeURIComponent(creds.cloudName)}`;

async function fail(res: Response, creds: CloudinaryCredentials): Promise<never> {
  if (res.status === 420 || res.status === 429) throw new CloudinaryRateLimitError();
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new Error(cloudinaryErrorMessage(res.status, body?.error?.message, creds.cloudName));
}

/* ---------------- cache (memory + Postgres; the picker has a Refresh button) ---------------- */

/*
 * Cloudinary's Admin API has an hourly call budget, so a listing is fetched
 * once and then served from cache. Memory is the fast path; Postgres keeps it
 * across restarts and deploys. Uploads and moves clear the affected keys.
 */

type CacheEntry = { at: number; ttl: number; value: unknown };
const g = globalThis as unknown as { __nuraCld?: Map<string, CacheEntry>; __nuraCldInflight?: Map<string, Promise<unknown>> };
const cache = (g.__nuraCld ??= new Map());
const inflight = (g.__nuraCldInflight ??= new Map());

export const FOLDER_TTL = 6 * 3600_000;
export const ASSET_TTL = 2 * 3600_000;

let cacheTable: Promise<void> | null = null;

function ensureCacheTable(): Promise<void> {
  cacheTable ??= getPool()
    .query(
      `CREATE TABLE IF NOT EXISTS cloudinary_cache (
         key TEXT PRIMARY KEY,
         value JSONB NOT NULL,
         expires_at TIMESTAMPTZ NOT NULL
       )`
    )
    .then(async () => {
      // One sweep per process keeps expired pages from piling up.
      await getPool().query(`DELETE FROM cloudinary_cache WHERE expires_at < NOW()`).catch(() => undefined);
    })
    .catch((error) => {
      cacheTable = null;
      throw error;
    });
  return cacheTable;
}

async function readPersisted(key: string): Promise<CacheEntry | null> {
  try {
    await ensureCacheTable();
    const { rows } = await getPool().query<{ value: unknown; ttl_ms: string | number }>(
      `SELECT value, EXTRACT(EPOCH FROM (expires_at - NOW())) * 1000 AS ttl_ms
         FROM cloudinary_cache
        WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );
    const row = rows[0];
    if (!row) return null;
    const ttl = Number(row.ttl_ms);
    return { at: Date.now(), ttl: Number.isFinite(ttl) ? Math.max(0, ttl) : 0, value: row.value };
  } catch {
    return null; // the cache is best effort; never fail a listing because of it
  }
}

async function writePersisted(key: string, entry: CacheEntry): Promise<void> {
  try {
    await ensureCacheTable();
    await getPool().query(
      `INSERT INTO cloudinary_cache (key, value, expires_at)
       VALUES ($1, $2::jsonb, NOW() + ($3::bigint * INTERVAL '1 millisecond'))
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      [key, JSON.stringify(entry.value), Math.max(0, entry.ttl)]
    );
  } catch {
    /* memory still holds it for this process */
  }
}

async function dropPersisted(key: string): Promise<void> {
  try {
    await ensureCacheTable();
    await getPool().query(`DELETE FROM cloudinary_cache WHERE key = $1`, [key]);
  } catch {
    /* ignore */
  }
}

export async function cachedCloudinary<T>(key: string, ttl: number, load: () => Promise<T>, opts: { refresh?: boolean } = {}): Promise<T> {
  if (opts.refresh) {
    cache.delete(key);
    await dropPersisted(key);
  } else {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;
    const stored = await readPersisted(key);
    if (stored) {
      cache.set(key, stored);
      return stored.value as T;
    }
  }
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then(async (value) => {
      const entry = { at: Date.now(), ttl, value };
      cache.set(key, entry);
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
      await writePersisted(key, entry);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function clearCloudinaryCache(opts: { folders?: boolean } = {}): Promise<void> {
  for (const key of [...cache.keys()]) {
    if (key.startsWith("folders|") && !opts.folders) continue;
    cache.delete(key);
  }
  try {
    await ensureCacheTable();
    if (opts.folders) await getPool().query(`DELETE FROM cloudinary_cache`);
    else await getPool().query(`DELETE FROM cloudinary_cache WHERE key NOT LIKE 'folders|%'`);
  } catch {
    /* ignore */
  }
}

/* ---------------- assets ---------------- */

const etagOf = (etag: string | undefined) => (etag && /^[a-f0-9]{32}$/i.test(etag) ? etag.toLowerCase() : undefined);

export function cloudinaryThumb(cloudName: string, publicId: string, type: "image" | "video"): string {
  const id = publicId.split("/").map(encodeURIComponent).join("/");
  return type === "video"
    ? `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_480,h_640,c_limit/${id}.jpg`
    : `https://res.cloudinary.com/${cloudName}/image/upload/w_480,h_640,c_limit,f_auto,q_auto/${id}`;
}

function toAsset(creds: CloudinaryCredentials, type: "image" | "video", a: RawAsset): CloudinaryLibraryAsset {
  return {
    assetId: a.asset_id,
    publicId: a.public_id,
    url: a.secure_url,
    thumb: cloudinaryThumb(creds.cloudName, a.public_id, type),
    width: a.width ?? 0,
    height: a.height ?? 0,
    etag: etagOf(a.etag),
  };
}

/** One page of the whole library, newest first, optionally by public-id prefix (Admin API). */
export async function listCloudinaryLibrary(
  creds: CloudinaryCredentials,
  opts: { cursor?: string; prefix?: string; resourceType?: "image" | "video" } = {}
): Promise<{ assets: CloudinaryLibraryAsset[]; nextCursor: string | null }> {
  const type = opts.resourceType ?? "image";
  const params = new URLSearchParams({ max_results: "40", direction: "desc" });
  if (opts.cursor) params.set("next_cursor", opts.cursor);
  if (opts.prefix) params.set("prefix", opts.prefix);
  const res = await fetch(`${root(creds)}/resources/${type}/upload?${params}`, {
    headers: { Authorization: basicAuth(creds) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) await fail(res, creds);
  const data = (await res.json()) as { resources?: RawAsset[]; next_cursor?: string };
  return { assets: (data.resources ?? []).map((a) => toAsset(creds, type, a)), nextCursor: data.next_cursor ?? null };
}

const quote = (value: string) => `"${value.replace(/["\\]/g, "")}"`;

/** One page of one folder and its subfolders (Search API; fixed and dynamic folder modes), optional name filter. */
export async function searchCloudinaryFolder(
  creds: CloudinaryCredentials,
  opts: { folder: string; cursor?: string; query?: string; resourceType?: "image" | "video" }
): Promise<{ assets: CloudinaryLibraryAsset[]; nextCursor: string | null }> {
  const type = opts.resourceType ?? "image";
  const f = quote(opts.folder);
  const prefix = opts.folder.replace(/([\s:"'()\\=<>!&|*?])/g, "\\$1");
  let expression = `resource_type:${type} AND (folder=${f} OR asset_folder=${f} OR folder:${prefix}/* OR asset_folder:${prefix}/*)`;
  const q = opts.query?.trim().replace(/[^\w\-.]/g, "");
  if (q) expression += ` AND (filename:${q}* OR display_name:${q}*)`;
  const body: Record<string, unknown> = { expression, max_results: 40, sort_by: [{ created_at: "desc" }] };
  if (opts.cursor) body.next_cursor = opts.cursor;
  const res = await fetch(`${root(creds)}/resources/search`, {
    method: "POST",
    headers: { Authorization: basicAuth(creds), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) await fail(res, creds);
  const data = (await res.json()) as { resources?: RawAsset[]; next_cursor?: string };
  return { assets: (data.resources ?? []).map((a) => toAsset(creds, type, a)), nextCursor: data.next_cursor ?? null };
}

/* ---------------- folders ---------------- */

export function buildFolderTree(flat: { name: string; path: string }[]): CloudinaryFolderNode[] {
  const byPath = new Map<string, CloudinaryFolderNode>();
  const roots: CloudinaryFolderNode[] = [];
  const ensure = (path: string): CloudinaryFolderNode => {
    let node = byPath.get(path);
    if (node) return node;
    node = { name: path.split("/").pop() || path, path, children: [] };
    byPath.set(path, node);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null;
    (parent ? ensure(parent).children : roots).push(node);
    return node;
  };
  for (const f of flat) if (f.path) ensure(f.path).name = f.name || f.path.split("/").pop() || f.path;
  const sort = (list: CloudinaryFolderNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

/** Whole folder tree: folders/search in one paged call, else walk the tree. */
export async function listCloudinaryFolders(creds: CloudinaryCredentials): Promise<CloudinaryFolderNode[]> {
  const auth = { Authorization: basicAuth(creds) };
  try {
    const flat: { name: string; path: string }[] = [];
    let cursor: string | undefined;
    let page = 0;
    do {
      const params = new URLSearchParams({ max_results: "500" });
      if (cursor) params.set("next_cursor", cursor);
      const res = await fetch(`${root(creds)}/folders/search?${params}`, { headers: auth, signal: AbortSignal.timeout(20000) });
      if (res.status === 401 || res.status === 420 || res.status === 429) await fail(res, creds);
      if (!res.ok) throw new Error(`folders/search ${res.status}`);
      const data = (await res.json()) as { folders?: { name: string; path: string }[]; next_cursor?: string };
      flat.push(...(data.folders ?? []));
      cursor = data.next_cursor;
      page += 1;
    } while (cursor && page < 10);
    return buildFolderTree(flat);
  } catch (error) {
    if (error instanceof CloudinaryRateLimitError) throw error;
    if (error instanceof Error && !/^folders\/search/.test(error.message)) throw error;
  }
  async function children(path: string | null, depth: number): Promise<CloudinaryFolderNode[]> {
    const url = path
      ? `${root(creds)}/folders/${path.split("/").map(encodeURIComponent).join("/")}?max_results=500`
      : `${root(creds)}/folders?max_results=500`;
    const res = await fetch(url, { headers: auth, signal: AbortSignal.timeout(20000) });
    if (res.status === 404) return [];
    if (!res.ok) await fail(res, creds);
    const data = (await res.json()) as { folders?: { name: string; path: string }[] };
    const list = (data.folders ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const out: CloudinaryFolderNode[] = [];
    for (const f of list) out.push({ name: f.name, path: f.path, children: depth < 5 ? await children(f.path, depth + 1) : [] });
    return out;
  }
  return children(null, 0);
}

/* ---------------- move ---------------- */

export type CloudinaryMoveResult = {
  mode: "dynamic" | "fixed";
  moved: { from: string; to: string; url: string | null }[];
  failed: { publicId: string; error: string }[];
};

const pidPath = (publicId: string) => publicId.split("/").map(encodeURIComponent).join("/");

/**
 * Dynamic-folder accounts: a metadata update (public id and URLs stay).
 * Fixed-folder accounts: a rename; then the site's own references (marketing
 * section configs) are pointed at the new id. Nothing else in the DB is touched.
 */
export async function moveCloudinaryAssets(
  creds: CloudinaryCredentials,
  opts: { publicIds: string[]; folder: string; resourceType?: "image" | "video" }
): Promise<CloudinaryMoveResult> {
  const type = opts.resourceType ?? "image";
  const folder = opts.folder.replace(/^\/+|\/+$/g, "");
  const auth = { Authorization: basicAuth(creds) };
  const probe = await fetch(`${root(creds)}/resources/${type}/upload/${pidPath(opts.publicIds[0]!)}`, {
    headers: auth,
    signal: AbortSignal.timeout(15000),
  });
  if (!probe.ok) await fail(probe, creds);
  const mode: "dynamic" | "fixed" = "asset_folder" in ((await probe.json()) as Record<string, unknown>) ? "dynamic" : "fixed";
  const result: CloudinaryMoveResult = { mode, moved: [], failed: [] };
  for (const publicId of opts.publicIds) {
    try {
      if (mode === "dynamic") {
        const res = await fetch(`${root(creds)}/resources/${type}/upload/${pidPath(publicId)}`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ asset_folder: folder }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) await fail(res, creds);
        result.moved.push({ from: publicId, to: publicId, url: null });
      } else {
        const base = publicId.split("/").pop() || publicId;
        const to = folder ? `${folder}/${base}` : base;
        if (to === publicId) {
          result.moved.push({ from: publicId, to, url: null });
          continue;
        }
        const signed = { from_public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), to_public_id: to };
        const res = await fetch(`${root(creds)}/${type}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ ...signed, api_key: creds.apiKey, signature: signCloudinaryParams(signed, creds.apiSecret) }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) await fail(res, creds);
        const data = (await res.json()) as { secure_url?: string };
        await rewriteMarketingReferences(publicId, to);
        result.moved.push({ from: publicId, to, url: data.secure_url ?? null });
      }
    } catch (error) {
      result.failed.push({ publicId, error: error instanceof Error ? error.message : "Move failed." });
    }
  }
  return result;
}

/** After a fixed-folder rename, point the marketing section configs at the new public id. */
async function rewriteMarketingReferences(from: string, to: string): Promise<void> {
  await getPool().query(
    `UPDATE marketing_sections SET config = replace(config::text, $1, $2)::jsonb, updated_at = NOW()
     WHERE config::text LIKE '%' || $1 || '%'`,
    [`/${from}.`, `/${to}.`]
  );
}
