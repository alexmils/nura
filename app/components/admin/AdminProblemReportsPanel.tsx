"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ProblemReport } from "@/lib/problem-reports";
import {
  PROBLEM_CATEGORY_LABEL,
  PROBLEM_EVENT_LABEL,
  PROBLEM_SOURCE_LABEL,
  PROBLEM_STATUS_LABEL,
  WINBACK_MODE_NOTE,
  winbackModeFor,
  type ProblemReportStatus,
  type WinbackEmailDraft,
} from "@/lib/problem-report-rules";
import { WinbackEmailEditor, type WinbackDraft } from "./WinbackEmailEditor";

const STATUS_CHIP: Record<ProblemReportStatus, string> = {
  new: "admin-status-chip-default",
  confirmed: "admin-status-chip-fail",
  dismissed: "admin-status-chip-off",
  winback_sent: "admin-status-chip-ok",
};

const LINK_LABEL: Record<ProblemReport["linkStatus"], string> = {
  none: "No link",
  generated: "Link generated",
  sent: "Link sent",
  opened: "Link opened",
  used: "Used: trial started",
  expired: "Link expired",
};

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "";
}

type Draft = WinbackDraft;

/**
 * Problem reports: people who told the AI guide the app is not working.
 * Confirm or dismiss, keep a note, and for a confirmed problem generate a
 * win-back link (same system as the Win-back tab) and send the email.
 */
