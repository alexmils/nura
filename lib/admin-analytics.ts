import { ensureSchemaReady, getPool } from "@/lib/db";
import { ensureHelpSchema } from "@/lib/help-db";
import {
  parseAnalyticsDays,
  type AdminAnalyticsDashboard,
  type AdminAnalyticsHour,
  type AdminAnalyticsMix,
  type AdminAnalyticsPoint,
  type AdminAnalyticsSurface,
  type AnalyticsRangeDays,
} from "@/lib/admin-analytics-format";
import { sharePct } from "@/lib/admin-finance-format";
import { sqlRowCountsInStats, sqlUserCountsInStats } from "@/lib/stats-scope";

function startOfUtcDay(d: Date): Date {
  const next = new Date(d);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function windowFor(days: AnalyticsRangeDays) {
  const end = startOfUtcDay(new Date());
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: start.toISOString(),
    startDate: start,
    days,
  };
}

const ACTIVE_USERS_SQL = `
  SELECT actor_user_id AS user_id
  FROM audit_events
  WHERE action = 'user.login'
    AND created_at >= $1 AND created_at < $2
    AND actor_user_id IS NOT NULL
    AND ${sqlRowCountsInStats("actor_user_id")}
  UNION
  SELECT user_id
  FROM threads
  WHERE created_at >= $1 AND created_at < $2
    AND user_id IS NOT NULL
    AND ${sqlRowCountsInStats("user_id")}
  UNION
  SELECT t.user_id
  FROM messages m
  JOIN threads t ON t.id = m.thread_id
  WHERE m.created_at >= $1 AND m.created_at < $2
    AND t.user_id IS NOT NULL
    AND ${sqlRowCountsInStats("t.user_id")}
`;

