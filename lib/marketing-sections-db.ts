import { cache } from "react";
import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  defaultMarketingCopy,
  isMarketingSectionId,
  normalizeSection,
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
