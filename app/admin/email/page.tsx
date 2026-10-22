"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { formatDateTime } from "@/lib/admin-format";
import type { EmailEvent } from "@/lib/email-events";
import { EMAIL_TEMPLATE_AUDIENCE, EMAIL_TEMPLATE_IDS, emailTemplateLabel, keepEmailTemplateId, type EmailTemplateId } from "@/lib/email/template-labels";
import {
  EMAIL_TEMPLATE_GROUP,
  EMAIL_TEMPLATE_GROUP_ORDER,
} from "@/lib/email/template-meta";
import type { EmailAdminView } from "@/lib/email-admin-settings";
import type { EmailAdminStatus } from "@/lib/email-admin-settings";
import { fetchJson } from "@/lib/fetch-json";
import { BroadcastForm, TemplateEditor } from "@/app/components/admin/EmailTools";

const TABS = ["delivery", "send", "templates", "admin", "log"] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { id: "delivery", label: "Delivery" },
  { id: "send", label: "Send" },
  { id: "templates", label: "Automation" },
  { id: "admin", label: "Admin" },
  { id: "log", label: "Log" },
] as const;

const CUSTOMER_TEMPLATE_IDS = EMAIL_TEMPLATE_IDS.filter(
  (id) => EMAIL_TEMPLATE_AUDIENCE[id] === "customer"
);
const ADMIN_TEMPLATE_IDS = EMAIL_TEMPLATE_IDS.filter(
  (id) => EMAIL_TEMPLATE_AUDIENCE[id] === "admin"
);
const ADMIN_TEST_TO = "amilosavljevic09@gmail.com";

const DELIVERY_PANES = [
  { id: "sender", label: "Sender" },
  { id: "brevo", label: "Brevo" },
  { id: "gmail", label: "Gmail" },
] as const;
type DeliveryPane = (typeof DELIVERY_PANES)[number]["id"];

type EmailFormState = EmailAdminView;

