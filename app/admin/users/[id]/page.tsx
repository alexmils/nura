"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import {
  actionLabel,
  formatDate,
  formatDateTime,
  formatMoney,
  paymentStatusLabel,
} from "@/lib/admin-format";
import {
  formatTokenCount,
  formatUsdMicros,
} from "@/lib/admin-llm-format";
import type { AdminUserDetail } from "@/lib/admin-user-detail";
import { formatRetentionActionLabel } from "@/lib/subscription-retention-shared";
import { fetchJson } from "@/lib/fetch-json";
import { UserAgentHealthPanel } from "@/app/components/admin/AgentHealthPanels";

function shortStripeId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [myRole, setMyRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const me = await fetchJson<{ user?: { role?: string } }>("/api/auth/me");
    setMyRole(me.user?.role ?? "user");
    const res = await fetchJson<{ user: AdminUserDetail }>(
      `/api/admin/users/${userId}`
    );
    setDetail(res.user);
  }, [userId]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        setError("Could not load user.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const canWrite = myRole === "platform_admin";

  const toggleStats = async () => {
    if (!detail) return;
    const next = !detail.statsExcluded;
    setBusy(true);
    setMsg("");
    try {
      await fetchJson(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statsExcluded: next }),
      });
      setMsg(next ? "Ignored in stats." : "Counted in stats.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!detail) return;
    const next = detail.status === "disabled" ? "active" : "disabled";
    const label = next === "disabled" ? "disable" : "enable";
    if (!window.confirm(`${label} ${detail.email}?`)) return;
    setBusy(true);
    setMsg("");
    try {
      await fetchJson(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setMsg(`User ${next === "disabled" ? "disabled" : "enabled"}.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async () => {
    setBusy(true);
    setMsg("");
    try {
      await fetchJson(`/api/admin/users/${userId}/resend-invite`, {
        method: "POST",
      });
      setMsg("Invitation resent.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center p-6">
        <p className="text-[var(--destructive)]">{error || "Not found"}</p>
      </div>
    );
  }

  const currency = detail.currency ?? "USD";
  const loginHistory = detail.loginHistory ?? [];
  const paymentHistory = detail.paymentHistory ?? [];

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={detail.email}
        subtitle={detail.name ?? "User profile and usage"}
      />
      <main className="admin-main">
        <p className="admin-back-link">
          <Link href="/admin/users">← Back to users</Link>
        </p>

        <section className="admin-stat-grid">
          <article className="admin-stat-card">
            <p className="admin-stat-label">Threads</p>
            <p className="admin-stat-value">{detail.threadCount}</p>
          </article>
          <article className="admin-stat-card">
            <p className="admin-stat-label">Messages</p>
            <p className="admin-stat-value">{detail.messageCount}</p>
          </article>
          <article className="admin-stat-card">
            <p className="admin-stat-label">AI tokens</p>
            <p className="admin-stat-value">
              {formatTokenCount(detail.llmTotalTokens ?? 0)}
            </p>
            <p className="admin-stat-hint">
              {detail.llmCallCount ?? 0} calls · in{" "}
              {formatTokenCount(detail.llmPromptTokens ?? 0)} / out{" "}
              {formatTokenCount(detail.llmCompletionTokens ?? 0)}
            </p>
          </article>
          <article className="admin-stat-card">
            <p className="admin-stat-label">Est. AI cost</p>
            <p className="admin-stat-value">
              {formatUsdMicros(detail.llmCostUsdMicros ?? 0)}
            </p>
            <p className="admin-stat-hint">Provider list price (USD)</p>
          </article>
          <article className="admin-stat-card">
            <p className="admin-stat-label">Plan</p>
            <p className="admin-stat-value">{detail.plan}</p>
            <p className="admin-stat-hint">{detail.subscriptionStatus}</p>
          </article>
          <article className="admin-stat-card">
            <p className="admin-stat-label">Billing</p>
            <p className="admin-stat-value">
              {formatMoney(detail.amountCents, currency)}
            </p>
            {detail.renewsAt ? (
              <p className="admin-stat-hint">
                Renews {formatDate(detail.renewsAt)}
              </p>
            ) : detail.trialEndsAt ? (
              <p className="admin-stat-hint">
                Trial ends {formatDate(detail.trialEndsAt)}
              </p>
            ) : null}
          </article>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel-title">Profile</h2>
          <dl className="admin-dl">
            <div>
              <dt>Role</dt>
              <dd>{detail.role}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{detail.status}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
            </div>
            <div>
              <dt>Last login</dt>
              <dd>{formatDateTime(detail.lastLoginAt)}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>{detail.hasPassword ? "Set" : "Not set"}</dd>
            </div>
            <div>
              <dt>Email verified</dt>
              <dd>{detail.emailVerified ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Stats</dt>
              <dd>{detail.statsExcluded ? "Ignored" : "Counted"}</dd>
            </div>
          </dl>

          {canWrite && (
            <div className="admin-actions-row">
              {!detail.hasPassword && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void resendInvite()}
                >
                  Resend invite
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void toggleStats()}
              >
                {detail.statsExcluded ? "Count in stats" : "Ignore in stats"}
              </button>
              <button
                type="button"
                className={
                  detail.status === "disabled" ? "btn-primary" : "btn-secondary"
                }
                disabled={busy}
                onClick={() => void toggleStatus()}
              >
                {detail.status === "disabled" ? "Enable user" : "Disable user"}
              </button>
            </div>
          )}
          {msg && <p className="admin-invite-msg">{msg}</p>}
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel-title">Subscription</h2>
          <p className="admin-panel-sub">
            Trial end, renew date, and Stripe link for this account.
          </p>
          <dl className="admin-dl">
            <div>
              <dt>Plan</dt>
              <dd>{detail.plan}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{detail.subscriptionStatus}</dd>
            </div>
            <div>
              <dt>Access tier</dt>
              <dd>{detail.accessTier ?? "none"}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(detail.amountCents, currency)}</dd>
            </div>
            <div>
              <dt>Trial ends</dt>
              <dd>
                {detail.trialEndsAt
                  ? formatDateTime(detail.trialEndsAt)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Renews</dt>
              <dd>
                {detail.renewsAt ? formatDateTime(detail.renewsAt) : "—"}
              </dd>
            </div>
            <div>
              <dt>Stripe mode</dt>
              <dd>
                {detail.stripeLivemode === true
                  ? "Live"
                  : detail.stripeLivemode === false
                    ? "Sandbox"
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>Last Stripe sync</dt>
              <dd>
                {detail.lastStripeEventAt
                  ? formatDateTime(detail.lastStripeEventAt)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd title={detail.stripeCustomerId ?? undefined}>
                {shortStripeId(detail.stripeCustomerId)}
              </dd>
            </div>
            <div>
              <dt>Subscription</dt>
              <dd title={detail.stripeSubscriptionId ?? undefined}>
                {shortStripeId(detail.stripeSubscriptionId)}
              </dd>
            </div>
          </dl>
          {detail.retentionEvents.length > 0 ? (
            <div className="admin-cancel-feedback mt-4">
              <h3 className="admin-cancel-feedback-title">
                Retention offer (monthly)
              </h3>
              <ul className="admin-cancel-feedback-list">
                {detail.retentionEvents.map((ev, i) => (
                  <li key={`${ev.at}-${ev.action}-${i}`}>
                    {formatDateTime(ev.at)} ·{" "}
                    {formatRetentionActionLabel(
                      ev.action as "offered" | "accepted" | "declined"
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detail.latestCancelFeedback ? (
            <div className="admin-cancel-feedback mt-4">
              <h3 className="admin-cancel-feedback-title">Latest cancel feedback</h3>
              <p className="admin-panel-sub">
                {formatDateTime(detail.latestCancelFeedback.at)}
              </p>
              <ul className="admin-cancel-feedback-list">
                {detail.latestCancelFeedback.labels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
              {detail.latestCancelFeedback.comment ? (
                <p className="admin-cancel-feedback-comment">
                  {detail.latestCancelFeedback.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {detail.agentHealth ? (
          <UserAgentHealthPanel
            threads={detail.agentHealth.threads}
            interpreter={detail.agentHealth.interpreter}
          />
        ) : null}

        <section className="admin-panel">
          <h2 className="admin-panel-title">Billing / payments</h2>
          <p className="admin-panel-sub">
            What they paid, when, and whether it succeeded.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">
                      {detail.paymentHistoryNote ?? "No payment events yet"}
                    </td>
                  </tr>
                )}
                {paymentHistory.map((pay) => (
                  <tr key={pay.id}>
                    <td>{formatDateTime(pay.occurredAt)}</td>
                    <td>{pay.description ?? pay.eventType}</td>
                    <td>
                      {formatMoney(pay.amountCents, pay.currency || currency)}
                    </td>
                    <td>
                      <span
                        className={
                          pay.status === "failed"
                            ? "admin-pay-status admin-pay-status--failed"
                            : pay.status === "succeeded"
                              ? "admin-pay-status admin-pay-status--ok"
                              : "admin-pay-status"
                        }
                      >
                        {paymentStatusLabel(pay.status)}
                      </span>
                    </td>
                    <td className="text-[var(--text-muted)]">
                      {pay.livemode === true
                        ? "Live"
                        : pay.livemode === false
                          ? "Sandbox"
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel-title">Login history</h2>
          <p className="admin-panel-sub">When they signed in or out.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.length === 0 && (
                  <tr>
                    <td colSpan={3} className="admin-table-empty">
                      No sign-in events recorded yet
                    </td>
                  </tr>
                )}
                {loginHistory.map((ev) => (
                  <tr key={ev.id}>
                    <td>{formatDateTime(ev.createdAt)}</td>
                    <td>{actionLabel(ev.action)}</td>
                    <td className="text-[var(--text-muted)]">
                      {ev.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
