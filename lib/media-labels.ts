import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";

/**
 * Media labels for the Cloudinary picker (ported from the alexandermils studio):
 * the admin's own bookmarks over the library. DB only; Cloudinary is untouched.
 * Tables are additive and created on first use.
 */

export type MediaLabelAsset = {
  assetId?: string;
  publicId: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  etag?: string;
};

export type MediaLabelSummary = { id: string; name: string; color: string; count: number; keys: string[] };

export function cleanEtag(value: unknown): string {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value.trim()) ? value.trim().toLowerCase() : "";
}

/** asset_id survives folder moves; public_id is the fallback. */
export function mediaAssetKey(asset: { assetId?: string | null; publicId: string }): string {
  return asset.assetId?.trim() || `pid:${asset.publicId}`;
}

export function cleanLabelName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (!name || name.length > 60) return null;
  return name;
}

let ready: Promise<void> | null = null;
export function ensureMediaLabelTables(): Promise<void> {
  ready ??= getPool()
    .query(
      `CREATE TABLE IF NOT EXISTS media_labels (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL UNIQUE,
         color TEXT NOT NULL DEFAULT 'default',
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       );
       CREATE TABLE IF NOT EXISTS media_label_items (
         label_id TEXT NOT NULL REFERENCES media_labels(id) ON DELETE CASCADE,
         asset_key TEXT NOT NULL,
         public_id TEXT NOT NULL,
         url TEXT NOT NULL,
         thumb TEXT NOT NULL,
         width INTEGER NOT NULL DEFAULT 0,
         height INTEGER NOT NULL DEFAULT 0,
         resource_type TEXT NOT NULL DEFAULT 'image',
         etag TEXT NOT NULL DEFAULT '',
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         PRIMARY KEY (label_id, asset_key)
       );
       CREATE INDEX IF NOT EXISTS idx_media_label_items_public ON media_label_items(public_id);`
    )
    .then(() => undefined)
    .catch((error) => {
      ready = null;
      throw error;
    });
  return ready;
}

export async function listMediaLabels(resourceType: "image" | "video"): Promise<MediaLabelSummary[]> {
  await ensureMediaLabelTables();
  const { rows } = await getPool().query<{ id: string; name: string; color: string; asset_key: string | null; public_id: string | null; etag: string | null }>(
    `SELECT l.id, l.name, l.color, i.asset_key, i.public_id, i.etag
       FROM media_labels l
       LEFT JOIN media_label_items i ON i.label_id = l.id AND i.resource_type = $1
      ORDER BY lower(l.name), l.id`,
    [resourceType]
  );
  const out = new Map<string, MediaLabelSummary>();
  for (const row of rows) {
    let label = out.get(row.id);
    if (!label) {
      label = { id: row.id, name: row.name, color: row.color, count: 0, keys: [] };
      out.set(row.id, label);
    }
    if (!row.asset_key || !row.public_id) continue;
    label.count += 1;
    const etag = cleanEtag(row.etag);
    label.keys.push(row.asset_key, `pid:${row.public_id}`, ...(etag ? [`etag:${etag}`] : []));
  }
  return [...out.values()];
}

export async function createMediaLabel(name: string, color: string): Promise<MediaLabelSummary> {
  await ensureMediaLabelTables();
  const id = randomUUID();
  await getPool().query(`INSERT INTO media_labels (id, name, color) VALUES ($1, $2, $3)`, [id, name, color]);
  return { id, name, color, count: 0, keys: [] };
}

export async function updateMediaLabel(id: string, patch: { name?: string; color?: string }): Promise<boolean> {
  await ensureMediaLabelTables();
  const { rowCount } = await getPool().query(
    `UPDATE media_labels SET name = COALESCE($2, name), color = COALESCE($3, color), updated_at = NOW() WHERE id = $1`,
    [id, patch.name ?? null, patch.color ?? null]
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteMediaLabel(id: string): Promise<boolean> {
  await ensureMediaLabelTables();
  const { rowCount } = await getPool().query(`DELETE FROM media_labels WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function mediaLabelExists(id: string): Promise<boolean> {
  await ensureMediaLabelTables();
  const { rowCount } = await getPool().query(`SELECT 1 FROM media_labels WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/** Files in one label, newest first, optional name filter on the public id. */
export async function mediaLabelAssets(id: string, resourceType: "image" | "video", query = ""): Promise<MediaLabelAsset[]> {
  await ensureMediaLabelTables();
  const { rows } = await getPool().query<{ asset_key: string; public_id: string; url: string; thumb: string; width: number; height: number; etag: string }>(
    `SELECT asset_key, public_id, url, thumb, width, height, etag FROM media_label_items
      WHERE label_id = $1 AND resource_type = $2 AND ($3 = '' OR public_id ILIKE '%' || $3 || '%')
      ORDER BY created_at DESC`,
    [id, resourceType, query.trim()]
  );
  return rows.map((r) => ({
    assetId: r.asset_key.startsWith("pid:") ? undefined : r.asset_key,
    publicId: r.public_id,
    url: r.url,
    thumb: r.thumb,
    width: r.width,
    height: r.height,
    etag: cleanEtag(r.etag) || undefined,
  }));
}

/** Add files to (or remove them from) one label. One row per file. */
export async function assignMediaLabel(
  labelId: string,
  action: "add" | "remove",
  assets: MediaLabelAsset[],
  resourceType: "image" | "video"
): Promise<void> {
  await ensureMediaLabelTables();
  const pool = getPool();
  const keys = assets.map(mediaAssetKey);
  const pids = assets.map((a) => a.publicId);
  if (action === "remove") {
    const etags = assets.map((a) => cleanEtag(a.etag)).filter(Boolean);
    await pool.query(
      `DELETE FROM media_label_items WHERE label_id = $1 AND (asset_key = ANY($2::text[]) OR public_id = ANY($3::text[]) OR (etag <> '' AND etag = ANY($4::text[])))`,
      [labelId, keys, pids, etags]
    );
  } else {
    for (const a of assets) {
      const etag = cleanEtag(a.etag);
      await pool.query(
        `INSERT INTO media_label_items (label_id, asset_key, public_id, url, thumb, width, height, resource_type, etag)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
          WHERE NOT EXISTS (
            SELECT 1 FROM media_label_items
             WHERE label_id = $1 AND (asset_key = $2 OR public_id = $3 OR ($9 <> '' AND etag = $9))
          )`,
        [labelId, mediaAssetKey(a), a.publicId, a.url, a.thumb, Math.round(a.width) || 0, Math.round(a.height) || 0, resourceType, etag]
      );
    }
  }
  await pool.query(`UPDATE media_labels SET updated_at = NOW() WHERE id = $1`, [labelId]);
}

/** Labels follow a file renamed by a fixed-folder move. */
export async function renameLabelledAssets(renames: { from: string; to: string; url: string | null }[]): Promise<void> {
  await ensureMediaLabelTables();
  for (const r of renames) {
    if (r.from === r.to) continue;
    await getPool().query(
      `UPDATE media_label_items
          SET public_id = $2,
              url = COALESCE($3, replace(url, '/' || $1 || '.', '/' || $2 || '.')),
              thumb = replace(thumb, '/' || $1, '/' || $2),
              asset_key = CASE WHEN asset_key = 'pid:' || $1 THEN 'pid:' || $2 ELSE asset_key END
        WHERE public_id = $1`,
      [r.from, r.to, r.url]
    );
  }
}
