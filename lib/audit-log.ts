import { ensureSchemaReady, getPool } from "@/lib/db";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.invited"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.password_set"
  | "user.password_reset_requested"
  | "user.disabled"
  | "user.enabled"
  | "settings.platform_updated"
  | "settings.email_updated"
  | "settings.stripe_updated"
  | "settings.stripe_synced"
  | "email.test_sent"
  | "email.broadcast_sent"
  | "blog.post_created"
  | "blog.post_updated"
  | "blog.post_deleted";

export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  action: AuditAction;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
};

export async function ensureAuditSchema() {
  await ensureSchemaReady();
}

export async function writeAuditEvent(input: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: AuditAction;
  detail?: Record<string, unknown>;
  ip?: string | null;
}) {
  await ensureAuditSchema();
  await getPool().query(
    `INSERT INTO audit_events (id, actor_user_id, target_user_id, action, detail, ip, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      crypto.randomUUID(),
      input.actorUserId ?? null,
      input.targetUserId ?? null,
      input.action,
      input.detail ? JSON.stringify(input.detail) : null,
      input.ip ?? null,
    ]
  );
}

export async function listAuditEvents(options?: {
  limit?: number;
  action?: string;
  search?: string;
  offset?: number;
}): Promise<AuditEvent[]> {
  await ensureAuditSchema();
  const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
  const offset = Math.max(0, options?.offset ?? 0);
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options?.action) {
    conditions.push(`e.action = $${idx++}`);
    params.push(options.action);
  }
  if (options?.search?.trim()) {
    conditions.push(
      `(ea.email ILIKE $${idx} OR et.email ILIKE $${idx} OR e.action ILIKE $${idx})`
    );
    params.push(`%${options.search.trim()}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const { rows } = await getPool().query<{
    id: string;
    actor_user_id: string | null;
    actor_email: string | null;
    target_user_id: string | null;
    target_email: string | null;
    action: string;
    detail: Record<string, unknown> | null;
    ip: string | null;
    created_at: string;
  }>(
    `SELECT e.id, e.actor_user_id, ea.email AS actor_email,
            e.target_user_id, et.email AS target_email,
            e.action, e.detail, e.ip, e.created_at
     FROM audit_events e
     LEFT JOIN users ea ON ea.id = e.actor_user_id
     LEFT JOIN users et ON et.id = e.target_user_id
     ${where}
     ORDER BY e.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    targetUserId: r.target_user_id,
    targetEmail: r.target_email,
    action: r.action as AuditAction,
    detail: r.detail,
    ip: r.ip,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function recordUserLogin(userId: string, ip?: string | null) {
  await ensureAuditSchema();
  await getPool().query(
    "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
    [userId]
  );
  await writeAuditEvent({
    actorUserId: userId,
    targetUserId: userId,
    action: "user.login",
    ip,
  });
}

export type UserAuthEvent = {
  id: string;
  action: "user.login" | "user.logout";
  ip: string | null;
  createdAt: string;
};

/** Resolve displayed last login from column and/or audit login events. */
export function resolveLastLoginAt(
  storedLastLoginAt: string | null,
  latestLoginEventAt: string | null
): string | null {
  if (!storedLastLoginAt) return latestLoginEventAt;
  if (!latestLoginEventAt) return storedLastLoginAt;
  return new Date(latestLoginEventAt).getTime() > new Date(storedLastLoginAt).getTime()
    ? latestLoginEventAt
    : storedLastLoginAt;
}

export async function listUserAuthEvents(
  userId: string,
  limit = 50
): Promise<UserAuthEvent[]> {
  await ensureAuditSchema();
  const capped = Math.min(100, Math.max(1, limit));
  const { rows } = await getPool().query<{
    id: string;
    action: string;
    ip: string | null;
    created_at: string;
  }>(
    `SELECT id, action, ip, created_at
     FROM audit_events
     WHERE actor_user_id = $1
       AND action IN ('user.login', 'user.logout')
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, capped]
  );

  return rows.map((r) => ({
    id: r.id,
    action: r.action as "user.login" | "user.logout",
    ip: r.ip,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** If last_login_at is null but login events exist, heal the column. */
export async function healLastLoginFromEvents(userId: string): Promise<string | null> {
  await ensureAuditSchema();
  const { rows } = await getPool().query<{ created_at: string }>(
    `SELECT created_at FROM audit_events
     WHERE actor_user_id = $1 AND action = 'user.login'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const latest = rows[0]?.created_at
    ? new Date(rows[0].created_at).toISOString()
    : null;
  if (!latest) return null;

  await getPool().query(
    `UPDATE users
     SET last_login_at = GREATEST(COALESCE(last_login_at, '-infinity'::timestamptz), $2::timestamptz),
         updated_at = NOW()
     WHERE id = $1
       AND (last_login_at IS NULL OR last_login_at < $2::timestamptz)`,
    [userId, latest]
  );
  return latest;
}

export function clientIp(request: Request): string | null {
  const trustProxy =
    process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return null;
}
