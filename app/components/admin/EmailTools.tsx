"use client";

import { useEffect, useState } from "react";
import type { EmailTemplateId } from "@/lib/email/templates";
import {
  EMAIL_TEMPLATE_AUDIENCE,
  emailTemplateLabel,
} from "@/lib/email/template-labels";
import {
  EMAIL_TEMPLATE_DESCRIPTION,
  EMAIL_TEMPLATE_PLACEHOLDERS,
} from "@/lib/email/template-meta";
import { fetchJson } from "@/lib/fetch-json";

const PREVIEW_DEBOUNCE_MS = 120;

/** Preview iframe cannot load a host that returns a login page instead of the PNG. */
function previewLogoHtml(html: string): string {
  return html.replace(
    /https?:\/\/[^"'\s]+\/brand\/nura-wave-logo\.png/g,
    "/brand/nura-wave-logo.png"
  );
}

export function TemplateEditor({
  template,
  onSaved,
}: {
  template: {
    id: EmailTemplateId;
    subject: string;
    html: string;
    text: string;
    isCustom: boolean;
    enabled: boolean;
    delayHours: number | null;
    scheduled: boolean;
  };
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [text, setText] = useState(template.text);
  const [enabled, setEnabled] = useState(template.enabled);
  const [delayDays, setDelayDays] = useState<number | "">(
    template.delayHours == null ? "" : Math.round(template.delayHours / 24)
  );
  const [previewHtml, setPreviewHtml] = useState(() =>
    previewLogoHtml(template.html)
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "phone">("desktop");

  useEffect(() => {
    setSubject(template.subject);
    setHtml(template.html);
    setText(template.text);
    setEnabled(template.enabled);
    setDelayDays(
      template.delayHours == null ? "" : Math.round(template.delayHours / 24)
    );
    setPreviewHtml(previewLogoHtml(template.html));
  }, [template]);

  // Live preview from draft HTML (light debounce so iframe srcDoc stays usable while typing)
  useEffect(() => {
    const id = window.setTimeout(
      () => setPreviewHtml(previewLogoHtml(html)),
      PREVIEW_DEBOUNCE_MS
    );
    return () => window.clearTimeout(id);
  }, [html]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await fetchJson(`/api/admin/email/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, " "),
          ...(template.scheduled
            ? {
                enabled,
                delayHours:
                  delayDays === "" ? null : Math.round(Number(delayDays) * 24),
              }
            : {}),
        }),
      });
      onSaved();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const plainPreview = (text || html.replace(/<[^>]+>/g, " ")).trim();

  return (
    <>
      <form className="automation-editor" onSubmit={(e) => void save(e)}>
        <div className="admin-template-head">
          <div className="admin-template-head-copy">
            <h3 className="admin-template-title">
              {emailTemplateLabel(template.id)}
            </h3>
            <p className="admin-template-audience">
              Goes to{" "}
              {EMAIL_TEMPLATE_AUDIENCE[template.id] === "admin"
                ? "the platform admin"
                : "the member"}
            </p>
            <p className="admin-template-desc">
              {EMAIL_TEMPLATE_DESCRIPTION[template.id]}
            </p>
          </div>
          <span
            className={`admin-template-state${template.enabled ? "" : " is-off"}`}
          >
            {template.scheduled
              ? template.enabled
                ? "Scheduled"
                : "Paused"
              : template.isCustom
                ? "Edited"
                : "Default"}
          </span>
        </div>
        {template.scheduled ? (
          <div className="admin-field-label">
            <span>Scheduled send</span>
            <label className="admin-inline-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Sending is on
            </label>
            <label>
              Send after (days)
              <input
                type="number"
                min={0}
                max={365}
                step={1}
                value={delayDays}
                onChange={(e) =>
                  setDelayDays(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="field"
              />
            </label>
            <p className="admin-field-hint">
              Counted from the first app use after the trial date. The default is
              3 days.
            </p>
          </div>
        ) : null}
        <label className="admin-field-label">
          Subject
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="field"
          />
        </label>
        <label className="admin-field-label admin-field-grow">
          HTML body
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="field admin-textarea admin-textarea-html"
            rows={16}
          />
        </label>
        <label className="admin-field-label">
          Plain text (optional)
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="field admin-textarea"
            rows={3}
          />
        </label>
        <div className="admin-template-tokens">
          <p className="admin-template-tokens-title">Placeholders</p>
          <ul>
            {EMAIL_TEMPLATE_PLACEHOLDERS[template.id].map((token) => (
              <li key={token.token}>
                <code>{`{{${token.token}}}`}</code>
                <span>{token.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-fit">
          {busy ? "Saving…" : template.isCustom ? "Update template" : "Save custom version"}
        </button>
        {err && <p className="admin-invite-msg">{err}</p>}
      </form>
      <aside className="automation-preview" aria-label="Email preview">
        <div className="automation-preview-head">
          <div className="automation-preview-copy">
            <p className="automation-preview-label">Preview</p>
            <p className="automation-preview-subject">
              {subject || "(empty subject)"}
            </p>
          </div>
          <div
            className="admin-preview-modes"
            role="group"
            aria-label="Preview width"
          >
            {(["desktop", "phone"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`admin-preview-mode${
                  previewMode === mode ? " is-active" : ""
                }`}
                aria-pressed={previewMode === mode}
                onClick={() => setPreviewMode(mode)}
              >
                {mode === "desktop" ? "Desktop" : "Phone"}
              </button>
            ))}
          </div>
        </div>
        {/* sandbox="" blocks scripts — bare srcDoc is same-origin XSS */}
        <iframe
          title="Email preview"
          className={`admin-email-preview${
            previewMode === "phone" ? " is-phone" : ""
          }`}
          srcDoc={previewHtml}
          sandbox=""
          referrerPolicy="no-referrer"
        />
        {plainPreview ? (
          <pre className="admin-email-preview-plain">{plainPreview}</pre>
        ) : null}
      </aside>
    </>
  );
}

export function BroadcastForm({ onSent }: { onSent: (sent: number) => void }) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetchJson<{ sent: number }>("/api/admin/email/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, " "),
        }),
      });
      setSubject("");
      setHtml("");
      setText("");
      onSent(res.sent ?? 0);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Broadcast failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-form-stack mt-3" onSubmit={(e) => void submit(e)}>
      <input
        type="text"
        required
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="field"
      />
      <textarea
        required
        placeholder="HTML body"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        className="field admin-textarea"
        rows={5}
      />
      <textarea
        placeholder="Plain text (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="field admin-textarea"
        rows={3}
      />
      <button type="submit" disabled={busy} className="btn-primary w-fit">
        {busy ? "Sending…" : "Send broadcast"}
      </button>
      {err && <p className="admin-invite-msg">{err}</p>}
    </form>
  );
}
