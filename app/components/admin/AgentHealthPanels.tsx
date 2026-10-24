"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { formatDateTime } from "@/lib/admin-format";
import {
  formatRate,
  STUCK_MESSAGE_THRESHOLD,
  type AgentThreadHealth,
  type InterpreterHealth,
} from "@/lib/agent-health-format";
import type { AgentHealthOverview } from "@/lib/agent-health";
import { fetchJson } from "@/lib/fetch-json";

function InterpreterLine({ h }: { h: InterpreterHealth }) {
  const failures = h.cutoff + h.unparsed + h.legacyCapHits;
  return (
    <p className="admin-panel-sub" data-testid="interpreter-health">
      Interpreter: {h.calls} calls, {failures} failed ({formatRate(h.failureRate)})
      {h.calls > 0
        ? ` \u00b7 cut off ${h.cutoff}, unparsed ${h.unparsed}, old 512 cap ${h.legacyCapHits}`
        : ""}
    </p>
  );
}

function StuckBadge() {
  return (
    <span
      className="admin-pay-status admin-pay-status--failed"
      title={`${STUCK_MESSAGE_THRESHOLD}+ messages and no completed set`}
    >
      No set
    </span>
  );
}

/** User detail: one row per guided thread. */
export function UserAgentHealthPanel({
  threads,
  interpreter,
  footer,
}: {
  threads: AgentThreadHealth[];
  interpreter: InterpreterHealth;
  /** e.g. "Showing 5 of 23" + Load more. */
  footer?: ReactNode;
}) {
  return (
    <section className="admin-panel" data-testid="user-agent-health">
      <h2 className="admin-panel-title">Guided sessions</h2>
      <InterpreterLine h={interpreter} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Session</th>
              <th>Phase</th>
              <th>Messages</th>
              <th>Sets</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {threads.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-table-empty">
                  No guided sessions
                </td>
              </tr>
            )}
            {threads.map((t) => (
              <tr key={t.threadId}>
                <td>{formatDateTime(t.createdAt)}</td>
                <td>{t.title}</td>
                <td>{t.phase}</td>
                <td>{t.messageCount}</td>
                <td>{t.setCount}</td>
                <td>{t.stuck ? <StuckBadge /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  );
}

/** Admin overview: guided health over the last 30 days. */
export function AgentHealthOverviewCard() {
  const [data, setData] = useState<AgentHealthOverview | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchJson<{ overview: AgentHealthOverview }>("/api/admin/agent-health?days=30")
      .then((r) => alive && setData(r.overview))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="admin-panel" data-testid="agent-health-overview">
      <h2 className="admin-panel-title">Guided sessions health</h2>
      {error ? <p className="admin-panel-sub">Could not load.</p> : null}
      {!data && !error ? <p className="admin-panel-sub">Loading…</p> : null}
      {data ? (
        <>
          <p className="admin-panel-sub">
            Last {data.days} days: {data.guidedThreads} guided sessions,{" "}
            {data.threadsWithSets} reached a set
            {data.avgSetsPerThread != null
              ? `, ${data.avgSetsPerThread} sets per session on average`
              : ""}
            .
          </p>
          <InterpreterLine h={data.interpreter} />
          {data.stuckThreads.length > 0 ? (
            <ul className="admin-dash-legend-list">
              {data.stuckThreads.slice(0, 8).map((t) => (
                <li key={t.threadId}>
                  <StuckBadge />{" "}
                  {t.userId ? (
                    <Link href={`/admin/users/${t.userId}`} className="admin-link">
                      {t.userEmail}
                    </Link>
                  ) : (
                    t.userEmail
                  )}{" "}
                  · {t.messageCount} messages, phase {t.phase}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-panel-sub">
              No session with {STUCK_MESSAGE_THRESHOLD}+ messages and zero sets.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
