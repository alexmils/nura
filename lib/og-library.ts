/**
 * Internal Open Graph image library.
 *
 * Uploads are stored once here, and the SEO settings hold `/api/og-library/<id>`
 * instead of a 300 KB data URL per page. The public route serves the bytes, so
 * crawlers still get a normal image URL, and a deleted image can be detected as
 * still in use before it breaks someone's share card.
 */

import { createHash, randomUUID } from "crypto";
import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  getPlatformSettings,
  savePlatformSettings,
} from "@/lib/platform-settings";
import { resolveSiteSeoPages } from "@/lib/site-seo";
import {
  isAllowedOgImageUrl,
  SEO_OG_IMAGE_MAX_CHARS,
  type SeoPageId,
} from "@/lib/seo-config";

export type OgImageRecord = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  usedBy: string[];
};

let schemaDone = false;

export async function ensureOgLibrarySchema(): Promise<void> {
  await ensureSchemaReady();
  if (schemaDone) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS og_images (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data_url TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_og_images_created
      ON og_images(created_at DESC);
  `);
  schemaDone = true;
}

export function ogImageUrl(id: string): string {
  return `/api/og-library/${encodeURIComponent(id)}`;
}

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().slice(0, 120) : "";
  return name || "OG image";
}

function validateDataUrl(dataUrl: unknown): string {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Upload an image file first.");
  }
  if (!isAllowedOgImageUrl(dataUrl)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (dataUrl.length > SEO_OG_IMAGE_MAX_CHARS) {
    throw new Error("That image is too large.");
  }
  return dataUrl;
}

export class OgImageInUseError extends Error {
  usedBy: string[];

  constructor(usedBy: string[]) {
    super(
      `This image is still used by ${usedBy.join(", ")}. Replace it there first.`
    );
    this.name = "OgImageInUseError";
    this.usedBy = usedBy;
  }
}

type OgRow = {
  id: string;
  name: string;
  data_url: string;
  created_at: string;
  updated_at: string;
};

async function usageByUrl(): Promise<Map<string, string[]>> {
  const platform = await getPlatformSettings();
  const seo = platform.seo;
  const pages = resolveSiteSeoPages(seo);
  const labelById = new Map(pages.map((page) => [page.id, page.label]));
  const usage = new Map<string, string[]>();
  const add = (url: string | undefined, label: string) => {
    if (!url) return;
    const list = usage.get(url) ?? [];
    list.push(label);
    usage.set(url, list);
  };

  add(seo.defaultOgImageUrl, "Site-wide default");
  for (const [id, override] of Object.entries(seo.pages)) {
    add(override?.ogImageUrl, labelById.get(id as SeoPageId) ?? id);
  }
  return usage;
}

function toRecord(row: OgRow, usage: Map<string, string[]>): OgImageRecord {
  const url = ogImageUrl(row.id);
  return {
    id: row.id,
    name: row.name,
    url,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    usedBy: usage.get(url) ?? [],
  };
}

export async function listOgImages(): Promise<OgImageRecord[]> {
  await ensureOgLibrarySchema();
  const [usage, { rows }] = await Promise.all([
    usageByUrl(),
    getPool().query<OgRow>(
      `SELECT id, name, data_url, created_at, updated_at
       FROM og_images
       ORDER BY created_at DESC`
    ),
  ]);
  return rows.map((row) => toRecord(row, usage));
}

export async function getOgImage(
  id: string
): Promise<{ id: string; name: string; dataUrl: string } | null> {
  await ensureOgLibrarySchema();
  const { rows } = await getPool().query<OgRow>(
    `SELECT id, name, data_url, created_at, updated_at
     FROM og_images WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, dataUrl: row.data_url };
}

