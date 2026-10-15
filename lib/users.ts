import { getPool, ensureSchemaReady } from "@/lib/db";
import type { UserRole } from "@/lib/roles";

export type UserStatus = "active" | "disabled";

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  emailVerified: boolean;
  googleSub: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  onboardingCompletedAt: string | null;
  marketingEmailOptIn: boolean;
  marketingEmailOptInAt: string | null;
  brevoContactSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeRole(value: unknown): UserRole {
  if (value === "platform_admin" || value === "support") return value;
  return "user";
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    passwordHash: (row.password_hash as string) ?? null,
    emailVerified: Boolean(row.email_verified),
    googleSub: (row.google_sub as string) ?? null,
    role: normalizeRole(row.role),
    status: row.status === "disabled" ? "disabled" : "active",
    lastLoginAt: row.last_login_at
      ? new Date(row.last_login_at as string).toISOString()
      : null,
    onboardingCompletedAt: row.onboarding_completed_at
      ? new Date(row.onboarding_completed_at as string).toISOString()
      : null,
    marketingEmailOptIn: Boolean(row.marketing_email_opt_in),
    marketingEmailOptInAt: row.marketing_email_opt_in_at
      ? new Date(row.marketing_email_opt_in_at as string).toISOString()
      : null,
    brevoContactSyncedAt: row.brevo_contact_synced_at
      ? new Date(row.brevo_contact_synced_at as string).toISOString()
      : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    role: user.role,
    status: user.status,
    hasPassword: Boolean(user.passwordHash),
    onboardingCompletedAt: user.onboardingCompletedAt,
    marketingEmailOptIn: user.marketingEmailOptIn,
  };
}

export async function markOnboardingCompleted(userId: string): Promise<User | null> {
  await ensureSchemaReady();
  await getPool().query(
    `UPDATE users
     SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  return getUserById(userId);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_get_user_by_email($1)",
    [email.trim()]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_get_user_by_id($1)",
    [id]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

/** Lightweight session lookup — no SECURITY DEFINER round-trip. */
export async function getUserSessionById(id: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
} | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string | null;
  }>(
    "SELECT id, email, name, role, status FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normalizeRole(row.role),
    status: row.status === "disabled" ? "disabled" : "active",
  };
}

export async function setUserStatus(
  userId: string,
  status: UserStatus
): Promise<void> {
  await ensureSchemaReady();
  await getPool().query(
    "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2",
    [status, userId]
  );
}

export async function createUser(
  email: string,
  name?: string,
  role: UserRole = "user"
): Promise<User> {
  await ensureSchemaReady();
  const id = crypto.randomUUID();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_create_user($1, $2, $3, $4)",
    [id, email.trim(), name ?? "", role]
  );
  return rowToUser(rows[0]);
}

export async function setUserPassword(userId: string, passwordHash: string) {
  await ensureSchemaReady();
  await getPool().query("SELECT auth_set_user_password($1, $2)", [
    userId,
    passwordHash,
  ]);
}

/** Mark email verified (Google OAuth); fill empty name from provider. */
export async function markEmailVerified(
  userId: string,
  name?: string | null
): Promise<User | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_mark_email_verified($1, $2)",
    [userId, name?.trim() || null]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserByGoogleSub(sub: string): Promise<User | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_get_user_by_google_sub($1)",
    [sub]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

/** Link Google subject, verify email, fill empty name. */
export async function linkGoogleAccount(
  userId: string,
  googleSub: string,
  name?: string | null
): Promise<User | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_link_google($1, $2, $3)",
    [userId, googleSub, name?.trim() || null]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function upsertPlatformAdmin(
  email: string,
  passwordHash: string,
  name?: string
): Promise<User> {
  await ensureSchemaReady();
  const id = crypto.randomUUID();
  const { rows } = await getPool().query(
    "SELECT * FROM auth_upsert_platform_admin($1, $2, $3, $4)",
    [id, email.trim(), name ?? "", passwordHash]
  );
  return rowToUser(rows[0]);
}

export async function countUsers(): Promise<number> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users"
  );
  return Number(rows[0]?.count ?? 0);
}

const AVATAR_MAX_CHARS = 180_000; // ~135KB base64 data URL

export function isValidAvatarDataUrl(value: string): boolean {
  if (!value.startsWith("data:image/")) return false;
  if (value.length > AVATAR_MAX_CHARS) return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);
}

export async function updateUserProfile(
  userId: string,
  patch: { name?: string | null; avatarUrl?: string | null }
): Promise<User | null> {
  await ensureSchemaReady();
  const existing = await getUserById(userId);
  if (!existing) return null;

  const name =
    patch.name !== undefined
      ? patch.name?.trim() || null
      : existing.name;
  const avatarUrl =
    patch.avatarUrl !== undefined ? patch.avatarUrl : existing.avatarUrl;

  if (avatarUrl && !isValidAvatarDataUrl(avatarUrl)) {
    throw new Error("Invalid avatar image");
  }

  await getPool().query(
    `UPDATE users SET name = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3`,
    [name, avatarUrl, userId]
  );
  return getUserById(userId);
}
