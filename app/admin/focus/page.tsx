"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { fetchJson } from "@/lib/fetch-json";
import type { FocusTopicCount, SessionFocus } from "@/lib/session-focus-topics";

const WINDOWS = [30, 90, 365] as const;

function sessionLabel(count: number): string {
  return count === 1 ? "1 session" : `${count} sessions`;
}

function peopleLabel(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

function AimCopy({ summary }: { summary: SessionFocus }) {
  const live = summary.topics.filter((topic) => topic.people >= 3);
  if (live.length === 0) {
    return <p className="admin-focus-lead">Nothing to aim at yet.</p>;
  }
  return (
    <p className="admin-focus-lead">Lead with {live.map((topic) => topic.label).join(", ")}.</p>
  );
}

function TopicTable({ rows }: { rows: FocusTopicCount[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-focus-table">
        <thead>
          <tr>
            <th>Theme</th>
            <th>Sessions</th>
            <th>People</th>
            <th>Share</th>
            <th>Search</th>
            <th>Blog</th>
            <th>What to do</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.people >= 3 ? "is-live" : undefined}>
              <td>{row.label}</td>
              <td>{row.sessions}</td>
              <td>{row.people}</td>
              <td>{row.sharePct}%</td>
              <td>{row.search}</td>
              <td>
                {row.blogPath ? (
                  <Link href={row.blogPath} className="admin-link">
                    Open category
                  </Link>
                ) : (
                  "None yet"
                )}
              </td>
              <td>{row.aim}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminFocusPage() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(90);
  const [summary, setSummary] = useState<SessionFocus | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchJson<{ summary: SessionFocus }>(`/api/admin/focus?days=${days}`)
      .then((res) => {
        if (!cancelled) setSummary(res.summary);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load focus.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const copySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy.");
    }
  };

  const liveCount = summary?.topics.filter((topic) => topic.people >= 3).length ?? 0;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Focus"
        subtitle="Themes to aim at in search and ads."
      />
      <main className="admin-main admin-main-wide">
        <div className="admin-panel-head-row">
          <div className="admin-places-windows" role="group" aria-label="Time window">
            {WINDOWS.map((windowDays) => (
              <button
                key={windowDays}
                type="button"
                className={`btn-secondary${days === windowDays ? " is-active" : ""}`}
                aria-pressed={days === windowDays}
                onClick={() => setDays(windowDays)}
              >
                {windowDays} days
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary shrink-0"
            disabled={!summary}
            onClick={() => void copySummary()}
          >
            {copied ? "Copied" : "Copy summary"}
          </button>
        </div>

        {loading ? <p className="admin-panel-sub">Loading…</p> : null}
        {error ? <p className="text-[var(--destructive)]">{error}</p> : null}

        {summary ? (
          <>
            <section className="admin-stat-grid">
              <article className="admin-stat-card">
                <p className="admin-stat-label">Sessions</p>
                <p className="admin-stat-value">{summary.sessions}</p>
                <p className="admin-stat-hint">With enough text to read a theme.</p>
              </article>
              <article className="admin-stat-card">
                <p className="admin-stat-label">People</p>
                <p className="admin-stat-value">{summary.people}</p>
                <p className="admin-stat-hint">Distinct accounts in this window.</p>
              </article>
              <article className="admin-stat-card">
                <p className="admin-stat-label">Ready to aim</p>
                <p className="admin-stat-value">{liveCount}</p>
                <p className="admin-stat-hint">Themes with at least 3 people.</p>
              </article>
              <article className="admin-stat-card">
                <p className="admin-stat-label">No clear topic</p>
                <p className="admin-stat-value">{summary.unclear.sessions}</p>
                <p className="admin-stat-hint">
                  {summary.unclearHidden
                    ? "Hidden until 3 people."
                    : `${peopleLabel(summary.unclear.people)} · ${summary.unclear.sharePct}%`}
                </p>
              </article>
            </section>

            <section className="admin-panel">
              <h2 className="admin-panel-title">Where to aim</h2>
              <AimCopy summary={summary} />
              <TopicTable rows={summary.topics} />
            </section>

            <section className="admin-panel">
              <h2 className="admin-panel-title">Languages</h2>
              {summary.languages.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Language</th>
                        <th>Sessions</th>
                        <th>People</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.languages.map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>{sessionLabel(row.sessions)}</td>
                          <td>{peopleLabel(row.people)}</td>
                          <td>{row.sharePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-panel-sub">None yet.</p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
