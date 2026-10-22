/**
 * The one-use credential behind a review email.
 *
 * The raw token lives only in the link; the database stores its SHA-256 hash,
 * so a leaked table cannot be turned back into working links. One active invite
 * per member: creating a new one invalidates the old unused link, which is what
 * makes "send it again" safe.
 */

import { createHash, randomBytes, randomUUID } from "crypto";
import { ensureSchemaReady, getPool } from "@/lib/db";

/** Tokens shorter than this cannot be a real invite (or a useful guess). */
const MIN_TOKEN_LENGTH = 20;
const MAX_TOKEN_LENGTH = 200;
const INVITE_DAYS = 180;

let schemaDone = false;

export async function ensureReviewInviteSchema(): Promise<void> {
  await ensureSchemaReady();
  if (schemaDone) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS review_invites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_review_invites_user
      ON review_invites(user_id, created_at DESC);
  `);
  schemaDone = true;
}

export function isPlausibleReviewToken(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const token = value.trim();
  return token.length >= MIN_TOKEN_LENGTH && token.length <= MAX_TOKEN_LENGTH;
}

export function hashReviewToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export async function createReviewInvite(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  await ensureReviewInviteSchema();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  const pool = getPool();

  // A new ask replaces the unanswered old one. Completed reviews keep their
  // row, so the admin can still see when a link was used.
  await pool.query(
    `DELETE FROM review_invites WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
  await pool.query(
    `INSERT INTO review_invites (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, hashReviewToken(token), expiresAt]
  );

  return { token, expiresAt };
}

export type ReviewInviteInfo = {
  userId: string;
  expiresAt: string;
  usedAt: string | null;
};

export async function reviewInviteByToken(
  raw: string | null | undefined
): Promise<ReviewInviteInfo | null> {
  if (!isPlausibleReviewToken(raw)) return null;
  await ensureReviewInviteSchema();
  const { rows } = await getPool().query<{
    user_id: string;
    expires_at: Date;
    used_at: Date | null;
  }>(
    `SELECT user_id, expires_at, used_at
     FROM review_invites WHERE token_hash = $1`,
    [hashReviewToken(raw)]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    expiresAt: new Date(row.expires_at).toISOString(),
    usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
  };
}
