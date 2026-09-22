import { ensureSchemaReady, getPool } from "@/lib/db";
import { estimateCostUsdMicros } from "@/lib/llm-pricing";

export type LlmUsagePurpose =
  | "guided_chat"
  | "interpreter"
  | "help"
  | "voice"
  | "memory_extract";

export type LlmUsageTotals = {
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsdMicros: number;
};

export type UserLlmUsageRow = {
  userId: string;
  email: string;
  name: string | null;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  lastCallAt: string | null;
};

let tableReady = false;

export async function ensureLlmUsageSchema(): Promise<void> {
  await ensureSchemaReady();
  if (tableReady) return;
  await getPool().query(`
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
  `);
  tableReady = true;
}

export async function recordLlmUsage(input: {
  userId: string;
  provider: string;
  model: string;
  purpose: LlmUsagePurpose;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const promptTokens = Math.max(0, Math.floor(input.promptTokens));
  const completionTokens = Math.max(0, Math.floor(input.completionTokens));
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens <= 0 || !input.userId) return;

  const costUsdMicros = estimateCostUsdMicros(
    input.provider,
    input.model,
    promptTokens,
    completionTokens
  );

  await ensureLlmUsageSchema();
  await getPool().query(
    `INSERT INTO llm_usage_events (
       id, user_id, provider, model, purpose,
       prompt_tokens, completion_tokens, total_tokens, cost_usd_micros, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      crypto.randomUUID(),
      input.userId,
      input.provider,
      input.model,
      input.purpose,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsdMicros,
    ]
  );
}

function mapTotals(row: {
  call_count?: number | string | null;
  prompt_tokens?: number | string | null;
  completion_tokens?: number | string | null;
  total_tokens?: number | string | null;
  cost_usd_micros?: number | string | null;
} | undefined): LlmUsageTotals {
  return {
    callCount: Number(row?.call_count ?? 0),
    promptTokens: Number(row?.prompt_tokens ?? 0),
    completionTokens: Number(row?.completion_tokens ?? 0),
    totalTokens: Number(row?.total_tokens ?? 0),
    costUsdMicros: Number(row?.cost_usd_micros ?? 0),
  };
}

export async function getLlmUsageTotals(opts?: {
  since?: Date;
  until?: Date;
  /** When set, only these purposes. */
  purposes?: LlmUsagePurpose[];
  /** When set, exclude these purposes (e.g. voice chars from LLM token totals). */
  excludePurposes?: LlmUsagePurpose[];
  provider?: string;
}): Promise<LlmUsageTotals> {
  await ensureLlmUsageSchema();
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (opts?.since) {
    params.push(opts.since.toISOString());
    clauses.push(`created_at >= $${params.length}`);
  }
  if (opts?.until) {
    params.push(opts.until.toISOString());
    clauses.push(`created_at < $${params.length}`);
  }
  if (opts?.purposes?.length) {
    params.push(opts.purposes);
    clauses.push(`purpose = ANY($${params.length}::text[])`);
  }
  if (opts?.excludePurposes?.length) {
    params.push(opts.excludePurposes);
    clauses.push(`NOT (purpose = ANY($${params.length}::text[]))`);
  }
  if (opts?.provider) {
    params.push(opts.provider);
    clauses.push(`provider = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await getPool().query<{
    call_count: number;
    prompt_tokens: string;
    completion_tokens: string;
    total_tokens: string;
    cost_usd_micros: string;
  }>(
    `SELECT COUNT(*)::int AS call_count,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(cost_usd_micros), 0) AS cost_usd_micros
     FROM llm_usage_events
     ${where}`,
    params
  );
  return mapTotals(rows[0]);
}

export async function getUserLlmUsage(
  userId: string
): Promise<LlmUsageTotals> {
  await ensureLlmUsageSchema();
  const { rows } = await getPool().query<{
    call_count: number;
    prompt_tokens: string;
    completion_tokens: string;
    total_tokens: string;
    cost_usd_micros: string;
  }>(
    `SELECT COUNT(*)::int AS call_count,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(cost_usd_micros), 0) AS cost_usd_micros
     FROM llm_usage_events
     WHERE user_id = $1`,
    [userId]
  );
  return mapTotals(rows[0]);
}

export async function listUserLlmUsage(
  limit = 50
): Promise<UserLlmUsageRow[]> {
  await ensureLlmUsageSchema();
  const { rows } = await getPool().query<{
    user_id: string;
    email: string;
    name: string | null;
    call_count: number;
    prompt_tokens: string;
    completion_tokens: string;
    total_tokens: string;
    cost_usd_micros: string;
    last_call_at: string | null;
  }>(
    `SELECT u.id AS user_id, u.email, u.name,
            COUNT(e.id)::int AS call_count,
            COALESCE(SUM(e.prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(e.completion_tokens), 0) AS completion_tokens,
            COALESCE(SUM(e.total_tokens), 0) AS total_tokens,
            COALESCE(SUM(e.cost_usd_micros), 0) AS cost_usd_micros,
            MAX(e.created_at) AS last_call_at
     FROM users u
     INNER JOIN llm_usage_events e ON e.user_id = u.id
     GROUP BY u.id, u.email, u.name
     ORDER BY SUM(e.cost_usd_micros) DESC, SUM(e.total_tokens) DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    callCount: Number(r.call_count),
    promptTokens: Number(r.prompt_tokens),
    completionTokens: Number(r.completion_tokens),
    totalTokens: Number(r.total_tokens),
    costUsdMicros: Number(r.cost_usd_micros),
    lastCallAt: r.last_call_at
      ? new Date(r.last_call_at).toISOString()
      : null,
  }));
}
