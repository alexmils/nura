"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { formatDateTime } from "@/lib/admin-format";
import { fetchJson } from "@/lib/fetch-json";
import type { LoginAttemptRow, LoginLockRow } from "@/lib/login-guard";

const TABS = [
  { id: "limits", label: "Limits" },
  { id: "addresses", label: "Addresses" },
  { id: "attempts", label: "Attempts" },
  { id: "locks", label: "Locks" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Settings = {
  slug: string;
  path: string;
  maxAttempts: number;
  windowMinutes: number;
  lockMinutes: number;
  whitelist: string[];
  blocklist: string[];
};

const OUTCOME_LABEL: Record<string, string> = {
  ok: "Signed in",
  bad_password: "Wrong password",
  unknown_user: "Unknown account",
  staff_public: "Staff on public sign-in",
  consumer_gate: "Member on operator page",
  disabled: "Disabled account",
  blocked_ip: "Blocked address",
  locked: "Locked",
};

function AdminSecurityPageInner() {
  const [tab, setTab] = useAdminTab(
    TABS.map((item) => item.id),
    "limits"
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [attempts, setAttempts] = useState<LoginAttemptRow[]>([]);
  const [locks, setLocks] = useState<LoginLockRow[]>([]);
  const [slug, setSlug] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("5");
  const [windowMinutes, setWindowMinutes] = useState("15");
  const [lockMinutes, setLockMinutes] = useState("30");
  const [whitelist, setWhitelist] = useState("");
  const [blocklist, setBlocklist] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const apply = useCallback(
    (next: Settings, rows: LoginAttemptRow[], lockRows: LoginLockRow[]) => {
      setSettings(next);
      setAttempts(rows);
      setLocks(lockRows);
      setSlug(next.slug);
      setMaxAttempts(String(next.maxAttempts));
      setWindowMinutes(String(next.windowMinutes));
      setLockMinutes(String(next.lockMinutes));
      setWhitelist(next.whitelist.join("\n"));
      setBlocklist(next.blocklist.join("\n"));
    },
    []
  );

  const load = useCallback(async () => {
    const data = await fetchJson<{
      settings: Settings;
      attempts: LoginAttemptRow[];
      locks: LoginLockRow[];
    }>("/api/admin/login-guard");
    apply(data.settings, data.attempts ?? [], data.locks ?? []);
  }, [apply]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        setError("Could not load sign-in protection.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson<{ settings: Settings }>(
        "/api/admin/login-guard",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            maxAttempts: Number(maxAttempts),
            windowMinutes: Number(windowMinutes),
            lockMinutes: Number(lockMinutes),
            whitelist,
            blocklist,
          }),
        }
      );
      setSettings(data.settings);
      setSlug(data.settings.slug);
      setNotice("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson<{ settings: Settings }>(
        "/api/admin/login-guard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "regenerate" }),
        }
      );
      setSettings(data.settings);
      setSlug(data.settings.slug);
      setNotice("New address saved. The previous one no longer works.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate.");
    } finally {
      setSaving(false);
    }
  };

  const unlock = async (subjectKey: string) => {
    setError("");
    try {
      await fetchJson("/api/admin/login-guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", subjectKey }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock.");
    }
  };

  const copyPath = async () => {
    if (!settings) return;
    const origin = window.location.origin;
    await navigator.clipboard.writeText(`${origin}${settings.path}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Sign-in"
        subtitle="Admin and support sign in on a private address. Public sign-in rejects those accounts."
      />
      <main className="admin-main">
        <AdminTabs tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} />
        {error && <p className="text-[var(--destructive)]">{error}</p>}
        {notice && <p className="admin-panel-sub">{notice}</p>}

        {tab === "limits" && settings && (
          <section className="admin-panel">
            <p className="admin-panel-sub">
              Share this address only with people who run Nura. A wrong address
              shows a normal missing page.
            </p>
            <label className="admin-field-label">
              Private path
              <input
                className="field"
                value={slug}
                onChange={(e) => setSlug(e.target.value.trim())}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="admin-panel-sub">
              <code className="admin-code">{settings.path}</code>
            </p>
            <div className="admin-table-actions">
              <button type="button" className="btn-secondary" onClick={() => void copyPath()}>
                {copied ? "Copied" : "Copy full address"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => void regenerate()}
              >
                New random address
              </button>
            </div>
            <label className="admin-field-label">
              Attempts before lock
              <input
                className="field"
                inputMode="numeric"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
            </label>
            <label className="admin-field-label">
              Count window (minutes)
              <input
                className="field"
                inputMode="numeric"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(e.target.value)}
              />
            </label>
            <label className="admin-field-label">
              Lock length (minutes)
              <input
                className="field"
                inputMode="numeric"
                value={lockMinutes}
                onChange={(e) => setLockMinutes(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </section>
        )}

        {tab === "addresses" && (
          <section className="admin-panel">
            <p className="admin-panel-sub">
              One address per line. IPv4 ranges use CIDR, for example
              203.0.113.0/24. A whitelist entry skips the lock and the block
              list.
            </p>
            <label className="admin-field-label">
              Whitelist
              <textarea
                className="field"
                rows={6}
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="admin-field-label">
              Block
              <textarea
                className="field"
                rows={6}
                value={blocklist}
                onChange={(e) => setBlocklist(e.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save addresses"}
            </button>
          </section>
        )}

        {tab === "attempts" && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Address</th>
                  <th>Email</th>
                  <th>Result</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">
                      No sign-in attempts yet.
                    </td>
                  </tr>
                ) : (
                  attempts.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.ip || "Unknown"}</td>
                      <td>{row.email || "Unknown"}</td>
                      <td>{OUTCOME_LABEL[row.outcome] ?? row.outcome}</td>
                      <td>{row.surface === "operator" ? "Operator" : "Public"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "locks" && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Kind</th>
                  <th>Failed attempts</th>
                  <th>Locked until</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">
                      Nothing is locked.
                    </td>
                  </tr>
                ) : (
                  locks.map((row) => (
                    <tr key={row.subjectKey}>
                      <td>{row.subject}</td>
                      <td>{row.kind === "email" ? "Email" : "IP address"}</td>
                      <td>{row.failedCount}</td>
                      <td>{formatDateTime(row.lockedUntil)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => void unlock(row.subjectKey)}
                        >
                          Unlock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminSecurityPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading…</p>
        </div>
      }
    >
      <AdminSecurityPageInner />
    </Suspense>
  );
}