export async function createOgImage(input: {
  name?: unknown;
  dataUrl?: unknown;
}): Promise<OgImageRecord> {
  await ensureOgLibrarySchema();
  const dataUrl = validateDataUrl(input.dataUrl);
  const name = cleanName(input.name);
  const hash = createHash("sha256").update(dataUrl).digest("hex");

  const { rows } = await getPool().query<OgRow>(
    `INSERT INTO og_images (id, name, data_url, content_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (content_hash) DO UPDATE SET name = og_images.name
     RETURNING id, name, data_url, created_at, updated_at`,
    [randomUUID(), name, dataUrl, hash]
  );
  const usage = await usageByUrl();
  return toRecord(rows[0]!, usage);
}

export async function updateOgImage(
  id: string,
  input: { name?: unknown; dataUrl?: unknown }
): Promise<OgImageRecord | null> {
  await ensureOgLibrarySchema();
  const pool = getPool();

  if (typeof input.name === "string") {
    await pool.query(
      `UPDATE og_images SET name = $2, updated_at = NOW() WHERE id = $1`,
      [id, cleanName(input.name)]
    );
  }

  if (input.dataUrl !== undefined) {
    const dataUrl = validateDataUrl(input.dataUrl);
    const hash = createHash("sha256").update(dataUrl).digest("hex");
    try {
      await pool.query(
        `UPDATE og_images
         SET data_url = $2, content_hash = $3, updated_at = NOW()
         WHERE id = $1`,
        [id, dataUrl, hash]
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new Error("That image is already in the library.");
      }
      throw err;
    }
  }

  const image = await getOgImage(id);
  if (!image) return null;
  const usage = await usageByUrl();
  const { rows } = await pool.query<OgRow>(
    `SELECT id, name, data_url, created_at, updated_at
     FROM og_images WHERE id = $1`,
    [id]
  );
  return rows[0] ? toRecord(rows[0], usage) : null;
}

export async function deleteOgImage(id: string): Promise<void> {
  await ensureOgLibrarySchema();
  const image = await getOgImage(id);
  if (!image) throw new Error("Image not found.");
  const usage = await usageByUrl();
  const usedBy = usage.get(ogImageUrl(id)) ?? [];
  if (usedBy.length > 0) throw new OgImageInUseError(usedBy);
  await getPool().query(`DELETE FROM og_images WHERE id = $1`, [id]);
}

/**
 * Pull data-URL images already saved in Admin → SEO into the library, and
 * point those settings at the library URL. Explicit action from the library
 * screen, because it rewrites the SEO settings.
 */
export async function importLegacyOgImages(): Promise<number> {
  await ensureOgLibrarySchema();
  const platform = await getPlatformSettings();
  const seo = platform.seo;
  const pages = resolveSiteSeoPages(seo);
  const labelById = new Map(pages.map((page) => [page.id, page.label]));

  const legacy = new Map<string, string>();
  if (seo.defaultOgImageUrl.startsWith("data:image/")) {
    legacy.set(seo.defaultOgImageUrl, "Site-wide default");
  }
  for (const [id, override] of Object.entries(seo.pages)) {
    const url = override?.ogImageUrl;
    if (url?.startsWith("data:image/")) {
      legacy.set(url, `${labelById.get(id as SeoPageId) ?? id} OG image`);
    }
  }
  if (legacy.size === 0) return 0;

  const replacement = new Map<string, string>();
  for (const [dataUrl, name] of legacy) {
    const image = await createOgImage({ name, dataUrl });
    replacement.set(dataUrl, image.url);
  }

  const nextSeo = {
    ...seo,
    defaultOgImageUrl:
      replacement.get(seo.defaultOgImageUrl) ?? seo.defaultOgImageUrl,
    pages: Object.fromEntries(
      Object.entries(seo.pages).map(([id, override]) => [
        id,
        override?.ogImageUrl && replacement.get(override.ogImageUrl)
          ? { ...override, ogImageUrl: replacement.get(override.ogImageUrl)! }
          : override,
      ])
    ),
  };

  await savePlatformSettings({ ...platform, seo: nextSeo });
  return replacement.size;
}
