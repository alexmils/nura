"use client";

import { useEffect, useRef, useState } from "react";
import type { RenderedWinbackEmail } from "@/lib/winback-email";
import { WINBACK_NOTE_MAX } from "@/lib/email/winback-template";
import type { WinbackDraft } from "./WinbackEmailEditor";

import "./admin-user-layout.css";

/**
 * Admin single-user page: the win-back email as the member will get it.
 * Rendered by the "winback" template (Admin → Email → Automation), so the
 * preview, the test copy and the real send are the same email.
 */
export function WinbackEmailComposer(props: {
  userId: string;
  draft: WinbackDraft;
  note: string;
  busy: boolean;
  adminEmail: string;
  onChange: (d: WinbackDraft) => void;
  onNoteChange: (note: string) => void;
  onSend: () => void;
}) {
  const { draft, note, userId } = props;
  const [preview, setPreview] = useState<RenderedWinbackEmail | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [view, setView] = useState<"html" | "text">("html");
  const [testTo, setTestTo] = useState(props.adminEmail);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!testTo && props.adminEmail) setTestTo(props.adminEmail);
  }, [props.adminEmail, testTo]);

  // Debounced live render through the same server renderer as the send.
  useEffect(() => {
    const id = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/reactivation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "user_preview", userId, link: draft.link, subject: draft.subject, note }),
        });
        const body = (await res.json()) as { email?: RenderedWinbackEmail; error?: string };
        if (id !== seq.current) return;
        if (!res.ok || !body.email) throw new Error(body.error ?? "Preview failed");
        setPreview(body.email);
        setPreviewError(null);
      } catch (e) {
        if (id === seq.current) setPreviewError(e instanceof Error ? e.message : "Preview failed");
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [userId, draft.link, draft.subject, note]);

  async function sendTest() {
    setTestBusy(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/admin/reactivation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "user_test_send", userId, to: testTo, subject: draft.subject, note }),
      });
      const body = (await res.json()) as { error?: string; to?: string; expiresAt?: string };
      if (!res.ok) throw new Error(body.error ?? "Test send failed");
      setTestMsg({
        ok: true,
        text: `Test email sent to ${body.to}. It has its own one-use test link (valid until ${
          body.expiresAt ? new Date(body.expiresAt).toLocaleDateString() : "30 days"
        }); the member's real link is unchanged and nothing was recorded as sent.`,
      });
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof Error ? e.message : "Test send failed" });
    } finally {
      setTestBusy(false);
    }
  }

  const field = { display: "grid", gap: "0.3rem", fontSize: "0.85rem" } as const;
  return (
    <div style={{ display: "grid", gap: "0.65rem" }} data-testid="user-email-preview">
      <p className="admin-panel-sub" style={{ margin: 0 }}>
        To <strong>{draft.to}</strong>. Branded with the <em>Win-back offer</em> template from Admin → Email →
        Automation (edit the wording there). Nothing is sent until you press Send email.
      </p>
      <label style={field}>
        Subject
        <input
          value={draft.subject}
          maxLength={200}
          onChange={(e) => props.onChange({ ...draft, subject: e.target.value })}
          style={{ width: "100%" }}
          data-testid="user-winback-subject"
        />
      </label>
      <label style={field}>
        Personal note (optional, shown under the greeting)
        <textarea
          className="admin-textarea"
          rows={3}
          maxLength={WINBACK_NOTE_MAX}
          value={note}
          placeholder="e.g. I saw your report from Tuesday, thank you for taking the time."
          onChange={(e) => props.onNoteChange(e.target.value)}
          data-testid="user-winback-note"
        />
      </label>

      <div className="winback-preview-tabs" role="tablist" style={{ display: "flex", gap: "0.35rem" }}>
        <button
          type="button"
          role="tab"
          aria-selected={view === "html"}
          className={view === "html" ? "btn-primary admin-btn-sm" : "btn-secondary admin-btn-sm"}
          onClick={() => setView("html")}
        >
          Email
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "text"}
          className={view === "text" ? "btn-primary admin-btn-sm" : "btn-secondary admin-btn-sm"}
          onClick={() => setView("text")}
        >
          Plain text
        </button>
      </div>
      {previewError ? <p className="admin-panel-sub" style={{ margin: 0 }}>Preview error: {previewError}</p> : null}
      {preview ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <p className="admin-panel-sub" style={{ margin: 0 }}>
            Subject: <strong>{preview.subject}</strong>
            {preview.hasRealLink ? "" : " (placeholder link: generate a link first)"}
          </p>
          {view === "html" ? (
            <iframe
              title="Win-back email preview"
              sandbox=""
              srcDoc={preview.html}
              style={{ width: "100%", height: 620, border: "1px solid rgba(42,48,32,0.18)", borderRadius: 8, background: "#fff" }}
              data-testid="user-winback-iframe"
            />
          ) : (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                margin: 0,
                padding: "0.75rem",
                border: "1px solid rgba(42,48,32,0.18)",
                borderRadius: 8,
                fontFamily: "inherit",
                fontSize: "0.85rem",
                maxHeight: 620,
                overflow: "auto",
              }}
              data-testid="user-winback-text"
            >
              {preview.text}
            </pre>
          )}
        </div>
      ) : !previewError ? (
        <p className="admin-panel-sub" style={{ margin: 0 }}>Rendering preview...</p>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary admin-btn-sm"
          disabled={props.busy || !preview?.hasRealLink}
          onClick={() => {
            if (window.confirm(`Send the win-back email to ${draft.to}?`)) props.onSend();
          }}
          data-testid="user-send-winback"
        >
          Send email
        </button>
        <button
          type="button"
          className="btn-secondary admin-btn-sm"
          onClick={() => void navigator.clipboard?.writeText(draft.link).catch(() => {})}
        >
          Copy link
        </button>
      </div>

      <fieldset
        style={{ border: "1px dashed rgba(42,48,32,0.25)", borderRadius: 8, padding: "0.65rem 0.75rem", margin: 0, display: "grid", gap: "0.45rem" }}
        data-testid="user-winback-test"
      >
        <legend style={{ fontSize: "0.85rem", padding: "0 0.3rem" }}>Send test email</legend>
        <p className="admin-panel-sub" style={{ margin: 0 }}>
          Sends this exact email with a separate one-use test link that works end to end (test mode payments only).
          It does not use up or replace the member&apos;s link and is not listed as a sent win-back.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            aria-label="Test recipient"
            style={{ flex: "1 1 220px", minWidth: 0 }}
            data-testid="user-winback-test-to"
          />
          <button
            type="button"
            className="btn-secondary admin-btn-sm"
            disabled={testBusy || !testTo.trim()}
            onClick={() => void sendTest()}
            data-testid="user-winback-test-send"
          >
            {testBusy ? "Sending..." : "Send test email"}
          </button>
        </div>
        {testMsg ? (
          <p className="admin-panel-sub" style={{ margin: 0, color: testMsg.ok ? undefined : "#a03a2a" }} role="status">
            {testMsg.text}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
