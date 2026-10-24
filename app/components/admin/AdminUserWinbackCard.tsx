"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserWinback } from "@/lib/winback-email";
import { WINBACK_MODE_NOTE, type WinbackEmailDraft } from "@/lib/problem-report-rules";
import { AdminProblemReportsPanel } from "./AdminProblemReportsPanel";
import { type WinbackDraft } from "./WinbackEmailEditor";
import { WinbackEmailComposer } from "./WinbackEmailComposer";
import "./admin-user-layout.css";

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
 * One person's win-back state + actions (same rules as the Win-back and
 * Problem reports tabs). Shared by the sidebar box and the main-column
 * activity panel on the admin single-user page.
 */
export function useUserWinback(userId: string) {
  const [data, setData] = useState<UserWinback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WinbackDraft | null>(null);
  const [note, setNote] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ user?: { email?: string } }>)
      .then((b) => setAdminEmail(b.user?.email ?? ""))
      .catch(() => {});
  }, []);

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
      const body = (await res.json()) as {
        error?: string;
        link?: string;
        draft?: WinbackEmailDraft;
        winback?: UserWinback;
        email?: { subject?: string };
      };
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
      // Subject from the "winback" template (Admin → Email may have changed it).
      const preview = await post({ action: "user_preview", link: body.link });
      setNote("");
      setDraft({ ...body.draft, subject: preview?.email?.subject || body.draft.subject, link: body.link });
      await load();
    }
  }

  async function send() {
    if (!draft) return;
    const body = await post({ action: "user_send", subject: draft.subject, link: draft.link, note });
    if (body) {
      setDraft(null);
      setNote("");
      if (body.winback) setData(body.winback);
      else await load();
    }
  }

  return { userId, data, error, busy, draft, setDraft, note, setNote, adminEmail, post, load, generate, send };
}

export type UserWinbackState = ReturnType<typeof useUserWinback>;

/** Sidebar box: status, path, Generate / New link. */
export function AdminUserWinbackBox(props: { state: UserWinbackState; canWrite: boolean }) {
  const { state, canWrite } = props;
  const { data, error, busy, draft } = state;
  const hasActiveLink = data && ["generated", "sent", "opened"].includes(data.linkStatus);
  return (
    <section className="admin-user-box" data-testid="admin-user-winback">
      <h2 className="admin-user-box-head">Win-back</h2>
      <div className="admin-user-box-body">
        {error ? <p className="admin-user-box-msg">Error: {error}</p> : null}
        {!data && !error ? <p className="admin-user-box-note">Loading...</p> : null}
        {data ? (
          <>
            <dl className="admin-user-kv">
              <dt>Status</dt>
              <dd data-testid="user-winback-status">{winbackStatusLine(data)}</dd>
              <dt>Billing</dt>
              <dd>
                {data.subscriptionStatus ?? "none"}
                {data.cancelAtPeriodEnd ? " (cancel scheduled)" : ""}
              </dd>
            </dl>
            <p className="admin-user-box-note" data-testid="user-winback-mode">
              {data.redeemed ? "Already redeemed: no new link (one per person)." : WINBACK_MODE_NOTE[data.mode]}
            </p>
            {canWrite && !data.redeemed ? (
              <div className="admin-user-box-actions">
                {draft ? (
                  <>
                    <p className="admin-user-box-note" style={{ flexBasis: "100%" }}>
                      The email preview is open in the main column. Nothing is sent until you press Send email.
                    </p>
                    <button type="button" className="btn-secondary admin-btn-sm" disabled={busy} onClick={() => state.setDraft(null)}>
                      Close preview
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary admin-btn-sm"
                      disabled={busy}
                      onClick={() => void state.generate()}
                      data-testid="user-generate-winback"
                    >
                      {data.offer && data.linkStatus !== "none" ? "New link + email preview" : "Generate win-back"}
                    </button>
                    {hasActiveLink ? (
                      <p className="admin-user-box-note" style={{ flexBasis: "100%" }}>
                        A link is active but can only be shown once. A new one replaces it.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            <p className="admin-user-box-note">One win-back per person. A new link replaces an unused old one.</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

/** Main column: email preview (when open), sent win-back emails, problem reports. */
export function AdminUserWinbackActivity(props: { state: UserWinbackState; canWrite: boolean }) {
  const { state, canWrite } = props;
  const { data, busy, draft } = state;
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hasDraft = Boolean(draft);
  useEffect(() => {
    if (hasDraft) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasDraft]);
  return (
    <section className="admin-panel" data-testid="admin-user-winback-activity">
      <h2 className="admin-panel-title">Problem reports &amp; win-back emails</h2>
      {draft && canWrite ? (
        <div className="admin-user-preview" ref={previewRef}>
          <h3 className="admin-user-subhead" style={{ marginTop: 0 }}>Win-back email preview</h3>
          <WinbackEmailComposer
            userId={state.userId}
            draft={draft}
            note={state.note}
            busy={busy}
            adminEmail={state.adminEmail}
            onChange={state.setDraft}
            onNoteChange={state.setNote}
            onSend={() => void state.send()}
          />
        </div>
      ) : null}
      <AdminProblemReportsPanel userId={state.userId} embedded onChanged={() => void state.load()} />
      <h3 className="admin-user-subhead">Sent win-back emails</h3>
      {!data ? null : data.emails.length === 0 ? (
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
    </section>
  );
}

/** Stacked version (box + activity) for places without a sidebar. */
export function AdminUserWinbackCard(props: { userId: string; canWrite: boolean }) {
  const state = useUserWinback(props.userId);
  return (
    <>
      <AdminUserWinbackBox state={state} canWrite={props.canWrite} />
      <AdminUserWinbackActivity state={state} canWrite={props.canWrite} />
    </>
  );
}
