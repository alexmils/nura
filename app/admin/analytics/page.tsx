"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  financeCsv,
} from "@/lib/admin-finance-format";
import {
  firstNameFrom,
  formatAvgDuration,
  formatCountCompact,
  formatPct,
  parseAnalyticsDays,
  rangeLabel,
  type AdminAnalyticsDashboard,
  type AnalyticsRangeDays,
} from "@/lib/admin-analytics-format";
import {
  AdminGroupedBars,
  AdminLineChart,
} from "@/app/components/admin/AdminCharts";
import { useAdminTab } from "@/app/components/admin/AdminTabs";
import { fetchJson } from "@/lib/fetch-json";

const TABS = [
  "overview",
  "audience",
  "acquisition",
  "engagement",
  "conversions",
] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "audience", label: "Audience" },
  { id: "acquisition", label: "Acquisition" },
  { id: "engagement", label: "Engagement" },
  { id: "conversions", label: "Conversions" },
];

function PctChip({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  if (previous <= 0 && current <= 0) return null;
  const delta =
    previous <= 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 1000) / 10;
  if (delta === 0) return <span className="admin-fin-chip">0%</span>;
  const up = invert ? delta < 0 : delta > 0;
  return (
    <span className={`admin-fin-chip ${up ? "admin-fin-chip-up" : "admin-fin-chip-down"}`}>
      {delta > 0 ? "+" : ""}
      {delta}%
    </span>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MixBars({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="admin-an-sources">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="admin-an-source-label">{r.label}</span>
          <span className="admin-an-source-track">
            <i style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          </span>
          <span className="admin-an-source-val">{formatCountCompact(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

const SOURCE_NOTES: Record<string, string> = {
  google: "Signed up with Google",
  email: "Signed up with email and a password",
  invite: "Opened an invite you sent",
  other: "No Google sign-in and no password",
};

const PLAN_NOTES: Record<string, string> = {
  weekly: "Weekly plan",
  monthly: "Monthly plan",
  yearly: "Yearly plan",
  free: "No paid plan",
  none: "No paid plan",
  legacy: "Older account, kept on the old plan",
};

const BILLING_NOTES: Record<string, string> = {
  succeeded: "A payment went through",
  failed: "A payment failed",
  checkout: "Opened checkout",
  trial_started: "A trial started",
};

function Breakdown({
  title,
  hint,
  totalLabel,
  rows,
  notes,
  empty,
}: {
  title: string;
  hint: string;
  totalLabel: string;
  rows: { key: string; label: string; value: number }[];
  notes: Record<string, string>;
  empty: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <section className="admin-fin-card">
      <h2 className="admin-fin-card-title">{title}</h2>
      <p className="admin-fin-hint">{hint}</p>
      <p className="admin-an-break-total">{formatCountCompact(total)}</p>
      <p className="admin-fin-hint">{totalLabel}</p>
      {total === 0 ? <p className="admin-fin-empty">{empty}</p> : null}
      <ul className="admin-an-breakdown">
        {rows.map((row) => {
          const share = total > 0 ? Math.round((row.value / total) * 1000) / 10 : 0;
          return (
            <li key={row.key}>
              <div>
                <p className="admin-an-break-name">{row.label}</p>
                <p className="admin-an-break-hint">{notes[row.key] ?? row.label}</p>
              </div>
              <span className="admin-an-source-track" aria-hidden>
                <i style={{ width: `${total > 0 ? (row.value / total) * 100 : 0}%` }} />
              </span>
              <div className="admin-an-break-count">
                <strong>{formatCountCompact(row.value)}</strong>
                <span>{formatPct(share)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AdminAnalyticsPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "overview");
  const [days, setDays] = useState<AnalyticsRangeDays>(28);
  const [hello, setHello] = useState("Hello");
  const [data, setData] = useState<AdminAnalyticsDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: AnalyticsRangeDays) => {
    const [me, res] = await Promise.all([
      fetchJson<{ user?: { name?: string | null; email?: string } }>(
        "/api/auth/me"
      ),
      fetchJson<{ analytics: AdminAnalyticsDashboard }>(
        `/api/admin/analytics?days=${range}`
      ),
    ]);
    const user = me.user;
    if (user) {
      setHello(`Hello, ${firstNameFrom(user.name, user.email ?? "")}`);
    }
    setData(res.analytics);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load(days);
      } catch (err) {
        console.error(err);
        setError("Could not load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, [days, load]);

  const compareQuality = useMemo(
    () => (data ? data.qualityPrev.map((p) => ({ ...p, label: "" })) : []),
    [data]
  );

  const exportCurrent = () => {
    if (!data) return;
    const day = data.generatedAt.slice(0, 10);
    downloadCsv(
      `nura-analytics-${day}.csv`,
      financeCsv([
        ["metric", "current", "previous"],
        ["unique_users", data.kpis.uniqueUsers, data.kpis.uniqueUsersPrev],
        ["sessions", data.kpis.sessions, data.kpis.sessionsPrev],
        ["messages", data.kpis.messages, data.kpis.messagesPrev],
        ["engagement_pct", data.kpis.engagementPct, data.kpis.engagementPctPrev],
        ["conversion_pct", data.kpis.conversionPct, data.kpis.conversionPctPrev],
      ])
    );
  };

  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading analytics…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center p-6">
        <p className="text-[var(--destructive)]">{error || "Unavailable"}</p>
      </div>
    );
  }

  const prevHint = rangeLabel(data.days).toLowerCase();

  return (
    <div className="admin-page admin-an">
      <header className="admin-an-header">
        <div>
          <h1 className="admin-page-title">{hello}</h1>
          <p className="admin-page-subtitle">
            Who signed in, started a session, and paid.
          </p>
        </div>
      </header>

      <main className="admin-main admin-an-main">
        <div className="admin-an-toolbar">
          <div className="admin-an-pills" role="tablist">
            {TAB_ITEMS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`admin-an-pill ${tab === t.id ? "admin-an-pill-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="admin-an-toolbar-right">
            <select
              className="admin-fin-select"
              value={days}
              aria-label="Date range"
              onChange={(e) => {
                setDays(parseAnalyticsDays(e.target.value));
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={28}>Last 4 weeks</option>
              <option value={84}>Last 12 weeks</option>
            </select>
            <button type="button" className="admin-fin-ghost" onClick={exportCurrent}>
              Export
            </button>
          </div>
        </div>

        {tab === "overview" && (
          <>
            <section className="admin-an-kpis">
              <article>
                <div className="admin-an-kpi-top">
                  <p className="admin-fin-label">Unique users</p>
                  <PctChip
                    current={data.kpis.uniqueUsers}
                    previous={data.kpis.uniqueUsersPrev}
                  />
                </div>
                <p className="admin-an-kpi-value">
                  {formatCountCompact(data.kpis.uniqueUsers)}
                </p>
                <p className="admin-fin-hint">
                  from {formatCountCompact(data.kpis.uniqueUsersPrev)} · {prevHint}
                </p>
              </article>
              <article>
                <div className="admin-an-kpi-top">
                  <p className="admin-fin-label">Sessions</p>
                  <PctChip
                    current={data.kpis.sessions}
                    previous={data.kpis.sessionsPrev}
                  />
                </div>
                <p className="admin-an-kpi-value">
                  {formatCountCompact(data.kpis.sessions)}
                </p>
                <p className="admin-fin-hint">
                  from {formatCountCompact(data.kpis.sessionsPrev)} · {prevHint}
                </p>
              </article>
              <article>
                <div className="admin-an-kpi-top">
                  <p className="admin-fin-label">Messages</p>
                  <PctChip
                    current={data.kpis.messages}
                    previous={data.kpis.messagesPrev}
                  />
                </div>
                <p className="admin-an-kpi-value">
                  {formatCountCompact(data.kpis.messages)}
                </p>
                <p className="admin-fin-hint">
                  from {formatCountCompact(data.kpis.messagesPrev)} · {prevHint}
                </p>
              </article>
              <article>
                <div className="admin-an-kpi-top">
                  <p className="admin-fin-label">Engagement</p>
                  <PctChip
                    current={data.kpis.engagementPct}
                    previous={data.kpis.engagementPctPrev}
                  />
                </div>
                <p className="admin-an-kpi-value">
                  {formatPct(data.kpis.engagementPct)}
                </p>
                <p className="admin-fin-hint">
                  Sessions with a user reply · {prevHint}
                </p>
              </article>
              <article>
                <div className="admin-an-kpi-top">
                  <p className="admin-fin-label">Paid conversion</p>
                  <PctChip
                    current={data.kpis.conversionPct}
                    previous={data.kpis.conversionPctPrev}
                  />
                </div>
                <p className="admin-an-kpi-value">
                  {formatPct(data.kpis.conversionPct)}
                </p>
                <p className="admin-fin-hint">
                  Paid among active users · {prevHint}
                </p>
              </article>
            </section>

            <section className="admin-an-mid">
              <section className="admin-fin-card">
                <div className="admin-fin-card-head">
                  <h2 className="admin-fin-card-title">Session quality</h2>
                </div>
                <AdminLineChart
                  points={data.quality}
                  compare={compareQuality}
                  markers={false}
                  fill={false}
                  ariaLabel="Share of sessions with a user reply"
                />
              </section>
              <section className="admin-fin-card">
                <div className="admin-fin-card-head">
                  <div>
                    <h2 className="admin-fin-card-title">This hour</h2>
                    <p className="admin-an-live-value">{data.liveCount}</p>
                    <p className="admin-fin-hint">Messages in the last 60 minutes</p>
                  </div>
                  {data.live ? (
                    <span className="admin-an-live">
                      <i /> Live
                    </span>
                  ) : (
                    <span className="admin-an-muted">Quiet</span>
                  )}
                </div>
                <AdminGroupedBars
                  points={data.hourly.map((h) => ({
                    label: h.label,
                    a: h.user,
                    b: h.assistant,
                  }))}
                  ariaLabel="User and guide messages by hour"
                />
                <ul className="admin-an-mix">
                  {data.mix.length === 0 ? (
                    <li className="admin-fin-empty">No activity in the last day.</li>
                  ) : (
                    data.mix.map((m) => (
                      <li key={m.key}>
                        <span>{m.label}</span>
                        <strong>{m.value}</strong>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </section>

            <section className="admin-an-bottom">
              <section className="admin-fin-card">
                <h2 className="admin-fin-card-title">Session mix</h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Surface</th>
                        <th>Sessions</th>
                        <th>Avg time</th>
                        <th>Bounce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.surfaces.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="admin-table-empty">
                            No sessions in this range.
                          </td>
                        </tr>
                      ) : (
                        data.surfaces.map((s) => (
                          <tr key={s.key}>
                            <td>{s.label}</td>
                            <td>{formatCountCompact(s.count)}</td>
                            <td>{formatAvgDuration(s.avgSeconds)}</td>
                            <td>{formatPct(s.bouncePct)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="admin-fin-card">
                <h2 className="admin-fin-card-title">New users</h2>
                <div className="admin-an-source-tabs">
                  <span className="admin-an-source-tab-active">Sources</span>
                </div>
                <MixBars rows={data.sources} />
              </section>
            </section>
          </>
        )}

        {tab === "audience" && (
          <Breakdown
            title="Who was active"
            hint={`Signed in, or started a session, in ${rangeLabel(data.days).toLowerCase()}.`}
            totalLabel="People"
            rows={data.audience}
            notes={PLAN_NOTES}
            empty="Nobody signed in or started a session in this range."
          />
        )}

        {tab === "acquisition" && (
          <Breakdown
            title="New accounts"
            hint={`Accounts created in ${rangeLabel(data.days).toLowerCase()}.`}
            totalLabel="New accounts"
            rows={data.sources}
            notes={SOURCE_NOTES}
            empty="No new accounts in this range."
          />
        )}

        {tab === "engagement" && (
          <>
            <section className="admin-fin-card">
              <h2 className="admin-fin-card-title">Sessions with a reply</h2>
              <p className="admin-fin-hint">
                A session counts when the person wrote at least one message.
              </p>
              <p className="admin-an-break-total">{formatPct(data.kpis.engagementPct)}</p>
              <p className="admin-fin-hint">
                {formatCountCompact(data.kpis.sessions)} sessions in{" "}
                {rangeLabel(data.days).toLowerCase()}
              </p>
              <AdminLineChart
                points={data.quality}
                compare={compareQuality}
                markers={false}
                fill={false}
                ariaLabel="Share of sessions with a reply, by day"
              />
            </section>
            <section className="admin-fin-card">
              <h2 className="admin-fin-card-title">By session type</h2>
              <p className="admin-fin-hint">
                Average time is how long the session stayed open. Bounce means they left without writing.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Count</th>
                      <th>Average time</th>
                      <th>Left without writing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.surfaces.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="admin-table-empty">
                          No sessions in this range.
                        </td>
                      </tr>
                    ) : (
                      data.surfaces.map((s) => (
                        <tr key={s.key}>
                          <td>{s.label}</td>
                          <td>{formatCountCompact(s.count)}</td>
                          <td>{formatAvgDuration(s.avgSeconds)}</td>
                          <td>{formatPct(s.bouncePct)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === "conversions" && (
          <Breakdown
            title="Billing"
            hint={`Checkout, trial, paid, and failed charges in ${rangeLabel(data.days).toLowerCase()}.`}
            totalLabel="Events"
            rows={data.conversions}
            notes={BILLING_NOTES}
            empty="No checkout, trial, or charge in this range."
          />
        )}
      </main>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading analytics…</p>
        </div>
      }
    >
      <AdminAnalyticsPageInner />
    </Suspense>
  );
}
