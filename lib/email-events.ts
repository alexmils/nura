import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  emailLogTemplateIds,
  type EmailLogAudience,
} from "@/lib/email/template-labels";

export type EmailEventStatus = "sent" | "failed";

export type EmailEvent = {
  id: string;
  toEmail: string;
  templateId: string | null;
  provider: string | null;
  status: EmailEventStatus;
  error: string | null;
  createdAt: string;
};

export async function ensureEmailEventsSchema() {
  await ensureSchemaReady();
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS email_events (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      template_id TEXT,
      provider TEXT,
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);
  `);
}

export async function logEmailEvent(input: {
  toEmail: string;
  templateId?: string | null;
  provider?: string | null;
  status: EmailEventStatus;
  error?: string | null;
}) {
  await ensureEmailEventsSchema();
  await getPool().query(
    `INSERT INTO email_events (id, to_email, template_id, provider, status, error, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      crypto.randomUUID(),
      input.toEmail,
      input.templateId ?? null,
      input.provider ?? null,
      input.status,
      input.error ?? null,
    ]
  );
}

export async function listEmailEvents(options?: {
  limit?: number;
  status?: EmailEventStatus;
  audience?: EmailLogAudience;
  days?: number;
}): Promise<EmailEvent[]> {
  await ensureEmailEventsSchema();
  const limit = Math.min(200, Math.max(1, options?.limit ?? 50));
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options?.status) {
    conditions.push(`status = $${idx++}`);
    params.push(options.status);
  }
  if (options?.audience === "admin" || options?.audience === "user") {
    conditions.push(`template_id = ANY($${idx++}::text[])`);
    params.push(emailLogTemplateIds(options.audience));
  }
  if (options?.days) {
    conditions.push(`created_at >= NOW() - ($${idx++}::int || ' days')::interval`);
    params.push(options.days);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

  const { rows } = await getPool().query<{
    id: string;
    to_email: string;
    template_id: string | null;
    provider: string | null;
    status: EmailEventStatus;
    error: string | null;
    created_at: string;
  }>(
    `SELECT id, to_email, template_id, provider, status, error, created_at
     FROM email_events ${where}
     ORDER BY created_at DESC
     LIMIT $${idx}`,
    params
  );

  return rows.map((r) => ({
    id: r.id,
    toEmail: r.to_email,
    templateId: r.template_id,
    provider: r.provider,
    status: r.status,
    error: r.error,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
