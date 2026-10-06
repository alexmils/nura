"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CreditCard,
  LifeBuoy,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { InviteForm } from "@/app/components/admin/InviteForm";
import {
  AdminSegmentBar,
  AdminStackedBars,
  CHART_SLICE_COLORS,
  DeltaBadge,
} from "@/app/components/admin/AdminCharts";
import { AdminTasksOverviewCard } from "@/app/components/admin/AdminTasksOverviewCard";
import { PlatformHealthCard } from "@/app/components/admin/PlatformHealthCard";
import { actionLabel, formatDateTime, formatMoney } from "@/lib/admin-format";
import { formatTokenCount, formatUsdMicros } from "@/lib/admin-llm-format";
import type { AdminDashboardStats } from "@/lib/admin-stats";
import type { AuditEvent } from "@/lib/audit-log";
import { fetchJson } from "@/lib/fetch-json";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [statsRes, eventsRes] = await Promise.all([
      fetchJson<{ stats: AdminDashboardStats }>("/api/admin/stats"),
      fetchJson<{ events: AuditEvent[] }>("/api/admin/events?limit=8"),
    ]);
    setStats(statsRes.stats);
    setEvents(eventsRes.events ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        setError("Could not load overview.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const chartPoints = useMemo(() => {
    if (!stats?.series7d) return [];
    return stats.series7d.map((d) => ({
      label: d.label,
      a: d.messages,
      b: Math.round(d.tokens / 100),
      c: d.newUsers * 5,
      tip: {
        messages: d.messages,
        tokens: d.tokens,
        newUsers: d.newUsers,
      },
    }));
  }, [stats]);

  const purposeSlices = useMemo(() => {
    if (!stats) return [];
    const rows =
      stats.llmByPurpose.length > 0
        ? stats.llmByPurpose
        : [{ key: "none", label: "No AI usage yet", costUsdMicros: 1, tokens: 0, callCount: 0 }];
    return rows.map((r, i) => ({
      key: r.key,
      label: r.label,
      value: r.costUsdMicros || r.tokens || 1,
      color: CHART_SLICE_COLORS[i % CHART_SLICE_COLORS.length],
    }));
  }, [stats]);

  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center p-6">
        <p className="text-[var(--destructive)]">{error || "Unavailable"}</p>
      </div>
    );
  }

  const weekTokens = stats.llm.tokensThisWeek;
  const weekCost = stats.llm.costUsdMicrosThisWeek;
  const weekMessages = stats.series7d.reduce((s, d) => s + d.messages, 0);

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Overview"
        subtitle="Users, sessions, AI cost, and health."
      />
      <main className="admin-main">
        <section className="admin-dash-kpis">
          <article className="admin-dash-kpi">
            <p className="admin-stat-label">Users</p>
            <p className="admin-stat-value">{stats.users.total}</p>
            <DeltaBadge
              current={stats.users.newThisMonth}
              previous={stats.users.newLastMonth}
            />
          </article>
          <article className="admin-dash-kpi">
            <p className="admin-stat-label">MRR</p>
            <p className="admin-stat-value">
              {formatMoney(stats.billing.mrrCents, stats.billing.currency)}
            </p>
            <p className="admin-stat-hint">
              {stats.billing.activePaid} paying · {stats.billing.paidSharePct}%
              share
            </p>
          </article>
          <article className="admin-dash-kpi">
            <p className="admin-stat-label">AI cost (week)</p>
            <p className="admin-stat-value">{formatUsdMicros(weekCost)}</p>
            <p className="admin-stat-hint">
              {formatTokenCount(weekTokens)} tokens
              {stats.voice.charsThisWeek > 0
                ? ` · ${formatTokenCount(stats.voice.charsThisWeek)} voice chars`
                : ""}
            </p>
          </article>
          <article className="admin-dash-kpi">
            <p className="admin-stat-label">AI cost (month)</p>
            <p className="admin-stat-value">
              {formatUsdMicros(stats.llm.costUsdMicrosThisMonth)}
            </p>
            <DeltaBadge
              current={stats.llm.costUsdMicrosThisMonth}
              previous={stats.llm.costUsdMicrosLastMonth}
            />
          </article>
          <article className="admin-dash-kpi">
            <p className="admin-stat-label">Messages (month)</p>
            <p className="admin-stat-value">
              {stats.sessions.messagesThisMonth}
            </p>
            <DeltaBadge
              current={stats.sessions.messagesThisMonth}
              previous={stats.sessions.messagesLastMonth}
            />
          </article>
        </section>

        <div className="admin-dash-grid">
          <AdminTasksOverviewCard />
          <section className="admin-panel admin-dash-span-2">
            <div className="admin-panel-head-row">
              <div>
                <h2 className="admin-panel-title">Last 7 days</h2>
                <p className="admin-panel-sub">
                  Messages, tokens (÷100), new users (×5). Hover a day for exact
                  counts.
                </p>
              </div>
            </div>
            <div className="admin-chart-wrap">
              <AdminStackedBars points={chartPoints} />
            </div>
            <div className="admin-chart-legend">
              <span>
                <i style={{ background: "#84B067" }} /> Messages ({weekMessages})
              </span>
              <span>
                <i style={{ background: "#C6D67E" }} /> Tokens (~
                {formatTokenCount(weekTokens)})
              </span>
              <span>
                <i style={{ background: "#E8A87C" }} /> New users
              </span>
            </div>
          </section>

          <section className="admin-panel admin-dash-side-stats">
            <h2 className="admin-panel-title">Snapshot</h2>
            <div className="admin-dash-side-row">
              <div>
                <p className="admin-stat-label">Sessions</p>
                <p className="admin-dash-side-value">
                  {stats.sessions.totalThreads}
                </p>
              </div>
            </div>
            <div className="admin-dash-side-row">
              <div>
                <p className="admin-stat-label">AI tokens (month)</p>
                <p className="admin-dash-side-value">
                  {formatTokenCount(stats.llm.tokensThisMonth)}
                </p>
                <DeltaBadge
                  current={stats.llm.tokensThisMonth}
                  previous={stats.llm.tokensLastMonth}
                />
              </div>
            </div>
            <div className="admin-dash-side-row">
              <div>
                <p className="admin-stat-label">ElevenLabs voice (month)</p>
                <p className="admin-dash-side-value">
                  {formatTokenCount(stats.voice.charsThisMonth)}
                </p>
                <p className="admin-stat-hint">
                  {formatUsdMicros(stats.voice.costUsdMicrosThisMonth)} ·{" "}
                  {stats.voice.callsThisMonth} calls
                </p>
              </div>
            </div>
            <div className="admin-dash-side-row">
              <div>
                <p className="admin-stat-label">AI calls (month)</p>
                <p className="admin-dash-side-value">
                  {stats.llm.callsThisMonth}
                </p>
              </div>
            </div>
            <div className="admin-dash-side-row">
              <div>
                <p className="admin-stat-label">Team</p>
                <p className="admin-dash-side-value">
                  {stats.users.admins} admin · {stats.users.support} support
                </p>
              </div>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-head-row">
              <h2 className="admin-panel-title">AI cost mix</h2>
              <Link href="/admin/billing?tab=usage" className="admin-link">
                Usage
              </Link>
            </div>
            <p className="admin-dash-cost-total">
              {formatUsdMicros(stats.llm.costUsdMicrosThisMonth)}
              <span> this month</span>
            </p>
            <AdminSegmentBar slices={purposeSlices} />
            <ul className="admin-dash-legend-list">
              {purposeSlices.map((s) => {
                const total = purposeSlices.reduce((a, x) => a + x.value, 0) || 1;
                const pct = Math.round((s.value / total) * 100);
                return (
                  <li key={s.key}>
                    <span
                      className="admin-dash-swatch"
                      style={{ background: s.color }}
                    />
                    <span>{s.label}</span>
                    <strong>{pct}%</strong>
                  </li>
                );
              })}
            </ul>
          </section>

          <PlatformHealthCard />

          <section className="admin-panel">
            <h2 className="admin-panel-title">Paying share</h2>
            <p className="admin-dash-cost-total">
              {stats.billing.paidSharePct}%
              <span> of users on a paid plan</span>
            </p>
            <div className="admin-progress-track">
              <div
                className="admin-progress-fill"
                style={{
                  width: `${Math.min(100, stats.billing.paidSharePct)}%`,
                }}
              />
            </div>
            <p className="admin-panel-sub">
              {stats.billing.activePaid} paying · MRR{" "}
              {formatMoney(stats.billing.mrrCents, stats.billing.currency)}
            </p>
            <div className="admin-dash-quick">
              <Link href="/admin/users?tab=invite" className="admin-dash-quick-btn">
                <Users size={18} />
                Invite
              </Link>
              <Link href="/admin/billing?tab=stripe" className="admin-dash-quick-btn">
                <CreditCard size={18} />
                Billing
              </Link>
              <Link href="/admin/help?tab=inbox" className="admin-dash-quick-btn">
                <LifeBuoy size={18} />
                Help
              </Link>
              <Link href="/admin/email?tab=delivery" className="admin-dash-quick-btn">
                <Mail size={18} />
                Email
              </Link>
              <Link href="/admin/ai?tab=ai" className="admin-dash-quick-btn">
                <Sparkles size={18} />
                AI
              </Link>
              <Link href="/admin/activity" className="admin-dash-quick-btn">
                <Activity size={18} />
                Activity
              </Link>
            </div>
          </section>
        </div>

        <div className="admin-two-col">
          <section className="admin-panel">
            <h2 className="admin-panel-title">Quick invite</h2>
            <p className="admin-panel-sub">
              Sends an invite email with a create-password link.
            </p>
            <InviteForm onSuccess={() => void load()} />
          </section>

          <section className="admin-panel">
            <div className="admin-panel-head-row">
              <h2 className="admin-panel-title">Recent activity</h2>
              <Link href="/admin/activity" className="admin-link">
                View all
              </Link>
            </div>
            <ul className="admin-dash-feed">
              {events.length === 0 && (
                <li className="admin-dash-feed-empty">No events yet</li>
              )}
              {events.map((ev) => (
                <li key={ev.id} className="admin-dash-feed-item">
                  <span className="admin-dash-feed-dot" />
                  <div className="admin-dash-feed-body">
                    <p className="admin-dash-feed-title">
                      {actionLabel(ev.action)}
                    </p>
                    <p className="admin-dash-feed-meta">
                      {ev.actorEmail ?? "System"} ·{" "}
                      {formatDateTime(ev.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
