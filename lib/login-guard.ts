import { clientIp } from "@/lib/audit-log";
import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  LOCKOUT_OUTCOMES,
  LOGIN_GUARD_DEFAULTS,
  clampGuardNumber,
  countsAsFailure,
  decideGuard,
  ipListed,
  ipLockable,
  isPrivateOrInternalIp,
  isValidGuardSlug,
  newGuardSlug,
  normalizeGuardEmail,
  normalizeGuardIp,
  normalizeGuardSlug,
  roleMayUseSurface,
  type LoginAttemptOutcome,
} from "@/lib/login-guard-policy";

export type LoginGuardSettings = {
  slug: string;
  path: string;
  maxAttempts: number;
  windowMinutes: number;
  lockMinutes: number;
  whitelist: string[];
  blocklist: string[];
};

export type LoginAttemptRow = {
  id: string;
  createdAt: string;
  ip: string | null;
  email: string | null;
  success: boolean;
  surface: string;
  outcome: string;
};

export type LoginLockRow = {
  subjectKey: string;
  kind: "ip" | "email";
  subject: string;
  failedCount: number;
  lockedUntil: string;
};

type GuardRow = {
  slug: string;
  max_attempts: number;
  window_minutes: number;
  lock_minutes: number;
  whitelist: unknown;
  blocklist: unknown;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toSettings(row: GuardRow): LoginGuardSettings {
  const slug = row.slug;
  return {
    slug,
    path: `/${slug}`,
    maxAttempts: clampGuardNumber(
      row.max_attempts,
      LOGIN_GUARD_DEFAULTS.maxAttempts,
      3,
      50
    ),
    windowMinutes: clampGuardNumber(row.window_minutes, 15, 1, 1440),
    lockMinutes: clampGuardNumber(row.lock_minutes, 30, 1, 10080),
    whitelist: asStringList(row.whitelist),
    blocklist: asStringList(row.blocklist),
  };
}

export async function getLoginGuardSettings(): Promise<LoginGuardSettings> {
  await ensureSchemaReady();
  const pool = getPool();
  const { rows } = await pool.query<GuardRow>(
    `SELECT slug, max_attempts, window_minutes, lock_minutes, whitelist, blocklist
     FROM login_guard WHERE id = 1`
  );
  if (rows[0]) {
    // Addresses generated before the root-level path could contain "_" or
    // uppercase. Lowercase a valid one; rotate one the current rules reject so
    // the gate never points at an address no page can match.
    const stored = rows[0].slug;
    const lower = normalizeGuardSlug(stored);
    if (isValidGuardSlug(lower) && lower === stored) return toSettings(rows[0]);
    const slug = isValidGuardSlug(lower) ? lower : newGuardSlug();
    await pool.query(
      `UPDATE login_guard SET slug = $1, updated_at = NOW() WHERE id = 1`,
      [slug]
    );
    return toSettings({ ...rows[0], slug });
  }

  const slug = newGuardSlug();
  await pool.query(
    `INSERT INTO login_guard (id, slug, max_attempts, window_minutes, lock_minutes)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [
      slug,
      LOGIN_GUARD_DEFAULTS.maxAttempts,
      LOGIN_GUARD_DEFAULTS.windowMinutes,
      LOGIN_GUARD_DEFAULTS.lockMinutes,
    ]
  );
  const again = await pool.query<GuardRow>(
    `SELECT slug, max_attempts, window_minutes, lock_minutes, whitelist, blocklist
     FROM login_guard WHERE id = 1`
  );
  return toSettings(again.rows[0]!);
}

export async function gateSlugMatches(slug: string): Promise<boolean> {
  const candidate = normalizeGuardSlug(slug);
  if (!isValidGuardSlug(candidate)) return false;
  const settings = await getLoginGuardSettings();
  return settings.slug === candidate;
}

export async function saveLoginGuardSettings(input: {
  slug: string;
  maxAttempts: number;
  windowMinutes: number;
  lockMinutes: number;
  whitelist: string[];
  blocklist: string[];
}): Promise<LoginGuardSettings> {
  const slug = normalizeGuardSlug(input.slug);
  await getLoginGuardSettings();
  await getPool().query(
    `UPDATE login_guard
     SET slug = $1,
         max_attempts = $2,
         window_minutes = $3,
         lock_minutes = $4,
         whitelist = $5::jsonb,
         blocklist = $6::jsonb,
         updated_at = NOW()
     WHERE id = 1`,
    [
      slug,
      input.maxAttempts,
      input.windowMinutes,
      input.lockMinutes,
      JSON.stringify(input.whitelist),
      JSON.stringify(input.blocklist),
    ]
  );
  return getLoginGuardSettings();
}

export async function regenerateLoginGuardSlug(): Promise<LoginGuardSettings> {
  const current = await getLoginGuardSettings();
  return saveLoginGuardSettings({
    ...current,
    slug: newGuardSlug(),
  });
}

const INTERNAL_IP_WARN_EVERY_MS = 10 * 60_000;
let lastInternalIpWarnAt = 0;

/**
 * A private client IP means the proxy chain lost the real address (TRUST_PROXY,
 * X-Forwarded-For). One shared IP lock would then block every visitor, so IP
 * locks are skipped and this warns at most every 10 minutes. Email locks stay.
 */
function warnIfInternalIp(ip: string) {
  if (!isPrivateOrInternalIp(ip)) return;
  const now = Date.now();
  if (now - lastInternalIpWarnAt < INTERNAL_IP_WARN_EVERY_MS) return;
  lastInternalIpWarnAt = now;
  console.warn(
    `[login-guard] client IP ${ip} is private/internal; skipping IP lockout. ` +
      "Check TRUST_PROXY and that the proxy chain forwards X-Forwarded-For."
  );
}

async function insertAttempt(input: {
  ip: string;
  email: string;
  success: boolean;
  surface: string;
  outcome: LoginAttemptOutcome;
}) {
  await getPool().query(
    `INSERT INTO login_attempts (ip, email, success, surface, outcome)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.ip,
      input.email || null,
      input.success,
      input.surface,
      input.outcome,
    ]
  );
}

