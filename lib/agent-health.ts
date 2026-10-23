import { ensureSchemaReady, getPool } from "@/lib/db";
import { ensureLlmUsageSchema } from "@/lib/llm-usage";
import {
  isStuckThread,
  legacyCapBounds,
  setsPerThreadSummary,
  summarizeInterpreterHealth,
  type AgentThreadHealth,
  type InterpreterHealth,
} from "@/lib/agent-health-format";
import { sqlRowCountsInStats } from "@/lib/stats-scope";

export type UserAgentHealth = {
  threads: AgentThreadHealth[];
  interpreter: InterpreterHealth;
};

export type AgentHealthOverview = {
  days: number;
  guidedThreads: number;
  threadsWithSets: number;
  avgSetsPerThread: number | null;
  stuckThreads: AgentThreadHealth[];
  interpreter: InterpreterHealth;
};

type ThreadRow = {
  id: string;
  title: string;
  phase: string;
  mode: string;
  set_count: number | null;
  created_at: string;
  message_count: number;
  last_message_at: string | null;
  user_id?: string;
  email?: string;
};

function mapThread(r: ThreadRow): AgentThreadHealth {
  const messageCount = Number(r.message_count ?? 0);
  const setCount = Number(r.set_count ?? 0);
  return {
    threadId: r.id,
    title: r.title,
    phase: r.phase,
    messageCount,
    setCount,
    createdAt: new Date(r.created_at).toISOString(),
    lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
    stuck: isStuckThread({ mode: r.mode, messageCount, setCount }),
    ...(r.email ? { userEmail: r.email, userId: r.user_id } : {}),
  };
}

const INTERPRETER_SQL = (where: string) => `
  SELECT purpose,
         (purpose = 'interpreter' AND completion_tokens BETWEEN $LO AND $HI) AS at_legacy_cap,
         COUNT(*)::int AS count
  FROM llm_usage_events
  WHERE purpose IN ('interpreter', 'interpreter_cutoff', 'interpreter_unparsed')
    AND ${where}
  GROUP BY 1, 2`;

export async function getUserAgentHealth(userId: string): Promise<UserAgentHealth> {
  await ensureSchemaReady();
  await ensureLlmUsageSchema();
  const pool = getPool();
  const [lo, hi] = legacyCapBounds();
  const [threads, interp] = await Promise.all([
    pool.query<ThreadRow>(
      `SELECT t.id, t.title, t.phase, t.mode, t.set_count, t.created_at,
              COUNT(m.id)::int AS message_count, MAX(m.created_at) AS last_message_at
       FROM threads t LEFT JOIN messages m ON m.thread_id = t.id
       WHERE t.user_id = $1 AND t.mode = 'guided'
       GROUP BY t.id
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [userId]
    ),
    pool.query<{ purpose: string; at_legacy_cap: boolean; count: number }>(
      INTERPRETER_SQL("user_id = $1").replace("$LO", String(lo)).replace("$HI", String(hi)),
      [userId]
    ),
  ]);
  return {
    threads: threads.rows.map(mapThread),
    interpreter: summarizeInterpreterHealth(
      interp.rows.map((r) => ({
        purpose: r.purpose,
        atLegacyCap: r.at_legacy_cap,
        count: r.count,
      }))
    ),
  };
}

export async function getAgentHealthOverview(days = 30): Promise<AgentHealthOverview> {
  await ensureSchemaReady();
  await ensureLlmUsageSchema();
  const pool = getPool();
  const [lo, hi] = legacyCapBounds();
  const span = Math.min(365, Math.max(1, Math.floor(days)));
  const since = new Date(Date.now() - span * 86_400_000).toISOString();
  const [threads, interp] = await Promise.all([
    pool.query<ThreadRow>(
      `SELECT t.id, t.title, t.phase, t.mode, t.set_count, t.created_at, t.user_id, u.email,
              COUNT(m.id)::int AS message_count, MAX(m.created_at) AS last_message_at
       FROM threads t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN messages m ON m.thread_id = t.id
       WHERE t.mode = 'guided' AND t.created_at >= $1 AND ${sqlRowCountsInStats("t.user_id")}
       GROUP BY t.id, u.email
       ORDER BY t.created_at DESC`,
      [since]
    ),
    pool.query<{ purpose: string; at_legacy_cap: boolean; count: number }>(
      INTERPRETER_SQL(`created_at >= $1 AND ${sqlRowCountsInStats("user_id")}`)
        .replace("$LO", String(lo))
        .replace("$HI", String(hi)),
      [since]
    ),
  ]);
  const mapped = threads.rows.map(mapThread);
  const sets = setsPerThreadSummary(mapped);
  return {
    days: span,
    guidedThreads: sets.threads,
    threadsWithSets: sets.withSets,
    avgSetsPerThread: sets.avgSets,
    stuckThreads: mapped.filter((t) => t.stuck),
    interpreter: summarizeInterpreterHealth(
      interp.rows.map((r) => ({
        purpose: r.purpose,
        atLegacyCap: r.at_legacy_cap,
        count: r.count,
      }))
    ),
  };
}
