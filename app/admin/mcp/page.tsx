"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";

type McpView = {
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string;
  lastUsedAt: string;
  source: "database" | "env" | "none";
  envTokenIgnored: boolean;
  localUrl: string;
  publicUrl: string;
};

function sourceLabel(mcp: McpView): string {
  if (mcp.source === "database") return "Generated here";
  if (mcp.source === "env") return "From NURA_MCP_TOKEN";
  return "Not configured";
}

function whenLabel(iso: string): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const TOOLS = [
  ["list_blog_categories", "List the clinical categories with post counts"],
  ["list_blog_posts", "List guides, optionally by category or published state"],
  ["get_blog_post", "Read one guide, including its sections"],
  ["create_blog_post", "Publish a guide and choose its category"],
  ["update_blog_post", "Edit a guide, rename its slug, publish or unpublish"],
  ["delete_blog_post", "Delete a guide"],
] as const;

const RULES = [
  ["Category is required", "A guide needs at least one category before it saves."],
  [
    "Copy rules",
    "Em dashes are rewritten and the acronym BLS is rejected.",
  ],
  [
    "Size and link",
    "The body is capped at 200,000 characters and each guide needs an /emdr link.",
  ],
  ["Draft by default", "A new guide stays a draft unless published is true."],
] as const;

export default function AdminMcpPage() {
  const [mcp, setMcp] = useState<McpView | null>(null);
  const [issuedToken, setIssuedToken] = useState("");
  const [snippet, setSnippet] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mcp");
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not load MCP settings");
      return;
    }
    setMcp(data.mcp);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, patch?: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Could not save");
        return;
      }
      setMcp(data.mcp);
      if (action === "generate") {
        setIssuedToken(data.token ?? "");
        setSnippet(data.snippet ?? "");
        setMsg("New token generated. Copy it now: it is shown only once.");
      } else if (action === "revoke") {
        setIssuedToken("");
        setSnippet("");
        setMsg("Token revoked. Any client using it is now unauthorized.");
      } else {
        setMsg("Saved.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setMsg("Could not copy. Select the text and copy it manually.");
    }
  }

  const statusChip = mcp
    ? mcp.hasToken
      ? mcp.enabled
        ? "admin-status-chip admin-status-chip-ok"
        : "admin-status-chip admin-status-chip-off"
      : "admin-status-chip admin-status-chip-idle"
    : "admin-status-chip";

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="MCP"
        subtitle="Access token for the blog agent, which publishes guides and picks the category."
      />
      <main className="admin-main">
        {!mcp ? (
          <p className="admin-panel-sub">Loading…</p>
        ) : (
          <>
            <section className="admin-panel">
              <h2 className="admin-panel-title">Access token</h2>
              <p className="admin-panel-sub">
                Bearer token for <code className="admin-code">{mcp.localUrl}</code>.
                Only a hash is stored, so the token cannot be read back here.
              </p>

              <dl className="admin-kv-list">
                <div className="admin-kv-row">
                  <dt>Status</dt>
                  <dd>
                    <span className={statusChip}>
                      {mcp.hasToken ? (mcp.enabled ? "Active" : "Disabled") : "No token"}
                    </span>{" "}
                    <span className="admin-panel-sub">{sourceLabel(mcp)}</span>
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Token</dt>
                  <dd>
                    {mcp.hasToken ? (
                      <code className="admin-code">{mcp.tokenHint}…</code>
                    ) : (
                      "Not generated yet"
                    )}
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Last used</dt>
                  <dd>{whenLabel(mcp.lastUsedAt)}</dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Local endpoint</dt>
                  <dd>
                    <code className="admin-code">{mcp.localUrl}</code>
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Deployed endpoint</dt>
                  <dd>
                    <code className="admin-code">{mcp.publicUrl}</code>
                  </dd>
                </div>
              </dl>

              {mcp.envTokenIgnored ? (
                <p className="admin-panel-sub">
                  A token generated here is in use, so{" "}
                  <code className="admin-code">NURA_MCP_TOKEN</code> from the
                  environment is ignored. Revoke to fall back to it.
                </p>
              ) : null}

              <div className="admin-actions-row">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void act("generate")}
                >
                  {busy
                    ? "Working…"
                    : mcp.hasToken
                      ? "Generate new token"
                      : "Generate token"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || mcp.source === "none"}
                  onClick={() => void act("save", { enabled: !mcp.enabled })}
                >
                  {mcp.enabled ? "Disable" : "Enable"}
                </button>
                {mcp.hasToken ? (
                  <button
                    type="button"
                    className="admin-btn-danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Revoke this token? Every client using it stops working."
                        )
                      ) {
                        void act("revoke");
                      }
                    }}
                  >
                    Revoke
                  </button>
                ) : null}
              </div>

              <p className="admin-panel-sub">
                Generating a new token replaces the old one immediately.
              </p>
            </section>

            {issuedToken ? (
              <section className="admin-panel admin-form-stack">
                <h2 className="admin-panel-title">Copy it now</h2>
                <p className="admin-panel-sub">
                  This is the only time the token is shown. Add it to{" "}
                  <code className="admin-code">~/.cursor/mcp.json</code>, then
                  restart the MCP server in Cursor.
                </p>

                <label className="admin-field-label">
                  Token
                  <input
                    type="text"
                    className="field"
                    readOnly
                    value={issuedToken}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>

                <div className="admin-actions-row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void copy(issuedToken, "token")}
                  >
                    {copied === "token" ? "Copied" : "Copy token"}
                  </button>
                  {snippet ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void copy(snippet, "snippet")}
                    >
                      {copied === "snippet" ? "Copied" : "Copy config"}
                    </button>
                  ) : null}
                </div>

                {snippet ? (
                  <pre className="admin-code admin-mcp-pre">{snippet}</pre>
                ) : null}
              </section>
            ) : null}

            <section className="admin-panel">
              <h2 className="admin-panel-title">What the agent can do</h2>
              <p className="admin-panel-sub">
                Tools exposed over MCP. Every write is recorded in the activity
                log.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOOLS.map(([name, purpose]) => (
                      <tr key={name}>
                        <td>
                          <code className="admin-code">{name}</code>
                        </td>
                        <td>{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-panel">
              <h2 className="admin-panel-title">Publishing rules</h2>
              <p className="admin-panel-sub">
                Enforced by the endpoint, so the agent cannot skip them.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RULES.map(([rule, detail]) => (
                      <tr key={rule}>
                        <td>{rule}</td>
                        <td>{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
