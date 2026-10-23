import { ensureSchemaReady, getPool } from "@/lib/db";
import { ensureLlmUsageSchema, getLlmUsageTotals } from "@/lib/llm-usage";
import { sqlRowCountsInStats, sqlUserCountsInStats } from "@/lib/stats-scope";

export type AdminDayPoint = {
  date: string; // YYYY-MM-DD
  label: string; // Mon, Tue…
  messages: number;
  tokens: number;
  costUsdMicros: number;
  newUsers: number;
};

export type AdminLlmSlice = {
  key: string;
  label: string;
  tokens: number;
  costUsdMicros: number;
  callCount: number;
};

export type AdminDashboardStats = {
  users: {
    total: number;
    newThisMonth: number;
    newLastMonth: number;
    admins: number;
    support: number;
  };
  sessions: {
    totalThreads: number;
    messagesThisMonth: number;
    messagesLastMonth: number;
  };
  billing: {
    activePaid: number;
    mrrCents: number;
    currency: string;
    paidSharePct: number;
  };
  llm: {
    tokensThisMonth: number;
    costUsdMicrosThisMonth: number;
    tokensLastMonth: number;
    costUsdMicrosLastMonth: number;
    tokensAllTime: number;
    costUsdMicrosAllTime: number;
    callsThisMonth: number;
    /** Last 7 days (incl. voice). */
    costUsdMicrosThisWeek: number;
    tokensThisWeek: number;
  };
  voice: {
    charsThisMonth: number;
    costUsdMicrosThisMonth: number;
    charsThisWeek: number;
    costUsdMicrosThisWeek: number;
    callsThisMonth: number;
  };
  series7d: AdminDayPoint[];
  llmByPurpose: AdminLlmSlice[];
  llmByProvider: AdminLlmSlice[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  plan: string;
  subscriptionStatus: string;
  amountCents: number;
  hasPassword: boolean;
  hasGoogle: boolean;
  statsExcluded: boolean;
};

const PURPOSE_LABELS: Record<string, string> = {
  guided_chat: "Guided chat",
  interpreter: "Interpreter",
  interpreter_cutoff: "Interpreter (cut off)",
  interpreter_unparsed: "Interpreter (unparsed)",
  memory_extract: "Memory extract",
  help: "Help",
  voice: "ElevenLabs voice",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  claude: "Claude",
  elevenlabs: "ElevenLabs",
};

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function adminPctChange(current: number, previous: number): number {
  return pctChange(current, previous);
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await ensureSchemaReady();
  await ensureLlmUsageSchema();
  const pool = getPool();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const [
    users,
    admins,
    support,
    newUsers,
    newUsersLast,
    threads,
    messages,
    messagesLast,
    billing,
    llmMonth,
    llmLastMonth,
    llmAll,
    llmWeek,
    llmTokensMonth,
    llmTokensLastMonth,
    llmTokensAll,
    llmTokensWeek,
    voiceMonth,
    voiceWeek,
    msgSeries,
    userSeries,
    llmSeries,
    purposeRows,
    providerRows,
  ] = await Promise.all([
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users WHERE ${sqlUserCountsInStats("users")}`
    ),
    pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM users WHERE role = 'platform_admin'"
    ),
    pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM users WHERE role = 'support'"
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users
       WHERE created_at >= date_trunc('month', NOW())
         AND ${sqlUserCountsInStats("users")}`
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users
       WHERE created_at >= date_trunc('month', NOW() - interval '1 month')
         AND created_at < date_trunc('month', NOW())
         AND ${sqlUserCountsInStats("users")}`
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM threads t
       WHERE ${sqlRowCountsInStats("t.user_id")}`
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE m.created_at >= date_trunc('month', NOW())
         AND ${sqlRowCountsInStats("t.user_id")}`
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE m.created_at >= date_trunc('month', NOW() - interval '1 month')
         AND m.created_at < date_trunc('month', NOW())
         AND ${sqlRowCountsInStats("t.user_id")}`
    ),
    pool.query<{ active_paid: number; mrr_cents: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE s.status = 'active' AND s.plan <> 'free')::int AS active_paid,
        COALESCE(SUM(s.amount_cents) FILTER (WHERE s.status = 'active' AND s.plan <> 'free'), 0)::int AS mrr_cents
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE ${sqlUserCountsInStats("u")}
    `),
    getLlmUsageTotals({ since: monthStart }),
    pool.query<{
      total_tokens: string;
      cost_usd_micros: string;
    }>(
      `SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(cost_usd_micros), 0) AS cost_usd_micros
       FROM llm_usage_events
       WHERE created_at >= $1 AND created_at < $2
         AND ${sqlRowCountsInStats("user_id")}`,
      [lastMonthStart.toISOString(), monthStart.toISOString()]
    ),
    getLlmUsageTotals(),
    getLlmUsageTotals({ since: sevenDaysAgo }),
    getLlmUsageTotals({ since: monthStart, excludePurposes: ["voice"] }),
    pool.query<{
      total_tokens: string;
      cost_usd_micros: string;
    }>(
      `SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(cost_usd_micros), 0) AS cost_usd_micros
       FROM llm_usage_events
       WHERE purpose <> 'voice'
         AND created_at >= $1 AND created_at < $2
         AND ${sqlRowCountsInStats("user_id")}`,
      [lastMonthStart.toISOString(), monthStart.toISOString()]
    ),
    getLlmUsageTotals({ excludePurposes: ["voice"] }),
    getLlmUsageTotals({ since: sevenDaysAgo, excludePurposes: ["voice"] }),
    getLlmUsageTotals({ since: monthStart, purposes: ["voice"] }),
    getLlmUsageTotals({ since: sevenDaysAgo, purposes: ["voice"] }),
    pool.query<{ d: string; c: number }>(
      `SELECT to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
              COUNT(*)::int AS c
       FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE m.created_at >= $1
         AND ${sqlRowCountsInStats("t.user_id")}
       GROUP BY 1`,
      [sevenDaysAgo.toISOString()]
    ),
    pool.query<{ d: string; c: number }>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
              COUNT(*)::int AS c
       FROM users
       WHERE created_at >= $1
         AND ${sqlUserCountsInStats("users")}
       GROUP BY 1`,
      [sevenDaysAgo.toISOString()]
    ),
    pool.query<{ d: string; tokens: string; cost: string }>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
              COALESCE(SUM(total_tokens) FILTER (WHERE purpose <> 'voice'), 0) AS tokens,
              COALESCE(SUM(cost_usd_micros), 0) AS cost
       FROM llm_usage_events
       WHERE created_at >= $1
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY 1`,
      [sevenDaysAgo.toISOString()]
    ),
    pool.query<{
      purpose: string;
      tokens: string;
      cost: string;
      calls: number;
    }>(
      `SELECT purpose,
              COALESCE(SUM(total_tokens), 0) AS tokens,
              COALESCE(SUM(cost_usd_micros), 0) AS cost,
              COUNT(*)::int AS calls
       FROM llm_usage_events
       WHERE created_at >= $1
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY purpose
       ORDER BY SUM(cost_usd_micros) DESC`,
      [monthStart.toISOString()]
    ),
    pool.query<{
      provider: string;
      tokens: string;
      cost: string;
      calls: number;
    }>(
      `SELECT provider,
              COALESCE(SUM(total_tokens), 0) AS tokens,
              COALESCE(SUM(cost_usd_micros), 0) AS cost,
              COUNT(*)::int AS calls
       FROM llm_usage_events
       WHERE created_at >= $1
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY provider
       ORDER BY SUM(cost_usd_micros) DESC`,
      [monthStart.toISOString()]
    ),
  ]);

  const msgMap = new Map(msgSeries.rows.map((r) => [r.d, r.c]));
  const userMap = new Map(userSeries.rows.map((r) => [r.d, r.c]));
  const llmMap = new Map(
    llmSeries.rows.map((r) => [
      r.d,
      { tokens: Number(r.tokens), cost: Number(r.cost) },
    ])
  );

  const series7d: AdminDayPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setUTCDate(sevenDaysAgo.getUTCDate() + i);
    const key = ymd(d);
    const llm = llmMap.get(key) ?? { tokens: 0, cost: 0 };
    series7d.push({
      date: key,
      label: dayLabel(d),
      messages: msgMap.get(key) ?? 0,
      tokens: llm.tokens,
      costUsdMicros: llm.cost,
      newUsers: userMap.get(key) ?? 0,
    });
  }

  const totalUsers = users.rows[0]?.c ?? 0;
  const activePaid = billing.rows[0]?.active_paid ?? 0;
  const paidSharePct =
    totalUsers > 0 ? Math.round((activePaid / totalUsers) * 1000) / 10 : 0;

  return {
    users: {
      total: totalUsers,
      newThisMonth: newUsers.rows[0]?.c ?? 0,
      newLastMonth: newUsersLast.rows[0]?.c ?? 0,
      admins: admins.rows[0]?.c ?? 0,
      support: support.rows[0]?.c ?? 0,
    },
    sessions: {
      totalThreads: threads.rows[0]?.c ?? 0,
      messagesThisMonth: messages.rows[0]?.c ?? 0,
      messagesLastMonth: messagesLast.rows[0]?.c ?? 0,
    },
    billing: {
      activePaid,
      mrrCents: billing.rows[0]?.mrr_cents ?? 0,
      currency: "USD",
      paidSharePct,
    },
    llm: {
      tokensThisMonth: llmTokensMonth.totalTokens,
      costUsdMicrosThisMonth: llmMonth.costUsdMicros,
      tokensLastMonth: Number(llmTokensLastMonth.rows[0]?.total_tokens ?? 0),
      costUsdMicrosLastMonth: Number(
        llmLastMonth.rows[0]?.cost_usd_micros ?? 0
      ),
      tokensAllTime: llmTokensAll.totalTokens,
      costUsdMicrosAllTime: llmAll.costUsdMicros,
      callsThisMonth: llmMonth.callCount,
      costUsdMicrosThisWeek: llmWeek.costUsdMicros,
      tokensThisWeek: llmTokensWeek.totalTokens,
    },
    voice: {
      charsThisMonth: voiceMonth.totalTokens,
      costUsdMicrosThisMonth: voiceMonth.costUsdMicros,
      charsThisWeek: voiceWeek.totalTokens,
      costUsdMicrosThisWeek: voiceWeek.costUsdMicros,
      callsThisMonth: voiceMonth.callCount,
    },
    series7d,
    llmByPurpose: purposeRows.rows.map((r) => ({
      key: r.purpose,
      label: PURPOSE_LABELS[r.purpose] ?? r.purpose,
      tokens: Number(r.tokens),
      costUsdMicros: Number(r.cost),
      callCount: r.calls,
    })),
    llmByProvider: providerRows.rows.map((r) => ({
      key: r.provider,
      label: PROVIDER_LABELS[r.provider] ?? r.provider,
      tokens: Number(r.tokens),
      costUsdMicros: Number(r.cost),
      callCount: r.calls,
    })),
  };
}

export async function listAdminUsers(limit = 200): Promise<AdminUserRow[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    role: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
    plan: string | null;
    subscription_status: string | null;
    amount_cents: number | null;
    has_password: boolean;
    has_google: boolean;
    stats_excluded: boolean;
  }>(
    `SELECT u.id, u.email, u.name, u.avatar_url, u.role, u.status, u.created_at, u.last_login_at,
            COALESCE(s.plan, 'free') AS plan,
            COALESCE(s.status, 'none') AS subscription_status,
            COALESCE(s.amount_cents, 0) AS amount_cents,
            (u.password_hash IS NOT NULL) AS has_password,
            (u.google_sub IS NOT NULL) AS has_google,
            COALESCE(u.stats_excluded, FALSE) AS stats_excluded
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    avatarUrl: r.avatar_url,
    role: r.role,
    status: r.status ?? "active",
    createdAt: new Date(r.created_at).toISOString(),
    lastLoginAt: r.last_login_at
      ? new Date(r.last_login_at).toISOString()
      : null,
    plan: r.plan ?? "free",
    subscriptionStatus: r.subscription_status ?? "none",
    amountCents: r.amount_cents ?? 0,
    hasPassword: Boolean(r.has_password),
    hasGoogle: Boolean(r.has_google),
    statsExcluded: Boolean(r.stats_excluded),
  }));
}