function sourceLabel(source: "stored" | "none"): string {
  if (source === "stored") return "saved";
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
      enabled: boolean;
      delayHours: number | null;
      scheduled: boolean;
    }[]
  >([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplateId>("welcome");
  const [testTo, setTestTo] = useState("");
  const [testTemplate, setTestTemplate] =
    useState<EmailTemplateId>("welcome");
  const [logStatus, setLogStatus] = useState<"all" | "sent" | "failed">("all");
  const [logAudience, setLogAudience] = useState<"all" | "user" | "admin">("all");
  const [msg, setMsg] = useState("");
  const [marketing, setMarketing] = useState<{ users: number; leads: number } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deliveryPane, setDeliveryPane] = useState<DeliveryPane>("sender");

  const load = useCallback(async () => {
    const [settingsRes, templatesRes] = await Promise.all([
      fetchJson<{
        status: EmailAdminStatus;
        email: EmailAdminView;
        canEdit: boolean;
        marketing?: { users: number; leads: number };
        webhookUrl?: string;
      }>("/api/admin/email/settings"),
      fetchJson<{
        templates: {
          id: EmailTemplateId;
          subject: string;
          html: string;
          text: string;
          isCustom: boolean;
          enabled: boolean;
          delayHours: number | null;
          scheduled: boolean;
        }[];
      }>("/api/admin/email/templates"),
    ]);
    setStatus(settingsRes.status);
    setForm(settingsRes.email);
    setCanEdit(settingsRes.canEdit);
    setMarketing(settingsRes.marketing ?? null);
    setWebhookUrl(settingsRes.webhookUrl ?? "");
    const list = templatesRes.templates ?? [];
    setTemplates(list);
    setSelectedTemplate(
      (id) => keepEmailTemplateId(id, list.map((t) => t.id)) as EmailTemplateId
    );
  }, []);

  const loadLog = useCallback(async () => {
    const params = new URLSearchParams({ limit: "50" });
    if (logStatus !== "all") params.set("status", logStatus);
    if (logAudience !== "all") params.set("audience", logAudience);
    const res = await fetchJson<{ events: EmailEvent[] }>(
      `/api/admin/email/events?${params.toString()}`
    );
    setEvents(res.events ?? []);
  }, [logStatus, logAudience]);

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

  useEffect(() => {
    const ids = tab === "admin" ? ADMIN_TEMPLATE_IDS : CUSTOMER_TEMPLATE_IDS;
    if (tab !== "templates" && tab !== "admin") return;
    setSelectedTemplate((current) =>
      ids.includes(current) ? current : ids[0]!
    );
  }, [tab]);

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
        brevoMarketingListId: form.brevoMarketingListId,
      };
      if (form.brevoApiKey.trim()) emailPatch.brevoApiKey = form.brevoApiKey.trim();
      if (form.brevoWebhookSecret.trim()) {
        emailPatch.brevoWebhookSecret = form.brevoWebhookSecret.trim();
      }
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
    await deliverTest(testTo, testTemplate);
  };

  const sendAdminTest = async () => {
    if (!ADMIN_TEMPLATE_IDS.includes(selectedTemplate)) return;
    await deliverTest(ADMIN_TEST_TO, selectedTemplate);
  };

  const deliverTest = async (to: string, templateId: EmailTemplateId) => {
    setBusy(true);
    setMsg("");
    try {
      await fetchJson("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, templateId }),
      });
      setMsg(`Test sent to ${to}.`);
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
          tab === "templates" || tab === "admin"
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
                {canEdit
                  ? " Leave a secret field blank to keep the saved value."
                  : " View only (secrets hidden; platform admin can edit)."}
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
              className="admin-form-stack admin-panel admin-email-delivery"
              onSubmit={(e) => void saveDelivery(e)}
            >
              <AdminTabs
                tabs={DELIVERY_PANES}
                value={deliveryPane}
                onChange={(id) => setDeliveryPane(id as DeliveryPane)}
              />

              {deliveryPane === "sender" && (
                <>
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
                </>
              )}

              {deliveryPane === "brevo" && (
                <>
                  <p className="admin-panel-sub">
                    Primary sender, marketing list, and unsubscribe webhook.
                  </p>
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
                          ? "Saved. Paste to replace"
                          : "xkeysib-…"
                      }
                    />
                  </label>
                  <label className="admin-field-label">
                    Marketing list ID
                    <input
                      value={form.brevoMarketingListId}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchForm({ brevoMarketingListId: e.target.value })
                      }
                      className="field"
                      placeholder="Brevo list number"
                    />
                  </label>
                  <label className="admin-field-label">
                    Webhook secret
                    <input
                      type="password"
                      autoComplete="off"
                      value={form.brevoWebhookSecret}
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchForm({ brevoWebhookSecret: e.target.value })
                      }
                      className="field"
                      placeholder={
                        form.hasBrevoWebhookSecret
                          ? "Saved. Paste to replace"
                          : "Secret Brevo sends with the unsubscribe webhook"
                      }
                    />
                  </label>
                  <p className="admin-help">
                    Opted-in accounts: {marketing?.users ?? 0}. Newsletter leads:{" "}
                    {marketing?.leads ?? 0}.
                    {webhookUrl
                      ? ` Unsubscribe webhook: ${webhookUrl}. Send the secret as x-brevo-secret or Bearer.`
                      : ""}
                  </p>
                </>
              )}

              {deliveryPane === "gmail" && (
                <>
                  <p className="admin-panel-sub">
                    Fallback when Brevo hits its send quota.
                  </p>
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
                          ? "Saved. Paste to replace"
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
                          ? "Saved. Paste to replace"
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
                          ? "Saved. Paste to replace"
                          : "1//…"
                      }
                    />
                  </label>
                </>
              )}

              {canEdit && (
                <button type="submit" disabled={busy} className="btn-primary w-fit">
                  {busy ? "Saving…" : "Save email settings"}
                </button>
              )}
            </form>
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
                  <optgroup label="Customer">
                    {CUSTOMER_TEMPLATE_IDS.map((id) => (
                      <option key={id} value={id}>
                        {emailTemplateLabel(id)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Admin">
                    {ADMIN_TEMPLATE_IDS.map((id) => (
                      <option key={id} value={id}>
                        {emailTemplateLabel(id)}
                      </option>
                    ))}
                  </optgroup>
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

        {(tab === "templates" || tab === "admin") && (
          <section className="admin-panel admin-templates-panel">
            <div className="admin-panel-head-row">
              <h2 className="admin-panel-title">
                {tab === "admin" ? "Mail to the platform admin" : "Automation"}
              </h2>
              {tab === "admin" ? (
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={busy}
                  onClick={() => void sendAdminTest()}
                >
                  {busy ? "Sending…" : "Send test"}
                </button>
              ) : null}
            </div>
            <p className="admin-panel-sub">
              {tab === "admin"
                ? `Sends the open mail to ${ADMIN_TEST_TO}.`
                : "Every email Nura sends on its own, and what each one says. The preview is the actual email, rendered by the same code that sends it."}
            </p>
            <div className="automation-grid">
              <nav
                className="automation-nav"
                aria-label={tab === "admin" ? "Admin emails" : "Customer emails"}
              >
                {EMAIL_TEMPLATE_GROUP_ORDER.map((group) => {
                  const items = (
                    tab === "admin" ? ADMIN_TEMPLATE_IDS : CUSTOMER_TEMPLATE_IDS
                  ).filter((id) => EMAIL_TEMPLATE_GROUP[id] === group);
                  if (items.length === 0) return null;

                  return (
                    <div className="admin-templates-nav-group" key={group}>
                      <p className="admin-templates-nav-heading">{group}</p>
                      {items.map((id) => {
                        const template = templates.find((t) => t.id === id);
                        const off = template ? !template.enabled : false;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`admin-templates-nav-item${
                              selectedTemplate === id ? " is-active" : ""
                            }`}
                            aria-current={
                              selectedTemplate === id ? "true" : undefined
                            }
                            onClick={() => setSelectedTemplate(id)}
                          >
                            <span
                              aria-hidden
                              className={`admin-templates-dot${
                                off ? " is-off" : ""
                              }`}
                            />
                            <span className="admin-templates-name">
                              {emailTemplateLabel(id)}
                            </span>
                            {template?.scheduled ? (
                              <span
                                className="admin-templates-tag"
                                title="Sent by cron after this delay"
                              >
                                {Math.round((template.delayHours ?? 0) / 24)}d
                              </span>
                            ) : null}
                            {template?.isCustom ? (
                              <span
                                className="admin-templates-tag"
                                title="Has saved changes"
                              >
                                Edited
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
              {templates.find((t) => t.id === selectedTemplate) ? (
                <TemplateEditor
                  key={selectedTemplate}
                  template={templates.find((t) => t.id === selectedTemplate)!}
                  onSaved={async () => {
                    await load();
                    setMsg("Template saved.");
                  }}
                />
              ) : (
                <p className="automation-empty">Loading templates…</p>
              )}
            </div>
          </section>
        )}

        {tab === "log" && (
          <section className="admin-panel">
            <div className="admin-filters admin-log-filters">
              <label className="admin-filter-label">
                Status
                <select
                  value={logStatus}
                  onChange={(e) =>
                    setLogStatus(e.target.value as "all" | "sent" | "failed")
                  }
                  className="field"
                >
                  <option value="all">All</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
              <label className="admin-filter-label">
                Mail
                <select
                  value={logAudience}
                  onChange={(e) =>
                    setLogAudience(e.target.value as "all" | "user" | "admin")
                  }
                  className="field"
                >
                  <option value="all">All</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
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
                        {logStatus === "all" && logAudience === "all"
                          ? "No email events yet"
                          : "No matching emails"}
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
