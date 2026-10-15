import { ensureSchemaReady, getPool } from "@/lib/db";
import { ensureLlmUsageSchema, getLlmUsageTotals } from "@/lib/llm-usage";
import { sqlRowCountsInStats, sqlUserCountsInStats } from "@/lib/stats-scope";
import { getStripe, getStripeConfig } from "@/lib/stripe";
import { stripeAdminStatus } from "@/lib/stripe-admin-settings";
import {
  financePlanKey,
  mrrCentsForPlan,
  sharePct,
  type AdminFinanceDashboard,
  type AdminFinancePayment,
  type AdminFinancePoint,
  type AdminFinanceRenewal,
  type AdminFinanceSource,
  type AdminFinanceWallet,
  type FinancePlanKey,
} from "@/lib/admin-finance-format";

export type { AdminFinanceDashboard };

const PAID_STATUSES = ["active", "past_due"];
const UPCOMING_STATUSES = ["active", "trialing", "past_due"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function startOfUtcDay(d: Date): Date {
  const next = new Date(d);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function startOfUtcWeek(d: Date): Date {
  const next = startOfUtcDay(d);
  const day = next.getUTCDay(); // 0 Sun
  const offset = day === 0 ? 6 : day - 1; // Monday
  next.setUTCDate(next.getUTCDate() - offset);
  return next;
}

async function stripeBalanceSnapshot(): Promise<{
  availableCents: number | null;
  pendingCents: number | null;
  currency: string | null;
}> {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      return { availableCents: null, pendingCents: null, currency: null };
    }
    const balance = await stripe.balance.retrieve();
    const pick =
      balance.available.find((b) => b.currency === "usd") ??
      balance.available[0];
    const pending =
      balance.pending.find((b) => b.currency === (pick?.currency ?? "usd")) ??
      balance.pending[0];
    return {
      availableCents: pick ? pick.amount : null,
      pendingCents: pending ? pending.amount : null,
      currency: pick ? pick.currency.toUpperCase() : null,
    };
  } catch (err) {
    console.error("[admin/finance] stripe balance", err);
    return { availableCents: null, pendingCents: null, currency: null };
  }
}

