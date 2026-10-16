import { cache } from "react";
import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  defaultMarketingCopy,
  isMarketingSectionId,
  localMarketingPaths,
  normalizeSection,
  replaceSectionMedia,
  type SectionConfig,
} from "@/lib/marketing-sections";

/** Saved marketing copy merged over defaults. Missing rows stay on the defaults. */
export const loadMarketingCopy = cache(async (): Promise<Record<string, SectionConfig>> => {
  const out = defaultMarketingCopy();
  try {
    await ensureSchemaReady();
    const { rows } = await getPool().query<{ id: string; config: unknown }>(
      "SELECT id, config FROM marketing_sections"
    );
    for (const row of rows) {
      if (!isMarketingSectionId(row.id)) continue;
      out[row.id] = normalizeSection(row.id, row.config);
    }
  } catch (err) {
    console.error("[marketing-sections] load failed", err);
  }
  return out;
});

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
