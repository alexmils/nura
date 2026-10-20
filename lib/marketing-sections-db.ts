import { cache } from "react";
import type { PoolClient } from "pg";
import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  customIdsIn,
  defaultLayout,
  isMarketingPageId,
  LAYOUT_ROW_PREFIX,
  layoutRowId,
  MAX_CUSTOM_SECTIONS_PER_PAGE,
  normalizeLayout,
  type MarketingPageId,
  type PageLayout,
} from "@/lib/marketing-layout";
import {
  defaultMarketingCopy,
  isMarketingSectionId,
  localMarketingPaths,
  normalizeSection,
  replaceSectionMedia,
  type SectionConfig,
} from "@/lib/marketing-sections";

type Row = { id: string; config: unknown };

/** One read per request for copy and layouts. `null` when the DB is unavailable. */
const loadRows = cache(async (): Promise<Row[] | null> => {
  try {
    await ensureSchemaReady();
    const { rows } = await getPool().query<Row>("SELECT id, config FROM marketing_sections");
    return rows;
  } catch (err) {
    console.error("[marketing-sections] load failed", err);
    return null;
  }
});

/** Saved marketing copy merged over defaults. Missing rows stay on the defaults. */
export const loadMarketingCopy = cache(async (): Promise<Record<string, SectionConfig>> => {
  const out = defaultMarketingCopy();
  const rows = await loadRows();
  for (const row of rows ?? []) {
    if (!isMarketingSectionId(row.id)) continue;
    try {
      out[row.id] = normalizeSection(row.id, row.config);
    } catch (err) {
      console.error("[marketing-sections] bad row", row.id, err);
    }
  }
  return out;
});

/** One saved section, defaults when the row is missing. */
export const loadMarketingSection = cache(
  async (id: string): Promise<SectionConfig> => {
    const rows = await loadRows();
    const row = rows?.find((entry) => entry.id === id);
    try {
      return normalizeSection(id, row?.config ?? null);
    } catch (err) {
      console.error("[marketing-sections] bad row", id, err);
      return normalizeSection(id, null);
    }
  }
);

/** Saved page layouts. Pages without a row are absent (= default order, all shown). */
export const loadPageLayouts = cache(async (): Promise<Partial<Record<MarketingPageId, PageLayout>>> => {
  const out: Partial<Record<MarketingPageId, PageLayout>> = {};
  const rows = await loadRows();
  for (const row of rows ?? []) {
    if (!row.id.startsWith(LAYOUT_ROW_PREFIX)) continue;
    const page = row.id.slice(LAYOUT_ROW_PREFIX.length);
    if (!isMarketingPageId(page)) continue;
    try {
      out[page] = normalizeLayout(page, row.config);
    } catch (err) {
      console.error("[marketing-layout] bad row", row.id, err);
    }
  }
  return out;
});

/** Drops admin-added section rows that no saved layout references any more. */
async function pruneOrphanCustomSections(client: PoolClient): Promise<void> {
  const { rows } = await client.query<Row>(
    "SELECT id, config FROM marketing_sections WHERE id LIKE $1",
    [`${LAYOUT_ROW_PREFIX}%`]
  );
  const keep = new Set<string>();
  for (const row of rows) {
    const page = row.id.slice(LAYOUT_ROW_PREFIX.length);
    if (!isMarketingPageId(page)) continue;
    for (const id of customIdsIn(normalizeLayout(page, row.config))) keep.add(id);
  }
  await client.query(
    "DELETE FROM marketing_sections WHERE id LIKE 'custom-%' AND NOT (id = ANY($1::text[]))",
    [[...keep]]
  );
}

export async function savePageLayout(
  page: MarketingPageId,
  input: unknown,
  seeds: Record<string, unknown> = {}
): Promise<PageLayout> {
  const layout = normalizeLayout(page, input);
  const customs = new Set(customIdsIn(layout));
  await ensureSchemaReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO marketing_sections (id, config, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
         SET config = EXCLUDED.config, updated_at = NOW()`,
      [layoutRowId(page), JSON.stringify(layout)]
    );
    for (const [id, config] of Object.entries(seeds).slice(0, MAX_CUSTOM_SECTIONS_PER_PAGE)) {
      if (!customs.has(id)) continue;
      await client.query(
        `INSERT INTO marketing_sections (id, config, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, JSON.stringify(normalizeSection(id, config))]
      );
    }
    await pruneOrphanCustomSections(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return layout;
}

/** Back to code order with everything shown; removes this page's added sections. */
export async function resetPageLayout(page: MarketingPageId): Promise<PageLayout> {
  await ensureSchemaReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM marketing_sections WHERE id = $1", [layoutRowId(page)]);
    await pruneOrphanCustomSections(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return defaultLayout(page);
}

/** Removes the saved row so the section renders its defaults again. */
export async function resetMarketingSection(id: string): Promise<SectionConfig> {
  await ensureSchemaReady();
  await getPool().query("DELETE FROM marketing_sections WHERE id = $1", [id]);
  return normalizeSection(id, null);
}

export async function saveMarketingSection(
  id: string,
  input: unknown
): Promise<SectionConfig> {
  const config = normalizeSection(id, input);
  await ensureSchemaReady();
  await getPool().query(
    `INSERT INTO marketing_sections (id, config, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE
       SET config = EXCLUDED.config, updated_at = NOW()`,
    [id, JSON.stringify(config)]
  );
  return config;
}

export async function replaceMarketingMediaPath(from: string, to: string): Promise<number> {
  const copy = await loadMarketingCopy();
  let updated = 0;
  for (const [id, config] of Object.entries(copy)) {
    const next = replaceSectionMedia(config, from, to);
    if (!next.changed) continue;
    await saveMarketingSection(id, next.config);
    updated += 1;
  }
  return updated;
}

export function localMarketingPathsInUse(): Promise<{ path: string; kind: "image" | "video" }[]> {
  return loadMarketingCopy().then((copy) => localMarketingPaths(copy));
}