async function periodKpis(start: string, end: string) {
  const pool = getPool();
  const [unique, sessions, messages, engaged, converted] = await Promise.all([
    pool.query<{ c: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS c FROM (${ACTIVE_USERS_SQL}) a`,
      [start, end]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM threads
       WHERE created_at >= $1 AND created_at < $2
         AND ${sqlRowCountsInStats("user_id")}`,
      [start, end]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE m.created_at >= $1 AND m.created_at < $2
         AND ${sqlRowCountsInStats("t.user_id")}`,
      [start, end]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM threads t
       WHERE t.created_at >= $1 AND t.created_at < $2
         AND ${sqlRowCountsInStats("t.user_id")}
         AND EXISTS (
           SELECT 1 FROM messages m
           WHERE m.thread_id = t.id AND m.role = 'user'
         )`,
      [start, end]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS c
       FROM billing_events
       WHERE status = 'succeeded' AND occurred_at >= $1 AND occurred_at < $2
         AND ${sqlRowCountsInStats("user_id")}`,
      [start, end]
    ),
  ]);

  const uniqueUsers = unique.rows[0]?.c ?? 0;
  const sessionCount = sessions.rows[0]?.c ?? 0;
  const messageCount = messages.rows[0]?.c ?? 0;
  const engagedCount = engaged.rows[0]?.c ?? 0;
  const convertedCount = converted.rows[0]?.c ?? 0;

  return {
    uniqueUsers,
    sessions: sessionCount,
    messages: messageCount,
    engagementPct: sharePct(engagedCount, sessionCount),
    conversionPct: sharePct(convertedCount, uniqueUsers),
  };
}

function fillDailySeries(
  startDate: Date,
  days: number,
  rows: { d: string; sessions: number; engaged: number }[],
  labelMode: AnalyticsRangeDays
): AdminAnalyticsPoint[] {
  const map = new Map(rows.map((r) => [r.d, r]));
  const out: AdminAnalyticsPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + i);
    const key = ymd(d);
    const row = map.get(key);
    const sessions = row?.sessions ?? 0;
    const engaged = row?.engaged ?? 0;
    const value = sharePct(engaged, sessions);
    let label = "";
    if (labelMode === 7) {
      label = d.toLocaleDateString("en-GB", { weekday: "short" });
    } else if (i % 7 === 0) {
      label = `Week ${Math.floor(i / 7) + 1}`;
    }
    out.push({ label, value });
  }
  return out;
}

export async function getAdminAnalyticsDashboard(
  daysRaw?: unknown
): Promise<AdminAnalyticsDashboard> {
  await ensureSchemaReady();
  await ensureHelpSchema();
  const days = parseAnalyticsDays(daysRaw);
  const win = windowFor(days);
  const pool = getPool();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    current,
    previous,
    qualityRows,
    qualityPrevRows,
    hourRows,
    liveRow,
    mixThreads,
    mixHelp,
    mixLogins,
    surfaceRows,
    helpSurface,
    sourceUsers,
    audienceRows,
    conversionRows,
  ] = await Promise.all([
    periodKpis(win.start, win.end),
    periodKpis(win.prevStart, win.prevEnd),
    pool.query<{ d: string; sessions: number; engaged: number }>(
      `SELECT to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
              COUNT(*)::int AS sessions,
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM messages m
                  WHERE m.thread_id = t.id AND m.role = 'user'
                )
              )::int AS engaged
       FROM threads t
       WHERE t.created_at >= $1 AND t.created_at < $2
         AND ${sqlRowCountsInStats("t.user_id")}
       GROUP BY 1`,
      [win.start, win.end]
    ),
    pool.query<{ d: string; sessions: number; engaged: number }>(
      `SELECT to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
              COUNT(*)::int AS sessions,
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM messages m
                  WHERE m.thread_id = t.id AND m.role = 'user'
                )
              )::int AS engaged
       FROM threads t
       WHERE t.created_at >= $1 AND t.created_at < $2
         AND ${sqlRowCountsInStats("t.user_id")}
       GROUP BY 1`,
      [win.prevStart, win.prevEnd]
    ),
    pool.query<{ h: string; u: number; a: number }>(
      `SELECT to_char(date_trunc('hour', m.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24') AS h,
              COUNT(*) FILTER (WHERE m.role = 'user')::int AS u,
              COUNT(*) FILTER (WHERE m.role <> 'user')::int AS a
       FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE m.created_at >= $1
         AND ${sqlRowCountsInStats("t.user_id")}
       GROUP BY 1`,
      [dayAgo]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE m.created_at >= $1
         AND ${sqlRowCountsInStats("t.user_id")}`,
      [hourAgo]
    ),
    pool.query<{ mode: string; c: number }>(
      `SELECT COALESCE(mode, 'guided') AS mode, COUNT(*)::int AS c
       FROM threads
       WHERE created_at >= $1
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY 1`,
      [dayAgo]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM help_threads
       WHERE created_at >= $1
         AND (
           user_id IS NULL
           OR ${sqlRowCountsInStats("user_id")}
         )`,
      [dayAgo]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM audit_events
       WHERE action = 'user.login' AND created_at >= $1
         AND ${sqlRowCountsInStats("actor_user_id")}`,
      [dayAgo]
    ),
    pool.query<{
      mode: string;
      count: number;
      avg_s: string;
      bounced: number;
    }>(
      `SELECT COALESCE(mode, 'guided') AS mode,
              COUNT(*)::int AS count,
              COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 0) AS avg_s,
              COUNT(*) FILTER (
                WHERE NOT EXISTS (
                  SELECT 1 FROM messages m
                  WHERE m.thread_id = threads.id AND m.role = 'user'
                )
              )::int AS bounced
       FROM threads
       WHERE created_at >= $1 AND created_at < $2
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY 1`,
      [win.start, win.end]
    ),
    pool.query<{ count: number; avg_s: string; bounced: number }>(
      `SELECT COUNT(*)::int AS count,
              COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 0) AS avg_s,
              COUNT(*) FILTER (WHERE status = 'open')::int AS bounced
       FROM help_threads
       WHERE created_at >= $1 AND created_at < $2
         AND (
           user_id IS NULL
           OR ${sqlRowCountsInStats("user_id")}
         )`,
      [win.start, win.end]
    ),
    pool.query<{
      google: number;
      email: number;
      invited: number;
      other: number;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE google_sub IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM audit_events e
               WHERE e.target_user_id = u.id AND e.action = 'user.invited'
             )
         )::int AS google,
         COUNT(*) FILTER (
           WHERE google_sub IS NULL
             AND password_hash IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM audit_events e
               WHERE e.target_user_id = u.id AND e.action = 'user.invited'
             )
         )::int AS email,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM audit_events e
             WHERE e.target_user_id = u.id AND e.action = 'user.invited'
           )
         )::int AS invited,
         COUNT(*) FILTER (
           WHERE google_sub IS NULL
             AND password_hash IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM audit_events e
               WHERE e.target_user_id = u.id AND e.action = 'user.invited'
             )
         )::int AS other
       FROM users u
       WHERE u.created_at >= $1 AND u.created_at < $2
         AND ${sqlUserCountsInStats("u")}`,
      [win.start, win.end]
    ),
    pool.query<{ plan: string; c: number }>(
      `SELECT COALESCE(s.plan, 'free') AS plan, COUNT(*)::int AS c
       FROM (${ACTIVE_USERS_SQL}) a
       LEFT JOIN subscriptions s ON s.user_id = a.user_id
       GROUP BY 1
       ORDER BY COUNT(*) DESC`,
      [win.start, win.end]
    ),
    pool.query<{ status: string; c: number }>(
      `SELECT status, COUNT(*)::int AS c
       FROM billing_events
       WHERE occurred_at >= $1 AND occurred_at < $2
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY 1`,
      [win.start, win.end]
    ),
  ]);

  const quality = fillDailySeries(
    win.startDate,
    days,
    qualityRows.rows,
    days
  );
  const qualityPrev = fillDailySeries(
    new Date(win.prevStart),
    days,
    qualityPrevRows.rows,
    days
  );

  const hourMap = new Map(hourRows.rows.map((r) => [r.h, r]));
  const hourly: AdminAnalyticsHour[] = [];
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCHours(now.getUTCHours() - i);
    const key = `${ymd(d)} ${String(d.getUTCHours()).padStart(2, "0")}`;
    const row = hourMap.get(key);
    hourly.push({
      label: String(d.getUTCHours()),
      user: row?.u ?? 0,
      assistant: row?.a ?? 0,
    });
  }

  const modeLabel = (mode: string) => {
    if (mode === "free") return "Self-guided";
    if (mode === "pending") return "Not started";
    return "AI agent-guided";
  };

  const mix: AdminAnalyticsMix[] = [
    ...mixThreads.rows.map((r) => ({
      key: r.mode,
      label: modeLabel(r.mode),
      value: r.c,
    })),
    { key: "help", label: "Help", value: mixHelp.rows[0]?.c ?? 0 },
    { key: "signin", label: "Sign-ins", value: mixLogins.rows[0]?.c ?? 0 },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const surfaces: AdminAnalyticsSurface[] = surfaceRows.rows.map((r) => ({
    key: r.mode,
    label: modeLabel(r.mode),
    count: r.count,
    avgSeconds: Number(r.avg_s) || 0,
    bouncePct: sharePct(r.bounced, r.count),
  }));
  const helpCount = helpSurface.rows[0]?.count ?? 0;
  if (helpCount > 0) {
    surfaces.push({
      key: "help",
      label: "Help",
      count: helpCount,
      avgSeconds: Number(helpSurface.rows[0]?.avg_s) || 0,
      bouncePct: sharePct(helpSurface.rows[0]?.bounced ?? 0, helpCount),
    });
  }
  surfaces.sort((a, b) => b.count - a.count);

  const src = sourceUsers.rows[0];
  const sources: AdminAnalyticsMix[] = [
    { key: "google", label: "Google", value: src?.google ?? 0 },
    { key: "email", label: "Email", value: src?.email ?? 0 },
    { key: "invite", label: "Invite", value: src?.invited ?? 0 },
    { key: "other", label: "Other", value: src?.other ?? 0 },
  ];

  const planLabel = (plan: string) => {
    if (plan === "weekly") return "Weekly";
    if (plan === "monthly") return "Monthly";
    if (plan === "yearly") return "Yearly";
    if (plan === "free" || plan === "none") return "Free";
    if (plan === "legacy") return "Legacy";
    return plan;
  };

  const audience: AdminAnalyticsMix[] = audienceRows.rows.map((r) => ({
    key: r.plan,
    label: planLabel(r.plan),
    value: r.c,
  }));

  const conversionLabel = (status: string) => {
    if (status === "succeeded") return "Paid";
    if (status === "failed") return "Failed";
    if (status === "checkout") return "Checkout";
    if (status === "trial_started") return "Trial started";
    return status;
  };

  const conversions: AdminAnalyticsMix[] = conversionRows.rows.map((r) => ({
    key: r.status,
    label: conversionLabel(r.status),
    value: r.c,
  }));

  const liveCount = liveRow.rows[0]?.c ?? 0;

  return {
    generatedAt: new Date().toISOString(),
    days,
    kpis: {
      uniqueUsers: current.uniqueUsers,
      uniqueUsersPrev: previous.uniqueUsers,
      sessions: current.sessions,
      sessionsPrev: previous.sessions,
      messages: current.messages,
      messagesPrev: previous.messages,
      engagementPct: current.engagementPct,
      engagementPctPrev: previous.engagementPct,
      conversionPct: current.conversionPct,
      conversionPctPrev: previous.conversionPct,
    },
    quality,
    qualityPrev,
    hourly,
    liveCount,
    live: liveCount > 0,
    mix,
    surfaces,
    sources,
    audience,
    conversions,
  };
}
