"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserWinback } from "@/lib/winback-email";
import { WINBACK_MODE_NOTE, type WinbackEmailDraft } from "@/lib/problem-report-rules";
import { AdminProblemReportsPanel } from "./AdminProblemReportsPanel";
import { WinbackEmailEditor, type WinbackDraft } from "./WinbackEmailEditor";

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "";
}

/** Plain-language link status for one person. */
export function winbackStatusLine(w: Pick<UserWinback, "linkStatus" | "offer">): string {
  const o = w.offer;
  switch (w.linkStatus) {
    case "none":
      return "No win-back link yet";
    case "used":
      return `Redeemed ${fmt(o?.usedAt)}${
        o?.redeemedAs === "extend" ? " (next payment moved 30 days)" : o?.redeemedAs === "trial" ? " (30-day trial started)" : ""
      }`;
    case "expired":
      return `Link expired ${fmt(o?.expiresAt)}`;
    case "opened":
      return `Link active, opened ${fmt(o?.openedAt)}, expires ${fmt(o?.expiresAt)}`;
    case "sent":
      return `Link active, sent ${fmt(o?.sentAt)}, expires ${fmt(o?.expiresAt)}`;
    default:
      return `Link active (not sent yet), expires ${fmt(o?.expiresAt)}`;
  }
}

/**
 * Admin single-user page: win-back status, generate + send (same rules as
 * the Win-back and Problem reports tabs), sent history, and this person's
 * problem reports with the same actions as the Problem reports tab.
 */
export function AdminUserWinbackCard(props: { userId: string; canWrite: boolean }) {
  const { userId, canWrite } = props;
  const [data, setData] = useState<UserWinback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WinbackDraft | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/reactivation?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const body = (await res.json()) as { winback?: UserWinback; error?: string };
      if (!res.ok || !body.winback) throw new Error(body.error ?? "Failed");
      setData(body.winback);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reactivation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      const body = (await res.json()) as { error?: string; link?: string; draft?: WinbackEmailDraft; winback?: UserWinback };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const body = await post({ action: "user_generate" });
    if (body?.draft && body.link) {
      setDraft({ ...body.draft, link: body.link });
      await load();
    }
  }

  async function send() {
    if (!draft) return;
    const body = await post({ action: "user_send", subject: draft.subject, body: draft.body });
    if (body) {
      setDraft(null);
      if (body.winback) setData(body.winback);
      else await load();
    }
  }

  const hasActiveLink = data && ["generated", "sent", "opened"].includes(data.linkStatus);

  return (
    <section className="admin-panel" data-testid="admin-user-winback">
      <h2 className="admin-panel-title">Win-back &amp; problem reports</h2>
      <p className="admin-panel-sub">
        One win-back per person. A new link replaces an unused old one and is shown only once.
      </p>
      {error ? <p className="admin-panel-sub">Error: {error}</p> : null}
      {!data && !error ? <p className="admin-panel-sub">Loading...</p> : null}
      {data ? (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <dl className="admin-dl">
            <dt>Win-back</dt>
            <dd data-testid="user-winback-status">{winbackStatusLine(data)}</dd>
            <dt>Billing</dt>
            <dd>
              {data.subscriptionStatus ?? "none"}
              {data.cancelAtPeriodEnd ? " (cancel scheduled)" : ""}
            </dd>
            <dt>Path</dt>
            <dd data-testid="user-winback-mode">
              {data.redeemed ? "Already redeemed: no new link." : WINBACK_MODE_NOTE[data.mode]}
            </dd>
          </dl>
          {canWrite && !data.redeemed && !draft ? (
            <div>
              <button type="button" className="admin-btn" disabled={busy} onClick={() => void generate()} data-testid="user-generate-winback">
                {data.offer && data.linkStatus !== "none" ? "New link + email preview" : "Generate win-back"}
              </button>
              {hasActiveLink ? (
                <p className="admin-panel-sub" style={{ margin: "0.35rem 0 0" }}>
                  A link is active but can only be shown once. A new one replaces it.
                </p>
              ) : null}
            </div>
          ) : null}
          {draft && canWrite ? (
            <WinbackEmailEditor draft={draft} busy={busy} onChange={setDraft} onSend={() => void send()} testIdPrefix="user" />
          ) : null}
          <div>
            <p style={{ fontWeight: 600, margin: "0.5rem 0 0.35rem" }}>Sent win-back emails</p>
            {data.emails.length === 0 ? (
              <p className="admin-panel-sub" style={{ margin: 0 }}>None yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.5rem", fontSize: "0.85rem" }} data-testid="user-winback-history">
                {data.emails.map((e) => (
                  <li key={e.id}>
                    <details>
                      <summary>
                        {fmt(e.sentAt)} to {e.to}: <strong>{e.subject}</strong>
                        {e.problemReportId ? " (from a problem report)" : ""}
                        {e.sentByEmail ? `, by ${e.sentByEmail}` : ""}
                      </summary>
                      <pre style={{ whiteSpace: "pre-wrap", margin: "0.35rem 0 0", fontFamily: "inherit" }}>{e.body}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      <AdminProblemReportsPanel userId={userId} embedded onChanged={() => void load()} />
    </section>
  );
}
