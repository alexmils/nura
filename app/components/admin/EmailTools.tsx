"use client";

import { useEffect, useState } from "react";
import type { EmailTemplateId } from "@/lib/email/templates";
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
  const [delayHours, setDelayHours] = useState<number | "">(
    template.delayHours ?? ""
  );
  const [previewHtml, setPreviewHtml] = useState(() =>
    previewLogoHtml(template.html)
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setSubject(template.subject);
    setHtml(template.html);
    setText(template.text);
    setEnabled(template.enabled);
    setDelayHours(template.delayHours ?? "");
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
                delayHours: delayHours === "" ? null : Number(delayHours),
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
    <div className="admin-template-editor-wrap">
      <form className="admin-template-editor" onSubmit={(e) => void save(e)}>
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
              Send after (hours)
              <input
                type="number"
                min={0}
                max={8760}
                value={delayHours}
                onChange={(e) =>
                  setDelayHours(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="field"
              />
            </label>
            <p className="admin-field-hint">
              Counted from the first app use after the trial date. 72 is three days.
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
        <button type="submit" disabled={busy} className="btn-primary w-fit">
          {busy ? "Saving…" : template.isCustom ? "Update template" : "Save custom version"}
        </button>
        {err && <p className="admin-invite-msg">{err}</p>}
      </form>
      <div
        className="admin-email-preview-chrome"
        role="region"
        aria-label="Email preview"
      >
        <p className="admin-email-preview-subject">
          <span className="admin-email-preview-label">Subject</span>
          {subject || "(empty)"}
        </p>
        {/* sandbox="" blocks scripts — bare srcDoc is same-origin XSS */}
        <iframe
          title="Email preview"
          className="admin-email-preview"
          srcDoc={previewHtml}
          sandbox=""
          referrerPolicy="no-referrer"
        />
        {plainPreview ? (
          <pre className="admin-email-preview-plain">{plainPreview}</pre>
        ) : null}
      </div>
    </div>
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
