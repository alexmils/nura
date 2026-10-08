/**
 * Durable Meta / Google Ads report cache. Payloads are campaign stats only.
 * Access tokens and developer tokens are stripped before insert.
 */

import {
  stripAdsCacheSecrets,
  type AdsReportStore,
} from "@/lib/admin-ads-cache";
import { ensureSchemaReady, getPool } from "@/lib/db";

type CacheRow = { payload: unknown; fetched_at: Date | string };

const memory = new Map<string, { at: number; data: unknown }>();

let schemaDone = false;
let schemaInflight: Promise<void> | null = null;

async function ensureAdminAdsCacheSchema(): Promise<void> {
  if (schemaDone) return;
  if (!schemaInflight) {
    schemaInflight = (async () => {
      await ensureSchemaReady();
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS admin_ads_cache (
          cache_key TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          fetched_at TIMESTAMPTZ NOT NULL
        )
      `);
      schemaDone = true;
    })().finally(() => {
      if (!schemaDone) schemaInflight = null;
    });
  }
  await schemaInflight;
}

function asPayload<T>(raw: unknown): T {
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}

export async function readAdsReport<T>(key: string): Promise<{ at: number; data: T } | null> {
  const mem = memory.get(key);
  if (mem) return { at: mem.at, data: mem.data as T };
  try {
    await ensureAdminAdsCacheSchema();
    const { rows } = await getPool().query<CacheRow>(
      "SELECT payload, fetched_at FROM admin_ads_cache WHERE cache_key = $1",
      [key]
    );
    const row = rows[0];
    if (!row) return null;
    const at = new Date(row.fetched_at).getTime();
    if (!Number.isFinite(at)) return null;
    const data = stripAdsCacheSecrets(asPayload<T>(row.payload));
    memory.set(key, { at, data });
    return { at, data };
  } catch (err) {
    console.error("[admin-ads-cache] read failed", err);
    return null;
  }
}

export async function writeAdsReport(key: string, data: unknown, at: number): Promise<void> {
  const safe = stripAdsCacheSecrets(data);
  memory.set(key, { at, data: safe });
  await ensureAdminAdsCacheSchema();
  await getPool().query(
    `INSERT INTO admin_ads_cache (cache_key, payload, fetched_at)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (cache_key) DO UPDATE
     SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
    [key, JSON.stringify(safe), new Date(at).toISOString()]
  );
}

export const postgresAdsReportStore: AdsReportStore = {
  read: readAdsReport,
  write: writeAdsReport,
};
