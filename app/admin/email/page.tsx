"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { formatDateTime } from "@/lib/admin-format";
import type { EmailEvent } from "@/lib/email-events";
import { EMAIL_TEMPLATE_IDS, emailTemplateLabel, keepEmailTemplateId, type EmailTemplateId } from "@/lib/email/template-labels";
import type { EmailAdminView } from "@/lib/email-admin-settings";
import type { EmailAdminStatus } from "@/lib/email-admin-settings";
import { fetchJson } from "@/lib/fetch-json";
import { BroadcastForm, TemplateEditor } from "@/app/components/admin/EmailTools";

const TABS = ["delivery", "send", "templates", "log"] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { id: "delivery", label: "Delivery" },
  { id: "send", label: "Send" },
  { id: "templates", label: "Templates" },
  { id: "log", label: "Log" },
] as const;

const TEMPLATE_IDS = EMAIL_TEMPLATE_IDS;

type EmailFormState = EmailAdminView;

function sourceLabel(source: "stored" | "env" | "none"): string {
  if (source === "stored") return "saved in admin";
  if (source === "env") return "from .env";
  return "not set";
}

function AdminEmailPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "delivery");
  const [status, setStatus] = useState<EmailAdminStatus | null>(null);
  const [form, setForm] = useState<EmailFormState | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [templates, setTemplates] = useState<
    {
      id: EmailTemplateId;
      subject: string;
      html: string;
      text: string;
      isCustom: boolean;
    }[]
  >([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplateId>("welcome");
  const [testTo, setTestTo] = useState("");
  const [testTemplate, setTestTemplate] =
    useState<EmailTemplateId>("welcome");
  const [logStatus, setLogStatus] = useState<"all" | "sent" | "failed">("all");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [settingsRes, templatesRes] = await Promise.all([
      fetchJson<{
        status: EmailAdminStatus;
        email: EmailAdminView;
        canEdit: boolean;
      }>("/api/admin/email/settings"),
      fetchJson<{
        templates: {
          id: EmailTemplateId;
          subject: string;
          html: string;
          text: string;
          isCustom: boolean;
        }[];
      }>("/api/admin/email/templates"),
    ]);
    setStatus(settingsRes.status);
    setForm(settingsRes.email);
    setCanEdit(settingsRes.canEdit);
    const list = templatesRes.templates ?? [];
    setTemplates(list);
    setSelectedTemplate(
      (id) => keepEmailTemplateId(id, list.map((t) => t.id)) as EmailTemplateId
    );
  }, []);

  const loadLog = useCallback(async () => {
    const params = new URLSearchParams({ limit: "50" });
    if (logStatus !== "all") params.set("status", logStatus);
    const res = await fetchJson<{ events: EmailEvent[] }>(
      `/api/admin/email/events?${params.toString()}`
    );
    setEvents(res.events ?? []);
  }, [logStatus]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const patchForm = (patch: Partial<EmailFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const emailPatch: Record<string, string> = {
        replyTo: form.replyTo,
      };
      if (form.brevoApiKey.trim()) emailPatch.brevoApiKey = form.brevoApiKey.trim();
      if (form.gmailClientId.trim())
        emailPatch.gmailClientId = form.gmailClientId.trim();
      if (form.gmailClientSecret.trim())
        emailPatch.gmailClientSecret = form.gmailClientSecret.trim();
      if (form.gmailRefreshToken.trim())
        emailPatch.gmailRefreshToken = form.gmailRefreshToken.trim();

      const res = await fetchJson<{
        status: EmailAdminStatus;
        email: EmailAdminView;
        canEdit: boolean;
      }>("/api/admin/email/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: form.fromName,
          fromAddress: form.fromAddress,
          email: emailPatch,
        }),
      });
      setStatus(res.status);
      setForm(res.email);
      setCanEdit(res.canEdit);
      setMsg("Email settings saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await fetchJson("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo, templateId: testTemplate }),
      });
      setMsg("Test email sent.");
      await loadLog();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Send failed");
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

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Email"
        subtitle="Delivery status, sender identity, templates, and send log."
      />
      <main
        className={
          tab === "templates"
            ? "admin-main admin-main-wide admin-main-templates"
            : "admin-main"
        }
      >
        <AdminTabs
          tabs={TAB_ITEMS}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {tab === "delivery" && status && form && (
          <>
            <section className="admin-panel">
              <h2 className="admin-panel-title">Delivery status</h2>
              <div className="admin-health-chips">
                <span
                  className={`admin-health-chip ${
                    status.brevoConfigured
                      ? "admin-health-ok"
                      : "admin-health-warn"
                  }`}
                >
                  Brevo{" "}
                  {status.brevoConfigured
                    ? status.primaryProvider === "brevo"
                      ? "primary"
                      : "ready"
                    : "missing"}
                </span>
                <span
                  className={`admin-health-chip ${
                    status.gmailConfigured
                      ? "admin-health-ok"
                      : "admin-health-warn"
                  }`}
                >
                  Gmail fallback{" "}
                  {status.gmailConfigured
                    ? status.primaryProvider === "gmail"
                      ? "primary"
                      : "ready"
                    : "missing"}
                </span>
              </div>
              <p className="admin-panel-sub">
                Brevo is the primary sender. Gmail API is the fallback on quota.
                Secrets can be saved here (preferred) or left in{" "}
                <code className="admin-code">.env</code>
                {canEdit
                  ? " — leave secret fields blank to keep the saved value."
                  : " — view only (secrets hidden; platform admin can edit)."}
              </p>
              <dl className="admin-kv-list">
                <div className="admin-kv-row">
                  <dt>Effective From</dt>
                  <dd>
                    {status.fromName && status.fromAddress
                      ? `${status.fromName} <${status.fromAddress}>`
                      : "Not configured"}
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Reply-To</dt>
                  <dd>{status.replyTo ?? "— (same as From)"}</dd>
                </div>
                <div className="admin-kv-row">
                  <dt>App URL (links in mail)</dt>
                  <dd>
                    <code className="admin-code">{status.appUrl}</code>
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Brevo key</dt>
                  <dd>{sourceLabel(form.brevoSource)}</dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Gmail OAuth</dt>
                  <dd>{sourceLabel(form.gmailSource)}</dd>
                </div>
              </dl>
            </section>

            <form
              className="admin-form-stack admin-panel"
              onSubmit={(e) => void saveDelivery(e)}
            >
              <h2 className="admin-panel-title">Send as</h2>
              <p className="admin-panel-sub">
                Outgoing From name and address. Default:{" "}
                <code className="admin-code">hi@contact.nurahelp.com</code>
              </p>
              <label className="admin-field-label">
                From name
                <input
                  type="text"
                  value={form.fromName}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ fromName: e.target.value })}
                  className="field"
                  placeholder="Nura"
                />
              </label>
              <label className="admin-field-label">
                Send-as address
                <input
                  type="email"
                  value={form.fromAddress}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ fromAddress: e.target.value })}
                  className="field"
                  placeholder="hi@contact.nurahelp.com"
                />
              </label>
              <label className="admin-field-label">
                Reply-To (optional)
                <input
                  type="email"
                  value={form.replyTo}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ replyTo: e.target.value })}
                  className="field"
                  placeholder="Leave blank to use From"
                />
              </label>

              <h2 className="admin-panel-title" style={{ marginTop: "1rem" }}>
                Brevo (primary)
              </h2>
              <label className="admin-field-label">
                API key
                <input
                  type="password"
                  autoComplete="off"
                  value={form.brevoApiKey}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ brevoApiKey: e.target.value })}
                  className="field"
                  placeholder={
                    form.hasBrevoApiKey
                      ? "•••• saved — paste to replace"
                      : status.env.brevoApiKey
                        ? "Using .env — paste to store in admin"
                        : "xkeysib-…"
                  }
                />
              </label>

              <h2 className="admin-panel-title" style={{ marginTop: "1rem" }}>
                Gmail API (fallback)
              </h2>
              <label className="admin-field-label">
                Client ID
                <input
                  type="text"
                  autoComplete="off"
                  value={form.gmailClientId}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ gmailClientId: e.target.value })}
                  className="field"
                  placeholder={
                    form.hasGmailClientId
                      ? "•••• saved — paste to replace"
                      : status.env.gmailOauth
                        ? "Using .env — paste to store in admin"
                        : "….apps.googleusercontent.com"
                  }
                />
              </label>
              <label className="admin-field-label">
                Client secret
                <input
                  type="password"
                  autoComplete="off"
                  value={form.gmailClientSecret}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patchForm({ gmailClientSecret: e.target.value })
                  }
                  className="field"
                  placeholder={
                    form.hasGmailClientSecret
                      ? "•••• saved — paste to replace"
                      : "GOCSPX-…"
                  }
                />
              </label>
              <label className="admin-field-label">
                Refresh token
                <input
                  type="password"
                  autoComplete="off"
                  value={form.gmailRefreshToken}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patchForm({ gmailRefreshToken: e.target.value })
                  }
                  className="field"
                  placeholder={
                    form.hasGmailRefreshToken
                      ? "•••• saved — paste to replace"
                      : "1//…"
                  }
                />
              </label>

              {canEdit && (
                <button type="submit" disabled={busy} className="btn-primary w-fit">
                  {busy ? "Saving…" : "Save email settings"}
                </button>
              )}
            </form>

            <section className="admin-panel">
              <h2 className="admin-panel-title">Environment fallbacks</h2>
              <p className="admin-panel-sub">
                Read-only. Used when a value is not saved in admin yet.
              </p>
              <dl className="admin-kv-list">
                <div className="admin-kv-row">
                  <dt>
                    <code className="admin-code">BREVO_API_KEY</code>
                  </dt>
                  <dd>{status.env.brevoApiKey ? "set in .env" : "not in .env"}</dd>
                </div>
                <div className="admin-kv-row">
                  <dt>
                    <code className="admin-code">GMAIL_CLIENT_*</code>
                  </dt>
                  <dd>
                    {status.env.gmailOauth ? "OAuth set in .env" : "not in .env"}
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>
                    <code className="admin-code">EMAIL_FROM_ADDRESS</code>
                  </dt>
                  <dd>
                    {status.env.emailFromAddress
                      ? "set in .env"
                      : "not in .env"}
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>
                    <code className="admin-code">EMAIL_FROM_NAME</code>
                  </dt>
                  <dd>
                    {status.env.emailFromName ? "set in .env" : "not in .env"}
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>
                    <code className="admin-code">GMAIL_SENDER</code>
                  </dt>
                  <dd>
                    {status.env.gmailSender ? "set in .env" : "not in .env"}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}

        {tab === "send" && status && (
          <>
            <section className="admin-panel">
              <h2 className="admin-panel-title">Current sender</h2>
              <dl className="admin-kv-list">
                <div className="admin-kv-row">
                  <dt>From</dt>
                  <dd>
                    {status.fromName && status.fromAddress
                      ? `${status.fromName} <${status.fromAddress}>`
                      : "Not configured — set on Delivery"}
                  </dd>
                </div>
                <div className="admin-kv-row">
                  <dt>Primary provider</dt>
                  <dd>
                    {status.primaryProvider === "none"
                      ? "None ready"
                      : status.primaryProvider === "brevo"
                        ? "Brevo"
                        : "Gmail"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="admin-panel">
              <h2 className="admin-panel-title">Test send</h2>
              <form className="admin-invite-form" onSubmit={(e) => void sendTest(e)}>
                <input
                  type="email"
                  required
                  placeholder="Send test to"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  className="field"
                />
                <select
                  value={testTemplate}
                  onChange={(e) =>
                    setTestTemplate(e.target.value as EmailTemplateId)
                  }
                  className="field"
                >
                  {TEMPLATE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {emailTemplateLabel(id)}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={busy} className="btn-primary shrink-0">
                  {busy ? "Sending…" : "Send test"}
                </button>
              </form>
            </section>
            <section className="admin-panel">
              <h2 className="admin-panel-title">Broadcast</h2>
              <p className="admin-panel-sub">
                Send a one-off announcement to all active users.
              </p>
              <BroadcastForm
                onSent={async (sent) => {
                  setMsg(`Broadcast sent to ${sent} users.`);
                  await loadLog();
                }}
              />
            </section>
          </>
        )}

        {tab === "templates" && (
          <section className="admin-panel admin-templates-panel">
            <h2 className="admin-panel-title">Template preview & editor</h2>
            <div className="admin-templates-layout">
              <nav className="admin-templates-nav" aria-label="Email templates">
                {TEMPLATE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`admin-templates-nav-item${
                      selectedTemplate === id ? " is-active" : ""
                    }`}
                    aria-current={selectedTemplate === id ? "true" : undefined}
                    onClick={() => setSelectedTemplate(id)}
                  >
                    {emailTemplateLabel(id)}
                  </button>
                ))}
              </nav>
              <div className="admin-templates-main">
                {templates.find((t) => t.id === selectedTemplate) && (
                  <TemplateEditor
                    key={selectedTemplate}
                    template={
                      templates.find((t) => t.id === selectedTemplate)!
                    }
                    onSaved={async () => {
                      await load();
                      setMsg("Template saved.");
                    }}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {tab === "log" && (
          <section className="admin-panel">
            <div className="admin-filters">
              <select
                value={logStatus}
                onChange={(e) =>
                  setLogStatus(e.target.value as "all" | "sent" | "failed")
                }
                className="field admin-filter-field"
              >
                <option value="all">All</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => void loadLog()}
              >
                Refresh
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>To</th>
                    <th>Template</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        No email events yet
                      </td>
                    </tr>
                  )}
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td>{formatDateTime(ev.createdAt)}</td>
                      <td>{ev.toEmail}</td>
                      <td>
                        {ev.templateId
                          ? emailTemplateLabel(ev.templateId)
                          : "—"}
                      </td>
                      <td>{ev.provider ?? "—"}</td>
                      <td>{ev.status}</td>
                      <td className="text-[var(--text-muted)]">
                        {ev.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {msg && <p className="admin-invite-msg">{msg}</p>}
      </main>
    </div>
  );
}

export default function AdminEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading…</p>
        </div>
      }
    >
      <AdminEmailPageInner />
    </Suspense>
  );
}