export async function getAdminFinanceDashboard(): Promise<AdminFinanceDashboard> {
  await ensureSchemaReady();
  await ensureLlmUsageSchema();
  const pool = getPool();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
  const sevenDaysAgo = startOfUtcDay(new Date());
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const eightWeeksAgo = startOfUtcWeek(new Date());
  eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 7 * 7);

  const [
    users,
    subRows,
    collectedMonth,
    collectedLast,
    collectedByDay,
    collectedByWeek,
    collectedByMode,
    upcomingRows,
    dueMonth,
    autopayToday,
    paymentRows,
    lookupRows,
    llmMonth,
    llmLastMonth,
    stripeCfg,
    stripeBal,
  ] = await Promise.all([
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users WHERE ${sqlUserCountsInStats("users")}`
    ),
    pool.query<{ plan: string; status: string; amount_cents: number }>(
      `SELECT s.plan, s.status, COALESCE(s.amount_cents, 0)::int AS amount_cents
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE ${sqlUserCountsInStats("u")}`
    ),
    pool.query<{ c: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS c
       FROM billing_events
       WHERE status = 'succeeded' AND occurred_at >= $1
         AND ${sqlRowCountsInStats("user_id")}`,
      [monthStart.toISOString()]
    ),
    pool.query<{ c: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS c
       FROM billing_events
       WHERE status = 'succeeded' AND occurred_at >= $1 AND occurred_at < $2
         AND ${sqlRowCountsInStats("user_id")}`,
      [lastMonthStart.toISOString(), monthStart.toISOString()]
    ),
    pool.query<{ d: string; c: number }>(
      `SELECT to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
              COALESCE(SUM(amount_cents), 0)::int AS c
       FROM billing_events
       WHERE status = 'succeeded' AND occurred_at >= $1
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY 1`,
      [sevenDaysAgo.toISOString()]
    ),
    pool.query<{ d: string; c: number }>(
      `SELECT to_char(date_trunc('week', occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d,
              COALESCE(SUM(amount_cents), 0)::int AS c
       FROM billing_events
       WHERE status = 'succeeded' AND occurred_at >= $1
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY 1`,
      [eightWeeksAgo.toISOString()]
    ),
    pool.query<{ livemode: boolean | null; c: number; n: number }>(
      `SELECT livemode,
              COALESCE(SUM(amount_cents), 0)::int AS c,
              COUNT(*)::int AS n
       FROM billing_events
       WHERE status = 'succeeded'
         AND ${sqlRowCountsInStats("user_id")}
       GROUP BY livemode`
    ),
    pool.query<{
      user_id: string;
      email: string;
      name: string | null;
      plan: string;
      status: string;
      amount_cents: number;
      currency: string;
      renews_at: string;
    }>(
      `SELECT u.id AS user_id, u.email, u.name, s.plan, s.status,
              s.amount_cents, COALESCE(s.currency, 'USD') AS currency, s.renews_at
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.renews_at IS NOT NULL
         AND s.status = ANY($1)
         AND s.renews_at >= NOW()
         AND ${sqlUserCountsInStats("u")}
       ORDER BY s.renews_at ASC
       LIMIT 12`,
      [UPCOMING_STATUSES]
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = ANY($1)
         AND s.renews_at >= date_trunc('month', NOW())
         AND s.renews_at < date_trunc('month', NOW()) + interval '1 month'
         AND ${sqlUserCountsInStats("u")}`,
      [UPCOMING_STATUSES]
    ),
    pool.query<{ c: number }>(
      `SELECT COALESCE(SUM(s.amount_cents), 0)::int AS c
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = ANY($1)
         AND s.renews_at IS NOT NULL
         AND (s.renews_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
         AND ${sqlUserCountsInStats("u")}`,
      [PAID_STATUSES]
    ),
    pool.query<{
      id: string;
      user_id: string;
      email: string;
      name: string | null;
      status: string;
      amount_cents: number;
      currency: string;
      description: string | null;
      livemode: boolean | null;
      occurred_at: string;
    }>(
      `SELECT be.id, be.user_id, u.email, u.name, be.status, be.amount_cents,
              be.currency, be.description, be.livemode, be.occurred_at
       FROM billing_events be
       JOIN users u ON u.id = be.user_id
       WHERE ${sqlUserCountsInStats("u")}
       ORDER BY be.occurred_at DESC
       LIMIT 80`
    ),
    pool.query<{ user_id: string; email: string; name: string | null }>(
      `SELECT u.id AS user_id, u.email, u.name
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE s.status = ANY($1) OR s.plan IN ('weekly','monthly','yearly')
       ORDER BY u.email ASC
       LIMIT 200`,
      [["active", "trialing", "past_due", "legacy"]]
    ),
    getLlmUsageTotals({ since: monthStart }),
    pool.query<{ cost_usd_micros: string }>(
      `SELECT COALESCE(SUM(cost_usd_micros), 0) AS cost_usd_micros
       FROM llm_usage_events
       WHERE created_at >= $1 AND created_at < $2
         AND ${sqlRowCountsInStats("user_id")}`,
      [lastMonthStart.toISOString(), monthStart.toISOString()]
    ),
    getStripeConfig(),
    stripeBalanceSnapshot(),
  ]);

  const totalUsers = users.rows[0]?.c ?? 0;
  let mrrCents = 0;
  let activePaid = 0;
  const sourceMap = new Map<
    FinancePlanKey,
    { amountCents: number; count: number }
  >();

  for (const row of subRows.rows) {
    if (row.status !== "active" || row.plan === "free") continue;
    const mrr = mrrCentsForPlan(row.plan, row.amount_cents);
    mrrCents += mrr;
    activePaid += 1;
    const key = financePlanKey(row.plan);
    const prev = sourceMap.get(key) ?? { amountCents: 0, count: 0 };
    sourceMap.set(key, {
      amountCents: prev.amountCents + mrr,
      count: prev.count + 1,
    });
  }

  const sourceOrder: FinancePlanKey[] = ["weekly", "monthly", "yearly"];
  const incomeSources: AdminFinanceSource[] = sourceOrder.map((key) => {
    const row = sourceMap.get(key) ?? { amountCents: 0, count: 0 };
    return {
      key,
      label: key === "weekly" ? "Weekly" : key === "monthly" ? "Monthly" : "Yearly",
      amountCents: row.amountCents,
      count: row.count,
      pct: sharePct(row.amountCents, mrrCents),
    };
  });

  const other = sourceMap.get("other");
  const allocation: AdminFinanceSource[] = [...incomeSources];
  if (other && (other.amountCents > 0 || other.count > 0)) {
    allocation.push({
      key: "other",
      label: "Other",
      amountCents: other.amountCents,
      count: other.count,
      pct: sharePct(other.amountCents, mrrCents),
    });
  }

  const dayMap = new Map(collectedByDay.rows.map((r) => [r.d, r.c]));
  const series7d: AdminFinancePoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setUTCDate(sevenDaysAgo.getUTCDate() + i);
    const key = ymd(d);
    series7d.push({
      date: key,
      label: dayLabel(d),
      collectedCents: dayMap.get(key) ?? 0,
    });
  }

  const weekMap = new Map(collectedByWeek.rows.map((r) => [r.d, r.c]));
  const seriesMonthly: AdminFinancePoint[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(eightWeeksAgo);
    d.setUTCDate(eightWeeksAgo.getUTCDate() + i * 7);
    const key = ymd(d);
    seriesMonthly.push({
      date: key,
      label: weekLabel(d),
      collectedCents: weekMap.get(key) ?? 0,
    });
  }

  const modeSum = { sandbox: 0, live: 0, unknown: 0 };
  const modeCount = { sandbox: 0, live: 0, unknown: 0 };
  for (const row of collectedByMode.rows) {
    if (row.livemode === true) {
      modeSum.live += row.c;
      modeCount.live += row.n;
    } else if (row.livemode === false) {
      modeSum.sandbox += row.c;
      modeCount.sandbox += row.n;
    } else {
      modeSum.unknown += row.c;
      modeCount.unknown += row.n;
    }
  }

  const stripeStatus = stripeAdminStatus(stripeCfg);
  const currency = (stripeBal.currency || "USD").toUpperCase();
  const wallets: AdminFinanceWallet[] = [
    {
      id: "stripe-active",
      label: stripeStatus.demoMode ? "Stripe sandbox" : "Stripe live",
      detail: stripeStatus.demoMode
        ? "Active checkout account · test"
        : "Active checkout account · live",
      amountLabel:
        stripeBal.availableCents != null
          ? `${(stripeBal.availableCents / 100).toFixed(
              stripeBal.availableCents % 100 === 0 ? 0 : 2
            )} ${currency}`
          : "Balance unavailable",
      mark: stripeStatus.demoMode ? "S" : "L",
      badge: stripeStatus.demoMode ? "Demo" : "Live",
    },
    {
      id: "sandbox-collected",
      label: "Sandbox charges",
      detail: `${modeCount.sandbox} paid test events`,
      amountLabel: `${(modeSum.sandbox / 100).toFixed(
        modeSum.sandbox % 100 === 0 ? 0 : 2
      )} USD`,
      mark: "T",
    },
    {
      id: "live-collected",
      label: "Live charges",
      detail: `${modeCount.live} paid live events`,
      amountLabel: `${(modeSum.live / 100).toFixed(
        modeSum.live % 100 === 0 ? 0 : 2
      )} USD`,
      mark: "L",
    },
  ];

  const upcoming: AdminFinanceRenewal[] = upcomingRows.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    status: r.status,
    amountCents: r.amount_cents,
    currency: r.currency,
    renewsAt: new Date(r.renews_at).toISOString(),
  }));

  const payments: AdminFinancePayment[] = paymentRows.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    name: r.name,
    status: r.status,
    amountCents: r.amount_cents,
    currency: r.currency,
    description: r.description,
    livemode: r.livemode,
    occurredAt: new Date(r.occurred_at).toISOString(),
  }));

  return {
    generatedAt: new Date().toISOString(),
    currency,
    kpis: {
      mrrCents,
      collectedThisMonthCents: collectedMonth.rows[0]?.c ?? 0,
      collectedLastMonthCents: collectedLast.rows[0]?.c ?? 0,
      aiSpendUsdMicros: llmMonth.costUsdMicros,
      aiSpendLastMonthUsdMicros: Number(
        llmLastMonth.rows[0]?.cost_usd_micros ?? 0
      ),
      paidSharePct: sharePct(activePaid, totalUsers),
      activePaid,
      totalUsers,
    },
    incomeSources,
    stripe: {
      demoMode: stripeStatus.demoMode,
      catalogReady: stripeStatus.catalogReady,
      webhookReady: stripeStatus.webhookReady,
      availableCents: stripeBal.availableCents,
      pendingCents: stripeBal.pendingCents,
      stripeCurrency: stripeBal.currency,
    },
    series7d,
    seriesMonthly,
    allocation,
    wallets,
    upcoming,
    upcomingTotalCents: upcoming.reduce((s, r) => s + r.amountCents, 0),
    dueThisMonth: dueMonth.rows[0]?.c ?? 0,
    autopayTodayCents: autopayToday.rows[0]?.c ?? 0,
    payments,
    lookup: lookupRows.rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      name: r.name,
    })),
  };
}