async function failureCount(
  column: "ip" | "email",
  value: string,
  windowMinutes: number
): Promise<number> {
  if (!value || (column === "email" && !value.includes("@"))) return 0;
  const { rows } = await getPool().query<{ c: number }>(
    `SELECT COUNT(*)::int AS c
     FROM login_attempts
     WHERE ${column} = $1
       AND success = FALSE
       AND outcome = ANY($2::text[])
       AND created_at > NOW() - ($3::int * INTERVAL '1 minute')`,
    [
      value,
      [...LOCKOUT_OUTCOMES],
      windowMinutes,
    ]
  );
  return rows[0]?.c ?? 0;
}

async function activeLock(
  kind: "ip" | "email",
  subject: string
): Promise<boolean> {
  if (!subject || (kind === "email" && !subject.includes("@"))) return false;
  const { rows } = await getPool().query<{ locked: boolean }>(
    `SELECT TRUE AS locked FROM login_locks
     WHERE subject_key = $1 AND locked_until > NOW()`,
    [`${kind}:${subject}`]
  );
  return Boolean(rows[0]?.locked);
}

async function upsertLock(
  kind: "ip" | "email",
  subject: string,
  failedCount: number,
  lockMinutes: number
) {
  if (!subject || (kind === "email" && !subject.includes("@"))) return;
  if (kind === "ip" && !ipLockable(subject)) return;
  await getPool().query(
    `INSERT INTO login_locks (subject_key, kind, subject, failed_count, locked_until, updated_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5::int * INTERVAL '1 minute'), NOW())
     ON CONFLICT (subject_key) DO UPDATE
     SET failed_count = EXCLUDED.failed_count,
         locked_until = EXCLUDED.locked_until,
         updated_at = NOW()`,
    [`${kind}:${subject}`, kind, subject, failedCount, lockMinutes]
  );
}

export async function precheckLogin(input: {
  request: Request;
  email?: string;
  surface: "public" | "operator";
}): Promise<
  | { ok: true; ip: string; email: string; whitelisted: boolean }
  | { ok: false; status: 403 | 429; error: string }
