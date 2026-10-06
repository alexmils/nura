import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  ADMIN_TASK_STATUSES,
  type AdminTask,
  type AdminTaskStatus,
  MAX_IMAGES_PER_TASK,
  normalizeTaskBody,
  normalizeTaskLabel,
  normalizeTaskStatus,
} from "@/lib/admin-tasks";
import { unlinkTaskImageUrl } from "@/lib/admin-tasks-media";

let schemaDone = false;

function parseImageUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return parseImageUrls(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function coerceStatus(raw: unknown): AdminTaskStatus {
  const s = String(raw || "pending");
  try {
    return normalizeTaskStatus(s);
  } catch {
    return "pending";
  }
}

function mapRow(row: Record<string, unknown>): AdminTask {
  return {
    id: String(row.id),
    body: String(row.body || ""),
    status: coerceStatus(row.status),
    label: row.label != null && String(row.label).trim() ? String(row.label) : null,
    imageUrls: parseImageUrls(row.image_urls),
    sortOrder: Number(row.sort_order || 0),
    createdByUserId:
      row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function ensureAdminTasksSchema(): Promise<void> {
  await ensureSchemaReady();
  if (schemaDone) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS admin_tasks (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      label TEXT,
      image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_admin_tasks_status
      ON admin_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_admin_tasks_updated
      ON admin_tasks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_tasks_label
      ON admin_tasks(label);
  `);
  schemaDone = true;
}

export async function listAdminTasks(opts?: {
  status?: string;
  label?: string;
  q?: string;
}): Promise<{ items: AdminTask[]; labels: string[] }> {
  await ensureAdminTasksSchema();
  const db = getPool();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts?.status && opts.status !== "all") {
    params.push(normalizeTaskStatus(opts.status));
    clauses.push(`status = $${params.length}`);
  }
  if (opts?.label?.trim()) {
    params.push(opts.label.trim());
    clauses.push(`label = $${params.length}`);
  }
  if (opts?.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    clauses.push(`body ILIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT * FROM admin_tasks ${where}
     ORDER BY sort_order ASC, updated_at DESC, id DESC
     LIMIT 500`,
    params
  );
  const labelRes = await db.query(
    `SELECT DISTINCT label FROM admin_tasks
     WHERE label IS NOT NULL AND BTRIM(label) <> ''
     ORDER BY label ASC`
  );
  return {
    items: rows.map((r) => mapRow(r as Record<string, unknown>)),
    labels: labelRes.rows
      .map((r) => String((r as { label: string }).label || "").trim())
      .filter(Boolean),
  };
}

export async function getAdminTask(id: string): Promise<AdminTask | null> {
  await ensureAdminTasksSchema();
  const { rows } = await getPool().query(
    `SELECT * FROM admin_tasks WHERE id = $1`,
    [id]
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export async function createAdminTask(input: {
  body: string;
  status?: string;
  label?: string | null;
  createdByUserId?: string | null;
}): Promise<AdminTask> {
  await ensureAdminTasksSchema();
  const id = crypto.randomUUID();
  const body = normalizeTaskBody(input.body);
  const status = normalizeTaskStatus(input.status);
  const label = normalizeTaskLabel(input.label);
  const { rows } = await getPool().query(
    `INSERT INTO admin_tasks (id, body, status, label, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, body, status, label, input.createdByUserId ?? null]
  );
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function updateAdminTask(
  id: string,
  patch: {
    body?: string;
    status?: string;
    label?: string | null;
    sortOrder?: number;
    clearImages?: boolean;
    removeImageUrl?: string;
  }
): Promise<AdminTask | null> {
  await ensureAdminTasksSchema();
  const existing = await getAdminTask(id);
  if (!existing) return null;

  let imageUrls = [...existing.imageUrls];
  if (patch.clearImages) {
    for (const url of imageUrls) await unlinkTaskImageUrl(url);
    imageUrls = [];
  } else if (patch.removeImageUrl) {
    const target = patch.removeImageUrl.trim();
    if (imageUrls.includes(target)) {
      imageUrls = imageUrls.filter((u) => u !== target);
      await unlinkTaskImageUrl(target);
    }
  }

  const body =
    patch.body !== undefined ? normalizeTaskBody(patch.body) : existing.body;
  const status =
    patch.status !== undefined
      ? normalizeTaskStatus(patch.status)
      : existing.status;
  const label =
    patch.label !== undefined
      ? normalizeTaskLabel(patch.label)
      : existing.label;
  const sortOrder =
    patch.sortOrder !== undefined
      ? Number(patch.sortOrder)
      : existing.sortOrder;

  const { rows } = await getPool().query(
    `UPDATE admin_tasks
     SET body = $2, status = $3, label = $4, image_urls = $5::jsonb,
         sort_order = $6, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, body, status, label, JSON.stringify(imageUrls), sortOrder]
  );
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function appendAdminTaskImage(
  id: string,
  imageUrl: string
): Promise<AdminTask | null> {
  await ensureAdminTasksSchema();
  const existing = await getAdminTask(id);
  if (!existing) return null;
  if (existing.imageUrls.length >= MAX_IMAGES_PER_TASK) {
    throw new Error(`At most ${MAX_IMAGES_PER_TASK} images per task.`);
  }
  const imageUrls = [...existing.imageUrls, imageUrl];
  const { rows } = await getPool().query(
    `UPDATE admin_tasks
     SET image_urls = $2::jsonb, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(imageUrls)]
  );
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function deleteAdminTask(id: string): Promise<boolean> {
  await ensureAdminTasksSchema();
  const existing = await getAdminTask(id);
  if (!existing) return false;
  await getPool().query(`DELETE FROM admin_tasks WHERE id = $1`, [id]);
  for (const url of existing.imageUrls) {
    await unlinkTaskImageUrl(url);
  }
  return true;
}

export function isAdminTaskStatus(value: string): value is AdminTaskStatus {
  return (ADMIN_TASK_STATUSES as readonly string[]).includes(value);
}
