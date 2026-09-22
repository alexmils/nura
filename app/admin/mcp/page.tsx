"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CircleHelp } from "lucide-react";

type McpView = {
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string;
  tokenName: string;
  lastUsedAt: string;
  source: "database" | "env" | "none";
  envTokenIgnored: boolean;
  localUrl: string;
  publicUrl: string;
};

type InfoKind = "page" | "tools" | "rules" | null;
type WizardStep = "name" | "secret" | null;

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
  ["Copy rules", "Em dashes are rewritten and the acronym BLS is rejected."],
  [
    "Size and link",
    "The body is capped at 200,000 characters and each guide needs an /emdr link.",
  ],
  ["Draft by default", "A new guide stays a draft unless published is true."],
] as const;

function InfoTip({
  label,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const tipId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="admin-mcp-info" ref={wrapRef}>
      <button
        type="button"
        className="admin-mcp-info-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={onToggle}
      >
        <CircleHelp size={16} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div id={tipId} className="admin-mcp-info-pop" role="dialog" aria-label={label}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminMcpPage() {
  const [mcp, setMcp] = useState<McpView | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [nameError, setNameError] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [snippet, setSnippet] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [info, setInfo] = useState<InfoKind>(null);
  const [wizard, setWizard] = useState<WizardStep>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mcp");
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Could not load MCP settings");
      return;
    }
    setMcp(data.mcp as McpView);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (wizard === "name") {
      const t = window.setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [wizard]);

  function openCreateWizard() {
    const existing = mcp?.tokenName?.trim();
    setTokenName(existing || (mcp?.hasToken ? "Blog agent" : ""));
    setNameError("");
    setErr("");
    setMsg("");
    setIssuedToken("");
    setSnippet("");
    setWizard("name");
  }

  function closeWizard() {
    setWizard(null);
    setNameError("");
    setIssuedToken("");
    setSnippet("");
  }

  async function act(
    action: string,
    patch?: Record<string, unknown>,
    name?: string
  ) {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          patch,
          ...(name !== undefined ? { name } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Could not save");
        if (wizard === "name") setNameError(data.error ?? "Could not save");
        return false;
      }
      setMcp(data.mcp);
      if (action === "generate") {
        setIssuedToken(data.token ?? "");
        setSnippet(data.snippet ?? "");
        setWizard("secret");
        setMsg("");
      } else if (action === "revoke") {
        setIssuedToken("");
        setSnippet("");
        setTokenName("");
        setWizard(null);
        setMsg("Token revoked.");
      } else {
        setMsg("Saved.");
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  function submitNameStep(e?: FormEvent) {
    e?.preventDefault();
    const name = tokenName.trim();
    if (!name) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    void act("generate", undefined, name);
  }

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setErr("Could not copy. Select the text and copy it manually.");
    }
  }

  const statusText = mcp
    ? mcp.hasToken
      ? mcp.enabled
        ? "Active"
        : "Disabled"
      : mcp.source === "env"
        ? "Env only"
        : "No token"
    : "…";

  const statusChip = mcp
    ? mcp.hasToken
      ? mcp.enabled
        ? "admin-status-chip admin-status-chip-ok"
        : "admin-status-chip admin-status-chip-off"
      : mcp.source === "env"
        ? "admin-status-chip admin-status-chip-default"
        : "admin-status-chip admin-status-chip-idle"
    : "admin-status-chip";

  const hasListRow = Boolean(mcp && (mcp.hasToken || mcp.source === "env"));

  return (
    <div className="admin-page admin-mcp">
      <header className="admin-page-header admin-mcp-header">
        <div className="admin-mcp-header-row">
          <h1 className="admin-page-title">MCP</h1>
          <InfoTip
            label="About MCP"
            open={info === "page"}
            onToggle={() => setInfo((v) => (v === "page" ? null : "page"))}
            onClose={() => setInfo(null)}
          >
            <p>
              Bearer token for the blog agent. Only a hash is stored, so the
              secret cannot be read back here.
            </p>
            {mcp?.envTokenIgnored ? (
              <p>
                An admin token is active, so{" "}
                <code className="admin-code">NURA_MCP_TOKEN</code> from the
                environment is ignored.
              </p>
            ) : null}
          </InfoTip>
        </div>
      </header>

      <main className="admin-main admin-mcp-main">
        {(msg || err) && !wizard && (
          <div
            className={`admin-mcp-banner${err ? " is-error" : ""}`}
            role="status"
          >
            {err || msg}
          </div>
        )}

        {!mcp ? (
          <p className="admin-panel-sub">Loading…</p>
        ) : (
          <>
            <section className="admin-mcp-section">
              <div className="admin-mcp-section-head-row admin-mcp-tokens-head">
                <h2 className="admin-mcp-section-title">Tokens</h2>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={openCreateWizard}
                >
                  Create new token
                </button>
              </div>

              <div className="admin-mcp-table-wrap">
                <table className="admin-mcp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Prefix</th>
                      <th>Status</th>
                      <th>Last used</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {hasListRow ? (
                      <tr>
                        <td className="admin-mcp-name">
                          {mcp.hasToken
                            ? mcp.tokenName || "Blog agent"
                            : "Env token"}
                        </td>
                        <td className="admin-mcp-mono">
                          {mcp.hasToken ? `${mcp.tokenHint}…` : "env"}
                        </td>
                        <td>
                          <span className={statusChip}>{statusText}</span>
                          <span className="admin-mcp-source-hint">
                            {sourceLabel(mcp)}
                          </span>
                        </td>
                        <td className="admin-mcp-muted">
                          {whenLabel(mcp.lastUsedAt)}
                        </td>
                        <td className="admin-mcp-actions">
                          <button
                            type="button"
                            className="admin-mcp-link"
                            disabled={busy}
                            onClick={openCreateWizard}
                          >
                            Rotate
                          </button>
                          <button
                            type="button"
                            className="admin-mcp-link"
                            disabled={busy || mcp.source === "none"}
                            onClick={() =>
                              void act("save", { enabled: !mcp.enabled })
                            }
                          >
                            {mcp.enabled ? "Disable" : "Enable"}
                          </button>
                          {mcp.hasToken ? (
                            <button
                              type="button"
                              className="admin-mcp-link is-danger"
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
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="admin-mcp-empty">
                          No MCP tokens yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-mcp-section">
              <div className="admin-mcp-section-head-row">
                <h2 className="admin-mcp-section-title">Endpoints</h2>
              </div>
              <div className="admin-mcp-endpoints">
                <div className="admin-mcp-endpoint">
                  <span className="admin-mcp-endpoint-label">Local</span>
                  <code className="admin-mcp-endpoint-url">{mcp.localUrl}</code>
                  <button
                    type="button"
                    className="admin-mcp-link"
                    onClick={() => void copy(mcp.localUrl, "local")}
                  >
                    {copied === "local" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="admin-mcp-endpoint">
                  <span className="admin-mcp-endpoint-label">Deployed</span>
                  <code className="admin-mcp-endpoint-url">{mcp.publicUrl}</code>
                  <button
                    type="button"
                    className="admin-mcp-link"
                    onClick={() => void copy(mcp.publicUrl, "public")}
                  >
                    {copied === "public" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </section>

            <section className="admin-mcp-meta-row">
              <div className="admin-mcp-meta-item">
                <span className="admin-mcp-meta-label">Tools</span>
                <span className="admin-mcp-meta-value">{TOOLS.length}</span>
                <InfoTip
                  label="MCP tools"
                  open={info === "tools"}
                  onToggle={() =>
                    setInfo((v) => (v === "tools" ? null : "tools"))
                  }
                  onClose={() => setInfo(null)}
                >
                  <ul className="admin-mcp-info-list">
                    {TOOLS.map(([name, purpose]) => (
                      <li key={name}>
                        <code>{name}</code>
                        <span>{purpose}</span>
                      </li>
                    ))}
                  </ul>
                </InfoTip>
              </div>
              <div className="admin-mcp-meta-item">
                <span className="admin-mcp-meta-label">Rules</span>
                <span className="admin-mcp-meta-value">{RULES.length}</span>
                <InfoTip
                  label="Publishing rules"
                  open={info === "rules"}
                  onToggle={() =>
                    setInfo((v) => (v === "rules" ? null : "rules"))
                  }
                  onClose={() => setInfo(null)}
                >
                  <ul className="admin-mcp-info-list">
                    {RULES.map(([rule, detail]) => (
                      <li key={rule}>
                        <strong>{rule}</strong>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </InfoTip>
              </div>
            </section>
          </>
        )}
      </main>

      {wizard === "name" ? (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-mcp-name-title"
        >
          <div className="admin-modal admin-mcp-wizard-modal">
            <p className="admin-mcp-wizard-step">Step 1 of 2</p>
            <h2 id="admin-mcp-name-title" className="admin-mcp-section-title">
              Name this token
            </h2>
            <p className="admin-mcp-section-sub">
              {mcp?.hasToken
                ? "A new secret replaces the current one immediately."
                : "You will copy the secret in the next step."}
            </p>
            <form
              className="admin-mcp-wizard-form"
              onSubmit={submitNameStep}
            >
              <label
                className="admin-field-label"
                htmlFor="admin-mcp-token-name"
              >
                Name
                <input
                  ref={nameInputRef}
                  id="admin-mcp-token-name"
                  type="text"
                  className="field"
                  value={tokenName}
                  maxLength={64}
                  placeholder="blog-agent"
                  autoComplete="off"
                  required
                  disabled={busy}
                  onChange={(e) => {
                    setTokenName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                />
              </label>
              {nameError ? (
                <p className="admin-mcp-wizard-error" role="alert">
                  {nameError}
                </p>
              ) : null}
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={closeWizard}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !tokenName.trim()}
                >
                  {busy ? "Working…" : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {wizard === "secret" && issuedToken ? (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-mcp-secret-title"
        >
          <div className="admin-modal admin-modal-wide admin-mcp-secret-modal">
            <p className="admin-mcp-wizard-step">Step 2 of 2</p>
            <h2 id="admin-mcp-secret-title" className="admin-mcp-section-title">
              Copy your token
            </h2>
            <p className="admin-mcp-section-sub">
              Secret is shown once. Paste into{" "}
              <code className="admin-code">~/.cursor/mcp.json</code>.
            </p>

            <label className="admin-field-label">
              Token
              <div className="admin-mcp-secret-row">
                <input
                  type="text"
                  className="field admin-mcp-secret-input"
                  readOnly
                  value={issuedToken}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void copy(issuedToken, "token")}
                >
                  {copied === "token" ? "Copied" : "Copy"}
                </button>
              </div>
            </label>

            {snippet ? (
              <label className="admin-field-label">
                MCP JSON
                <textarea
                  className="field admin-mcp-secret-json"
                  readOnly
                  rows={10}
                  value={snippet}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void copy(snippet, "snippet")}
                >
                  {copied === "snippet" ? "Copied" : "Copy JSON"}
                </button>
              </label>
            ) : null}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={closeWizard}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