> {
  const settings = await getLoginGuardSettings();
  const ip = normalizeGuardIp(clientIp(input.request));
  const email = normalizeGuardEmail(input.email);
  const whitelisted = ipListed(ip, settings.whitelist);
  const ipCountable = ipLockable(ip);
  if (!whitelisted) warnIfInternalIp(ip);
  const [ipFailures, emailFailures, ipLocked, emailLocked] = whitelisted
    ? [0, 0, false, false]
    : await Promise.all([
        ipCountable ? failureCount("ip", ip, settings.windowMinutes) : 0,
        failureCount("email", email, settings.windowMinutes),
        ipCountable ? activeLock("ip", ip) : false,
        activeLock("email", email),
      ]);

  const decision = decideGuard({
    ip,
    whitelist: settings.whitelist,
    blocklist: settings.blocklist,
    maxAttempts: settings.maxAttempts,
    ipFailures,
    emailFailures,
    ipLocked,
    emailLocked,
  });

  if (!decision.allow) {
    if (decision.outcome === "locked" && !ipLocked && !emailLocked) {
      if (ipFailures >= settings.maxAttempts) {
        await upsertLock("ip", ip, ipFailures, settings.lockMinutes);
      }
      if (emailFailures >= settings.maxAttempts) {
        await upsertLock("email", email, emailFailures, settings.lockMinutes);
      }
    }
    await insertAttempt({
      ip,
      email,
      success: false,
      surface: input.surface,
      outcome: decision.outcome,
    });
    return { ok: false, status: decision.status, error: decision.error };
  }

  return { ok: true, ip, email, whitelisted };
}

export async function noteLoginFailure(input: {
  ip: string;
  email: string;
  surface: "public" | "operator";
  outcome: LoginAttemptOutcome;
  whitelisted: boolean;
}) {
  await insertAttempt({
    ip: input.ip,
    email: input.email,
    success: false,
    surface: input.surface,
    outcome: input.outcome,
  });
  if (input.whitelisted || !countsAsFailure(input.outcome)) return;

  const settings = await getLoginGuardSettings();
  const [ipFailures, emailFailures] = await Promise.all([
    failureCount("ip", input.ip, settings.windowMinutes),
    failureCount("email", input.email, settings.windowMinutes),
  ]);
  if (ipLockable(input.ip) && ipFailures >= settings.maxAttempts) {
    await upsertLock("ip", input.ip, ipFailures, settings.lockMinutes);
  }
  if (emailFailures >= settings.maxAttempts) {
    await upsertLock("email", input.email, emailFailures, settings.lockMinutes);
  }
}

export async function noteLoginSuccess(input: {
  ip: string;
  email: string;
  surface: "public" | "operator";
  whitelisted: boolean;
}) {
  await insertAttempt({
    ip: input.ip,
    email: input.email,
    success: true,
    surface: input.surface,
    outcome: "ok",
  });
  if (input.whitelisted) return;
  const keys = [`ip:${input.ip}`];
  if (input.email.includes("@")) keys.push(`email:${input.email}`);
  await getPool().query(`DELETE FROM login_locks WHERE subject_key = ANY($1::text[])`, [
    keys,
  ]);
}

export async function staffGateAccepted(gate: string | undefined): Promise<boolean> {
  const candidate = normalizeGuardSlug(gate ?? "");
  if (!candidate || !isValidGuardSlug(candidate)) return false;
  const settings = await getLoginGuardSettings();
  return settings.slug === candidate;
}

export async function surfaceForGate(
  gate: string | undefined
): Promise<"public" | "operator"> {
  return (await staffGateAccepted(gate)) ? "operator" : "public";
}

export function sessionAllowedForRole(
  role: string | null | undefined,
  gateAccepted: boolean
): boolean {
  return roleMayUseSurface(role, gateAccepted);
}

export async function listLoginAttempts(limit = 100): Promise<LoginAttemptRow[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    id: string;
    created_at: Date;
    ip: string | null;
    email: string | null;
    success: boolean;
    surface: string;
    outcome: string;
  }>(
    `SELECT id::text, created_at, ip, email, success, surface, outcome
     FROM login_attempts
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(200, Math.max(1, limit))]
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at.toISOString(),
    ip: row.ip,
    email: row.email,
    success: row.success,
    surface: row.surface,
    outcome: row.outcome,
  }));
}

export async function listLoginLocks(): Promise<LoginLockRow[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    subject_key: string;
    kind: string;
    subject: string;
    failed_count: number;
    locked_until: Date;
  }>(
    `SELECT subject_key, kind, subject, failed_count, locked_until
     FROM login_locks
     WHERE locked_until > NOW()
     ORDER BY locked_until ASC`
  );
  return rows.map((row) => ({
    subjectKey: row.subject_key,
    kind: row.kind === "email" ? "email" : "ip",
    subject: row.subject,
    failedCount: row.failed_count,
    lockedUntil: row.locked_until.toISOString(),
  }));
}

export async function unlockLoginSubject(subjectKey: string): Promise<void> {
  await ensureSchemaReady();
  await getPool().query(`DELETE FROM login_locks WHERE subject_key = $1`, [
    subjectKey,
  ]);
}