export function AdminProblemReportsPanel(props: {
  /** Only this person's reports (admin single-user page). */
  userId?: string;
  /** Inside another card: no outer panel, all reports shown. */
  embedded?: boolean;
  /** Called after a change (e.g. a win-back email went out). */
  onChanged?: () => void;
} = {}) {
  const { userId, embedded, onChanged } = props;
  const [rows, setRows] = useState<ProblemReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<"open" | "all">(userId ? "all" : "open");

  const load = useCallback(async () => {
    try {
      const url = userId
        ? `/api/admin/problem-reports?userId=${encodeURIComponent(userId)}`
        : "/api/admin/problem-reports";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { reports?: ProblemReport[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRows(data.reports ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.startsWith("#problem-")) setOpen(hash.slice("#problem-".length));
  }, [load]);

  async function post(id: string, payload: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/problem-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const data = (await res.json()) as {
        error?: string;
        report?: ProblemReport;
        link?: string;
        draft?: WinbackEmailDraft;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: ProblemReportStatus) {
    if (await post(id, { action: "status", status })) await load();
  }

  async function saveNote(r: ProblemReport) {
    if (await post(r.id, { action: "note", note: notes[r.id] ?? r.adminNote ?? "" })) await load();
  }

  async function generate(r: ProblemReport) {
    const data = await post(r.id, { action: "generate_winback" });
    if (data?.draft && data.link) {
      setDrafts((m) => ({ ...m, [r.id]: { ...data.draft!, link: data.link! } }));
      await load();
    }
  }

  async function send(r: ProblemReport) {
    const d = drafts[r.id];
    if (!d) return;
    const data = await post(r.id, { action: "send_winback", subject: d.subject, body: d.body });
    if (data) {
      setDrafts((m) => {
        const next = { ...m };
        delete next[r.id];
        return next;
      });
      await load();
      onChanged?.();
    }
  }

  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === "new" || r.status === "confirmed");

  const Wrap = embedded ? "div" : "section";
  return (
    <Wrap className={embedded ? undefined : "admin-panel"} data-testid={embedded ? "user-problem-reports" : "admin-problem-reports"}>
      {embedded ? (
        <h3 className="admin-panel-title" style={{ fontSize: "1rem", marginTop: "1.25rem" }}>Problem reports</h3>
      ) : (
        <h2 className="admin-panel-title">Problem reports</h2>
      )}
      {embedded ? null : (
      <p className="admin-panel-sub">
        People who told the AI guide that the app is not working (ball not visible or stuck, no sound,
        page not loading, a button doing nothing, an error). Detected automatically in the chat; the
        guide&apos;s reply is not changed. Confirm a real problem to offer a win-back month: the link comes
        from the same system as the Win-back tab (one link per person), and the email only goes out when
        you press Send.
      </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.5rem 0 1rem" }}>
        <button type="button" className="admin-btn" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>
          Open
        </button>
        <button type="button" className="admin-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All
        </button>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="admin-panel-sub">Error: {error}</p> : null}
      {!rows && !error ? <p className="admin-panel-sub">Loading...</p> : null}
      {rows && shown.length === 0 ? (
        <p className="admin-panel-sub">{filter === "open" ? "No open problem reports." : "No problem reports yet."}</p>
      ) : null}
      {shown.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Detected</th>
                <th>What they wrote</th>
                <th>Category</th>
                <th>Where</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const isOpen = open === r.id;
                const draft = drafts[r.id];
                return (
                  <ReportRows
                    key={r.id}
                    r={r}
                    isOpen={isOpen}
                    busy={busy === r.id}
                    draft={draft}
                    note={notes[r.id] ?? r.adminNote ?? ""}
                    onToggle={() => setOpen(isOpen ? null : r.id)}
                    onStatus={(s) => void setStatus(r.id, s)}
                    onNote={(v) => setNotes((m) => ({ ...m, [r.id]: v }))}
                    onSaveNote={() => void saveNote(r)}
                    onGenerate={() => void generate(r)}
                    onDraft={(d) => setDrafts((m) => ({ ...m, [r.id]: d }))}
                    onSend={() => void send(r)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Wrap>
  );
}

function ReportRows(props: {
  r: ProblemReport;
  isOpen: boolean;
  busy: boolean;
  draft: Draft | undefined;
  note: string;
  onToggle: () => void;
  onStatus: (s: ProblemReportStatus) => void;
  onNote: (v: string) => void;
  onSaveNote: () => void;
  onGenerate: () => void;
  onDraft: (d: Draft) => void;
  onSend: () => void;
}) {
  const { r, isOpen, busy, draft } = props;
  const mode = winbackModeFor({ status: r.subscriptionStatus, cancelAtPeriodEnd: r.cancelAtPeriodEnd });
  return (
    <>
      <tr id={`problem-${r.id}`} data-testid="problem-report-row">
        <td>
          <Link href={`/admin/users/${r.userId}`} className="admin-link">
            {r.userEmail}
          </Link>
        </td>
        <td>
          {fmt(r.lastDetectedAt)}
          {r.hitCount > 1 ? ` (${r.hitCount} messages)` : ""}
        </td>
        <td style={{ maxWidth: "22rem", whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
          {r.excerpt.length > 160 && !isOpen ? `${r.excerpt.slice(0, 160)}\u2026` : r.excerpt}
        </td>
        <td>
          {PROBLEM_CATEGORY_LABEL[r.category] ?? r.category}
          {r.language ? ` \u00b7 ${r.language}` : ""}
        </td>
        <td style={{ fontSize: "0.85rem" }}>
          <span data-testid="problem-report-source">{PROBLEM_SOURCE_LABEL[r.source] ?? r.source}</span>
          <br />
          {r.source === "help_chat" && r.helpThreadId ? (
            <Link href={`/admin/help?thread=${encodeURIComponent(r.helpThreadId)}`} className="admin-link">
              Open help thread
            </Link>
          ) : r.threadId ? (
            <Link href={`/admin/users/${r.userId}`} className="admin-link" title={r.threadId}>
              {r.threadTitle || `Session ${r.threadId.slice(0, 8)}`}
            </Link>
          ) : null}
        </td>
        <td>
          <span className={`admin-status-chip ${STATUS_CHIP[r.status]}`} data-testid="problem-report-status">
            {PROBLEM_STATUS_LABEL[r.status]}
          </span>
        </td>
        <td>
          <button type="button" className="admin-btn" onClick={props.onToggle} aria-expanded={isOpen}>
            {isOpen ? "Close" : "Open"}
          </button>
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td colSpan={7} style={{ background: "rgba(42, 48, 32, 0.03)" }}>
            <div style={{ display: "grid", gap: "1rem", padding: "0.75rem 0.25rem", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
              <div style={{ display: "grid", gap: "0.75rem", alignContent: "start" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {r.status === "new" || r.status === "dismissed" ? (
                    <button type="button" className="admin-btn" disabled={busy} onClick={() => props.onStatus("confirmed")}>
                      Confirm problem
                    </button>
                  ) : null}
                  {r.status === "new" || r.status === "confirmed" ? (
                    <button type="button" className="admin-btn" disabled={busy} onClick={() => props.onStatus("dismissed")}>
                      Dismiss
                    </button>
                  ) : null}
                  {r.status === "dismissed" ? (
                    <button type="button" className="admin-btn" disabled={busy} onClick={() => props.onStatus("new")}>
                      Reopen
                    </button>
                  ) : null}
                </div>
                <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
                  Admin note
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={props.note}
                    maxLength={2000}
                    onChange={(e) => props.onNote(e.target.value)}
                  />
                </label>
                <div>
                  <button type="button" className="admin-btn" disabled={busy} onClick={props.onSaveNote}>
                    Save note
                  </button>
                </div>
                <div>
                  <p style={{ fontWeight: 600, margin: "0 0 0.35rem" }}>Timeline</p>
                  <ol style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", display: "grid", gap: "0.2rem" }}>
                    {r.events.map((e, i) => (
                      <li key={`${e.at}-${i}`}>
                        <span>{fmt(e.at)}</span> {"\u2014"} {PROBLEM_EVENT_LABEL[e.type] ?? e.type}
                        {e.detail ? <span style={{ color: "var(--text-secondary)" }}> ({e.detail})</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <div style={{ display: "grid", gap: "0.6rem", alignContent: "start" }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Win-back</p>
                <p className="admin-panel-sub" style={{ margin: 0 }}>
                  {LINK_LABEL[r.linkStatus]}
                  {r.linkExpiresAt && r.linkStatus !== "used" && r.linkStatus !== "none" ? `, expires ${fmt(r.linkExpiresAt)}` : ""}
                  {r.subscriptionStatus ? ` \u00b7 billing: ${r.subscriptionStatus}${r.cancelAtPeriodEnd ? " (cancel scheduled)" : ""}` : " \u00b7 billing: none"}
                </p>
                {r.status === "confirmed" && !r.winbackUsed ? (
                  <p className="admin-panel-sub" style={{ margin: 0 }} data-testid="problem-winback-mode">
                    {WINBACK_MODE_NOTE[mode]}
                  </p>
                ) : null}
                {r.winbackUsed && r.status !== "winback_sent" ? (
                  <p className="admin-panel-sub" style={{ margin: 0 }}>
                    This person already redeemed a win-back month. One per person.
                  </p>
                ) : null}
                {r.status === "confirmed" && !r.winbackUsed && !draft ? (
                  <div>
                    <button type="button" className="admin-btn" disabled={busy} onClick={props.onGenerate} data-testid="problem-generate-winback">
                      {r.reactivationOfferId ? "Generate new link + email preview" : "Generate win-back"}
                    </button>
                    {r.reactivationOfferId ? (
                      <p className="admin-panel-sub" style={{ margin: "0.35rem 0 0" }}>
                        A link exists but is only shown once. A new one replaces the old unused link.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {draft && r.status === "confirmed" ? (
                  <WinbackEmailEditor
                    draft={draft}
                    busy={busy}
                    onChange={props.onDraft}
                    onSend={props.onSend}
                    testIdPrefix="problem"
                  />
                ) : null}
                {r.status === "winback_sent" ? (
                  <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.85rem" }} data-testid="problem-email-sent">
                    <p style={{ margin: 0 }}>
                      Sent {fmt(r.winbackEmailSentAt)} to {r.winbackEmailTo}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>{r.winbackEmailSubject}</strong>
                    </p>
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{r.winbackEmailBody}</pre>
                  </div>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
