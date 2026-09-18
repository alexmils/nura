import { createHash, randomBytes } from "crypto";
import { getPool, ensureSchemaReady } from "@/lib/db";

export type AuthTokenType = "reset" | "invite";

const EXPIRY_HOURS: Record<AuthTokenType, number> = {
  reset: 1,
  invite: 72,
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createAuthToken(
  userId: string,
  type: AuthTokenType
): Promise<string> {
  await ensureSchemaReady();
  const raw = generateRawToken();
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + EXPIRY_HOURS[type] * 60 * 60 * 1000
  ).toISOString();

  await getPool().query(
    `INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, type, hashToken(raw), expiresAt, new Date().toISOString()]
  );

  return raw;
}

/** Newest still-usable token of a type, for throttling repeat emails. */
export async function latestAuthTokenAt(
  userId: string,
  type: AuthTokenType
): Promise<string | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ created_at: string }>(
    `SELECT created_at FROM auth_tokens
     WHERE user_id = $1 AND type = $2 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, type]
  );
  return rows[0] ? new Date(rows[0].created_at).toISOString() : null;
}

export async function consumeAuthToken(
  raw: string,
  type: AuthTokenType
): Promise<{ userId: string } | null> {
  await ensureSchemaReady();
  const tokenHash = hashToken(raw);
  const { rows } = await getPool().query<{
    id: string;
    user_id: string;
    expires_at: string;
    used_at: string | null;
  }>(
    `SELECT id, user_id, expires_at, used_at FROM auth_tokens
     WHERE token_hash = $1 AND type = $2`,
    [tokenHash, type]
  );

  const row = rows[0];
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  await getPool().query(
    "UPDATE auth_tokens SET used_at = $1 WHERE id = $2",
    [new Date().toISOString(), row.id]
  );

  return { userId: row.user_id };
}
