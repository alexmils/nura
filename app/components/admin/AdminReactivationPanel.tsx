"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactivationCandidate } from "@/lib/reactivation";

const STATUS_LABEL: Record<ReactivationCandidate["linkStatus"], string> = {
  none: "No link yet",
  generated: "Link generated",
  sent: "Sent",
  opened: "Opened",
  used: "Used: trial started",
  expired: "Expired",
};

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString() : "";
}

/** Win-back: members the stuck-ball bug cost. One link per person, 30 days free. */
export function AdminReactivationPanel() {
  const [rows, setRows] = useState<ReactivationCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reactivation", { cache: "no-store" });
      const data = (await res.json()) as { candidates?: ReactivationCandidate[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRows(data.candidates ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(userId: string) {
    setBusy(userId);
    try {
      const res = await fetch("/api/admin/reactivation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", userId }),
      });
      const data = (await res.json()) as { link?: string; error?: string };
      if (!res.ok || !data.link) throw new Error(data.error ?? "Failed");
      setLinks((m) => ({ ...m, [userId]: data.link! }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function copy(row: ReactivationCandidate) {
    const link = links[row.userId];
    if (!link) return;
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(row.userId);
    if (row.offer?.id) {
      await fetch("/api/admin/reactivation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_sent", offerId: row.offer.id }),
      }).catch(() => {});
      await load();
    }
  }

  return (
    <section className="admin-panel" data-testid="admin-reactivation">
      <h2 className="admin-panel-title">Win-back: 30 days free</h2>
      <p className="admin-panel-sub">
        Members who used guided mode, never got a set to start, and are no longer paying.
        A link is single use and expires after 30 days. Generating a new one replaces the old unused one.
        The link is shown once, so copy it before leaving the page.
      </p>
      {error ? <p className="admin-panel-sub">Error: {error}</p> : null}
      {!rows && !error ? <p className="admin-panel-sub">Loading...</p> : null}
      {rows && rows.length === 0 ? <p className="admin-panel-sub">Nobody is eligible right now.</p> : null}
      {rows && rows.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Billing</th>
                <th>Guided</th>
                <th>Plan offered</th>
                <th>Link</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} data-testid="reactivation-row">
                  <td>
                    <Link href={`/admin/users/${r.userId}`} className="admin-link">{r.email}</Link>
                  </td>
                  <td>
                    {r.status ?? "none"}
                    {r.cancelAtPeriodEnd ? " (cancel scheduled)" : ""}
                    {r.trialEndsAt ? `, trial end ${fmt(r.trialEndsAt)}` : ""}
                  </td>
                  <td>
                    {r.guidedThreads} sessions, {r.guidedMessages} messages, 0 sets
                  </td>
                  <td>{r.plan}</td>
                  <td data-testid="reactivation-status">
                    {STATUS_LABEL[r.linkStatus]}
                    {r.offer?.usedAt ? ` ${fmt(r.offer.usedAt)}` : r.offer ? `, expires ${fmt(r.offer.expiresAt)}` : ""}
                  </td>
                  <td>
                    {links[r.userId] ? (
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          readOnly
                          value={links[r.userId]}
                          onFocus={(e) => e.currentTarget.select()}
                          style={{ width: "16rem", fontSize: "0.75rem" }}
                          data-testid="reactivation-link"
                        />
                        <button type="button" className="admin-btn" onClick={() => void copy(r)} data-testid="reactivation-copy">
                          {copied === r.userId ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : r.linkStatus === "used" ? null : (
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={busy === r.userId}
                        onClick={() => void generate(r.userId)}
                        data-testid="reactivation-generate"
                      >
                        {r.offer ? "New link" : "Generate link"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
