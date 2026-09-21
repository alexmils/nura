import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type {
  AppSettings,
  Memory,
  Message,
  Thread,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  DEFAULT_PLATFORM_SETTINGS,
} from "./platform-settings";
import { ensureAuthFunctions } from "./auth/db-auth";
import { ensureRlsPolicies } from "./rls-policies";
import { dbQuery } from "./rls";
import { getRlsContext } from "./rls";
import { formatMemoryContext } from "./memory-context";

let pool: Pool | null = null;
let schemaDone = false;
let schemaInflight: Promise<void> | null = null;

/** Postgres advisory lock — serializes DDL across concurrent requests/workers. */
const SCHEMA_LOCK_ID = 74829101;

function isConcurrentCatalogError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("tuple concurrently updated");
}

export function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Start Postgres (docker compose up -d) or set a connection string in .env"
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

/**
 * Hold advisory lock + run all DDL on the SAME connection.
 * pool.query() would release the connection after each statement and break the lock.
 */
async function ensureSchema() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_ID]);
    try {
      await runSchemaMigrations(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_ID]);
    }
  } finally {
    client.release();
  }
}

async function runSchemaMigrations(db: PoolClient) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('reset', 'invite')),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'grounding',
      target TEXT,
      negative_cognition TEXT,
      positive_cognition TEXT,
      suds INTEGER,
      voc INTEGER,
      summary TEXT,
      incomplete BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    -- Retired: memory sets / per-thread toggles (account-scoped flat notes only).
    DROP TABLE IF EXISTS thread_memory_sets CASCADE;
    DROP TABLE IF EXISTS memory_set_items CASCADE;
    DROP TABLE IF EXISTS memory_sets CASCADE;
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      json JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      renews_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      detail JSONB,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports JSONB NOT NULL DEFAULT '[]'::jsonb,
      device_type TEXT NOT NULL DEFAULT 'singleDevice',
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      friendly_name TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);
    CREATE TABLE IF NOT EXISTS client_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      presenting_problem TEXT,
      history_notes TEXT,
      triggers TEXT,
      resources TEXT,
      goals TEXT,
      risk_notes TEXT,
      red_flag BOOLEAN NOT NULL DEFAULT FALSE,
      intake_completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      doc_version TEXT NOT NULL,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip TEXT,
      user_agent TEXT,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_consents_user_type
      ON consents(user_id, doc_type, accepted_at DESC);
  `);

  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_stripe_event_at TIMESTAMPTZ;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_livemode BOOLEAN;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS trial_usage (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      guided_sessions_used INTEGER NOT NULL DEFAULT 0,
      bls_seconds_used INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS trial_guided_ledger (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      thread_id TEXT NOT NULL,
      consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, thread_id)
    );
    CREATE INDEX IF NOT EXISTS idx_trial_guided_ledger_user
      ON trial_guided_ledger(user_id);
    CREATE TABLE IF NOT EXISTS trial_bls_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seconds INTEGER NOT NULL CHECK (seconds > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_trial_bls_ledger_user
      ON trial_bls_ledger(user_id);
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_event_id TEXT UNIQUE,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      description TEXT,
      invoice_id TEXT,
      subscription_id TEXT,
      livemode BOOLEAN,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_billing_events_user_occurred
      ON billing_events(user_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created
      ON audit_events(actor_user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS llm_usage_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      purpose TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd_micros BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created
      ON llm_usage_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_llm_usage_created
      ON llm_usage_events(created_at DESC);
    CREATE TABLE IF NOT EXISTS user_attribution (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      gclid TEXT,
      gbraid TEXT,
      wbraid TEXT,
      fbclid TEXT,
      fbc TEXT,
      fbp TEXT,
      ga_client_id TEXT,
      landing_page TEXT,
      referrer TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_term TEXT,
      utm_content TEXT,
      consent_analytics BOOLEAN,
      consent_marketing BOOLEAN,
      captured_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversion_dispatches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      event_name TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      value_cents INTEGER,
      currency TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (channel, transaction_id)
    );
    CREATE INDEX IF NOT EXISTS idx_conversion_dispatches_created
      ON conversion_dispatches(created_at DESC);
  `);

  // One-time only — never re-run on every boot (that falsely marked new
  // self-registered users as legacy and skipped onboarding/payment).
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows: legacyMig } = await db.query<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = 'legacy_grandfather_v2'`
  );
  if (!legacyMig.length) {
    // Grandfather invited/seeded password users (not self-register).
    await db.query(`
      UPDATE users u
      SET onboarding_completed_at = COALESCE(u.onboarding_completed_at, u.created_at)
      WHERE u.role = 'user'
        AND u.password_hash IS NOT NULL
        AND u.onboarding_completed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM audit_events ae
          WHERE ae.target_user_id = u.id
            AND ae.action = 'user.created'
            AND COALESCE(ae.detail->>'source', '') = 'self_register'
        )
    `);
    await db.query(`
      INSERT INTO subscriptions (
        user_id, plan, status, amount_cents, currency, access_tier, created_at, updated_at
      )
      SELECT u.id, 'legacy', 'legacy', 0, 'USD', 'legacy', NOW(), NOW()
      FROM users u
      WHERE u.role = 'user'
        AND u.password_hash IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
        AND NOT EXISTS (
          SELECT 1 FROM audit_events ae
          WHERE ae.target_user_id = u.id
            AND ae.action = 'user.created'
            AND COALESCE(ae.detail->>'source', '') = 'self_register'
        )
    `);
    await db.query(`
      UPDATE subscriptions s
      SET access_tier = 'legacy',
          status = CASE WHEN s.status = 'active' AND s.plan = 'free' THEN 'legacy' ELSE s.status END,
          plan = CASE WHEN s.plan = 'free' THEN 'legacy' ELSE s.plan END,
          updated_at = NOW()
      FROM users u
      WHERE s.user_id = u.id
        AND u.role = 'user'
        AND u.password_hash IS NOT NULL
        AND u.onboarding_completed_at IS NOT NULL
        AND s.stripe_subscription_id IS NULL
        AND s.stripe_customer_id IS NULL
        AND s.access_tier = 'none'
        AND NOT EXISTS (
          SELECT 1 FROM audit_events ae
          WHERE ae.target_user_id = u.id
            AND ae.action = 'user.created'
            AND COALESCE(ae.detail->>'source', '') = 'self_register'
        )
    `);

    // Repair: self-registered users wrongly granted legacy by the old boot loop.
    await db.query(`
      UPDATE users u
      SET onboarding_completed_at = NULL,
          updated_at = NOW()
      WHERE u.role = 'user'
        AND EXISTS (
          SELECT 1 FROM audit_events ae
          WHERE ae.target_user_id = u.id
            AND ae.action = 'user.created'
            AND COALESCE(ae.detail->>'source', '') = 'self_register'
        )
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.user_id = u.id
            AND (
              s.stripe_subscription_id IS NOT NULL
              OR s.stripe_customer_id IS NOT NULL
            )
        )
    `);
    await db.query(`
      UPDATE subscriptions s
      SET access_tier = 'none',
          status = 'none',
          plan = 'free',
          updated_at = NOW()
      FROM users u
      WHERE s.user_id = u.id
        AND u.role = 'user'
        AND s.stripe_subscription_id IS NULL
        AND s.stripe_customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM audit_events ae
          WHERE ae.target_user_id = u.id
            AND ae.action = 'user.created'
            AND COALESCE(ae.detail->>'source', '') = 'self_register'
        )
    `);

    await db.query(
      `INSERT INTO schema_migrations (id) VALUES ('legacy_grandfather_v2')`
    );
  }

  await db.query(`
    DO $$ BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('platform_admin', 'support', 'user'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await db.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_status_check
        CHECK (status IN ('active', 'disabled'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'guided';
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS intake_complete BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS agent_language TEXT;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS set_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS last_set_outcome TEXT;
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_threads_user ON threads(user_id);
    CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
      ON users(google_sub) WHERE google_sub IS NOT NULL;
  `);

  const { rows } = await db.query<{ json: unknown }>(
    "SELECT json FROM app_settings WHERE id = 1"
  );
  const legacyUserSettings =
    rows[0]?.json &&
    typeof rows[0].json === "object" &&
    "autoVoice" in (rows[0].json as Record<string, unknown>) &&
    !("siteName" in (rows[0].json as Record<string, unknown>));

  if (!rows.length || legacyUserSettings) {
    await db.query(
      `INSERT INTO app_settings (id, json) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json`,
      [JSON.stringify(DEFAULT_PLATFORM_SETTINGS)]
    );
  }

  await ensureAuthFunctions(db);
  await ensureRlsPolicies(db);
}

async function ensureSchemaWithRetry(attempts = 4): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await ensureSchema();
      return;
    } catch (err) {
      lastErr = err;
      if (!isConcurrentCatalogError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function ensureSchemaReady(): Promise<void> {
  if (schemaDone) return;
  if (!schemaInflight) {
    schemaInflight = ensureSchemaWithRetry()
      .then(() => {
        schemaDone = true;
      })
      .catch((err) => {
        schemaInflight = null;
        throw err;
      });
  }
  await schemaInflight;
}

function rowToThread(row: QueryResultRow): Thread {
  return {
    id: row.id as string,
    title: row.title as string,
    mode: ((row.mode as Thread["mode"]) ?? "guided") as Thread["mode"],
    phase: row.phase as Thread["phase"],
    target: (row.target as string) ?? undefined,
    negativeCognition: (row.negative_cognition as string) ?? undefined,
    positiveCognition: (row.positive_cognition as string) ?? undefined,
    suds: row.suds != null ? Number(row.suds) : undefined,
    voc: row.voc != null ? Number(row.voc) : undefined,
    summary: (row.summary as string) ?? undefined,
    description: (row.description as string) ?? undefined,
    intakeComplete: Boolean(row.intake_complete),
    agentLanguage: (row.agent_language as string) ?? undefined,
    setCount: row.set_count != null ? Number(row.set_count) : undefined,
    lastSetOutcome:
      row.last_set_outcome === "completed" || row.last_set_outcome === "stopped"
        ? (row.last_set_outcome as Thread["lastSetOutcome"])
        : undefined,
    incomplete: Boolean(row.incomplete),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export type ClientProfile = {
  userId: string;
  presentingProblem?: string;
  historyNotes?: string;
  triggers?: string;
  resources?: string;
  goals?: string;
  riskNotes?: string;
  redFlag: boolean;
  intakeCompletedAt?: string;
  updatedAt: string;
};

function rowToClientProfile(row: QueryResultRow): ClientProfile {
  return {
    userId: row.user_id as string,
    presentingProblem: (row.presenting_problem as string) ?? undefined,
    historyNotes: (row.history_notes as string) ?? undefined,
    triggers: (row.triggers as string) ?? undefined,
    resources: (row.resources as string) ?? undefined,
    goals: (row.goals as string) ?? undefined,
    riskNotes: (row.risk_notes as string) ?? undefined,
    redFlag: Boolean(row.red_flag),
    intakeCompletedAt: row.intake_completed_at
      ? new Date(row.intake_completed_at as string).toISOString()
      : undefined,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function getClientProfile(
  userId?: string
): Promise<ClientProfile | null> {
  const uid = userId ?? getRlsContext().userId;
  const { rows } = await dbQuery(
    "SELECT * FROM client_profiles WHERE user_id = $1",
    [uid]
  );
  return rows[0] ? rowToClientProfile(rows[0]) : null;
}

export type ClientProfilePatch = Partial<
  Omit<ClientProfile, "userId" | "updatedAt">
>;

export async function upsertClientProfile(
  patch: ClientProfilePatch,
  userId?: string
): Promise<ClientProfile> {
  const uid = userId ?? getRlsContext().userId;
  const existing = await getClientProfile(uid);
  const now = new Date().toISOString();
  const merged = {
    presentingProblem:
      patch.presentingProblem ?? existing?.presentingProblem ?? null,
    historyNotes: patch.historyNotes ?? existing?.historyNotes ?? null,
    triggers: patch.triggers ?? existing?.triggers ?? null,
    resources: patch.resources ?? existing?.resources ?? null,
    goals: patch.goals ?? existing?.goals ?? null,
    riskNotes: patch.riskNotes ?? existing?.riskNotes ?? null,
    redFlag: patch.redFlag ?? existing?.redFlag ?? false,
    intakeCompletedAt:
      patch.intakeCompletedAt !== undefined
        ? patch.intakeCompletedAt
        : (existing?.intakeCompletedAt ?? null),
  };
  await dbQuery(
    `INSERT INTO client_profiles (
       user_id, presenting_problem, history_notes, triggers, resources,
       goals, risk_notes, red_flag, intake_completed_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (user_id) DO UPDATE SET
       presenting_problem = EXCLUDED.presenting_problem,
       history_notes = EXCLUDED.history_notes,
       triggers = EXCLUDED.triggers,
       resources = EXCLUDED.resources,
       goals = EXCLUDED.goals,
       risk_notes = EXCLUDED.risk_notes,
       red_flag = EXCLUDED.red_flag,
       intake_completed_at = EXCLUDED.intake_completed_at,
       updated_at = EXCLUDED.updated_at`,
    [
      uid,
      merged.presentingProblem,
      merged.historyNotes,
      merged.triggers,
      merged.resources,
      merged.goals,
      merged.riskNotes,
      merged.redFlag,
      merged.intakeCompletedAt,
      now,
    ]
  );
  return (await getClientProfile(uid))!;
}

/** Compact profile text for the guide system prompt. */
export function clientProfileContextBlock(
  profile: ClientProfile | null
): string {
  if (!profile) return "";
  const lines = [
    profile.presentingProblem
      ? `- presenting problem: ${profile.presentingProblem}`
      : null,
    profile.historyNotes ? `- history: ${profile.historyNotes}` : null,
    profile.triggers ? `- triggers: ${profile.triggers}` : null,
    profile.resources ? `- resources: ${profile.resources}` : null,
    profile.goals ? `- goals: ${profile.goals}` : null,
    profile.riskNotes ? `- risk notes: ${profile.riskNotes}` : null,
    profile.redFlag ? `- redFlag: true` : null,
    profile.intakeCompletedAt
      ? `- intake completed: ${profile.intakeCompletedAt}`
      : `- intake completed: no`,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "";
}

export async function listThreads(): Promise<Thread[]> {
  const { userId } = getRlsContext();
  const { rows } = await dbQuery(
    "SELECT * FROM threads WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId]
  );
  return rows.map(rowToThread);
}

export async function getThread(id: string): Promise<Thread | null> {
  const { rows } = await dbQuery("SELECT * FROM threads WHERE id = $1", [id]);
  return rows[0] ? rowToThread(rows[0]) : null;
}

export async function createThread(title: string): Promise<Thread> {
  const { userId } = getRlsContext();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO threads (id, user_id, title, phase, mode, incomplete, intake_complete, created_at, updated_at)
     VALUES ($1, $2, $3, 'intake', 'pending', TRUE, FALSE, $4, $4)`,
    [id, userId, title, now]
  );
  return (await getThread(id))!;
}

export async function updateThread(
  id: string,
  patch: Partial<Omit<Thread, "id" | "createdAt">>
): Promise<Thread | null> {
  const existing = await getThread(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await dbQuery(
    `UPDATE threads SET title=$1, phase=$2, target=$3, negative_cognition=$4, positive_cognition=$5,
     suds=$6, voc=$7, summary=$8, incomplete=$9, mode=$10, description=$11, intake_complete=$12,
     agent_language=$13, set_count=$14, last_set_outcome=$15, updated_at=$16 WHERE id=$17`,
    [
      merged.title,
      merged.phase,
      merged.target ?? null,
      merged.negativeCognition ?? null,
      merged.positiveCognition ?? null,
      merged.suds ?? null,
      merged.voc ?? null,
      merged.summary ?? null,
      merged.incomplete,
      merged.mode,
      merged.description?.trim() ? merged.description.trim() : null,
      merged.intakeComplete ?? false,
      merged.agentLanguage ?? null,
      merged.setCount ?? 0,
      merged.lastSetOutcome ?? null,
      merged.updatedAt,
      id,
    ]
  );
  return getThread(id);
}

export async function deleteThread(id: string) {
  await dbQuery("DELETE FROM messages WHERE thread_id = $1", [id]);
  await dbQuery("DELETE FROM threads WHERE id = $1", [id]);
}

/**
 * Drop session shells that have nothing to come back to: pending picker tabs,
 * Self-guided sessions (no agent, no chat, nothing but the live set), or intake
 * with no user message and no set started (`intake_complete`).
 *
 * A Self-guided session is deliberately not kept in Recent: its settings are
 * stored per user (`lib/bls-prefs.ts`), so reopening the tab would restore
 * nothing. Pass `exceptId` to keep the tab the user is currently on.
 */
export async function pruneEmptyThreads(
  exceptId?: string | null
): Promise<number> {
  const { userId } = getRlsContext();
  const { rows } = await dbQuery<{ id: string }>(
    `SELECT t.id
     FROM threads t
     WHERE t.user_id = $1
       AND ($2::text IS NULL OR t.id <> $2)
       AND (
         t.mode = 'pending'
         OR (
           t.mode = 'free'
           AND NOT EXISTS (
             SELECT 1 FROM messages m
             WHERE m.thread_id = t.id AND m.role = 'user'
           )
         )
         OR (
           t.phase = 'intake'
           AND COALESCE(t.intake_complete, FALSE) = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM messages m
             WHERE m.thread_id = t.id AND m.role = 'user'
           )
         )
       )`,
    [userId, exceptId ?? null]
  );
  for (const row of rows) {
    await deleteThread(row.id);
  }
  return rows.length;
}

export async function listMessages(threadId: string): Promise<Message[]> {
  const { rows } = await dbQuery(
    "SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC",
    [threadId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    threadId: r.thread_id as string,
    role: r.role as Message["role"],
    content: r.content as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export async function addMessage(
  threadId: string,
  role: Message["role"],
  content: string
): Promise<Message> {
  const msg: Message = {
    id: crypto.randomUUID(),
    threadId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  await dbQuery(
    "INSERT INTO messages (id, thread_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)",
    [msg.id, msg.threadId, msg.role, msg.content, msg.createdAt]
  );
  await dbQuery("UPDATE threads SET updated_at = $1 WHERE id = $2", [
    msg.createdAt,
    threadId,
  ]);
  return msg;
}

/**
 * Rewrite one stored message in place. Used to lock the opening welcome to the
 * language the user actually wrote in (the line is already on screen, so it
 * must not flip back to English once the thread renders as bubbles).
 */
export async function updateMessageContent(
  messageId: string,
  content: string
): Promise<void> {
  await dbQuery("UPDATE messages SET content = $1 WHERE id = $2", [
    content,
    messageId,
  ]);
}

function normalizeUserSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const o = raw as Partial<AppSettings>;
  return { autoVoice: Boolean(o.autoVoice) };
}

export async function getSettings(): Promise<AppSettings> {
  const { userId } = getRlsContext();
  const { rows } = await dbQuery<{ json: unknown }>(
    "SELECT json FROM user_settings WHERE user_id = $1",
    [userId]
  );
  if (!rows[0]) {
    await dbQuery(
      "INSERT INTO user_settings (user_id, json) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, DEFAULT_SETTINGS]
    );
    return { ...DEFAULT_SETTINGS };
  }
  return normalizeUserSettings(rows[0].json);
}

export async function saveSettings(settings: AppSettings) {
  const { userId } = getRlsContext();
  const normalized = normalizeUserSettings(settings);
  await dbQuery(
    `INSERT INTO user_settings (user_id, json) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET json = EXCLUDED.json`,
    [userId, normalized]
  );
}

export async function listMemories(): Promise<Memory[]> {
  const { userId } = getRlsContext();
  const { rows } = await dbQuery(
    "SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export async function createMemory(title: string, body: string): Promise<Memory> {
  const { userId } = getRlsContext();
  const m: Memory = {
    id: crypto.randomUUID(),
    title,
    body,
    createdAt: new Date().toISOString(),
  };
  await dbQuery(
    "INSERT INTO memories (id, user_id, title, body, created_at) VALUES ($1, $2, $3, $4, $5)",
    [m.id, userId, m.title, m.body, m.createdAt]
  );
  return m;
}

export async function createMemories(
  notes: { title: string; body: string }[]
): Promise<Memory[]> {
  const created: Memory[] = [];
  for (const note of notes) {
    created.push(await createMemory(note.title, note.body));
  }
  return created;
}

export async function updateMemory(
  id: string,
  title: string,
  body: string
): Promise<Memory | null> {
  const { userId } = getRlsContext();
  const { rows } = await dbQuery(
    `UPDATE memories SET title = $1, body = $2 WHERE id = $3 AND user_id = $4
     RETURNING id, title, body, created_at`,
    [title, body, id, userId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function deleteMemory(id: string): Promise<boolean> {
  const { userId } = getRlsContext();
  const { rowCount } = await dbQuery(
    "DELETE FROM memories WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Delete every memory note for the current user. Intake profile is unchanged.
 * Scoped by user_id in SQL: safe even where RLS is not enforced (owner role).
 */
export async function clearMemories(): Promise<number> {
  const { userId } = getRlsContext();
  const { rowCount } = await dbQuery("DELETE FROM memories WHERE user_id = $1", [
    userId,
  ]);
  return rowCount ?? 0;
}

/** Account-scoped notes for the guided-chat system prompt (newest first, 3k cap). */
export async function getAccountMemoryContext(): Promise<string> {
  const { userId } = getRlsContext();
  const { rows } = await dbQuery<{ title: string; body: string }>(
    `SELECT title, body FROM memories WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  if (!rows.length) return "";
  const lines = rows.map((row) => `- ${row.title}: ${row.body}`);
  return formatMemoryContext(lines);
}
