"use client";

import type { WinbackEmailDraft } from "@/lib/problem-report-rules";

import "./admin-user-layout.css";

export type WinbackDraft = WinbackEmailDraft & { link: string };

/**
 * Editable win-back email preview with the explicit "Send email" step.
 * Shared by Admin > Problem reports and the admin single-user page.
 */
export function WinbackEmailEditor(props: {
  draft: WinbackDraft;
  busy: boolean;
  onChange: (d: WinbackDraft) => void;
  onSend: () => void;
  testIdPrefix?: string;
}) {
  const { draft } = props;
  const prefix = props.testIdPrefix ?? "winback";
  return (
    <div style={{ display: "grid", gap: "0.5rem" }} data-testid={`${prefix}-email-preview`}>
      <p className="admin-panel-sub" style={{ margin: 0 }}>
        Email preview to <strong>{draft.to}</strong>. Edit it if you like; keep the link in the body.
        Nothing is sent until you press Send email.
      </p>
      <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
        Subject
        <input
          value={draft.subject}
          onChange={(e) => props.onChange({ ...draft, subject: e.target.value })}
          style={{ width: "100%" }}
        />
      </label>
      <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
        Body
        <textarea
          className="admin-textarea"
          rows={14}
          value={draft.body}
          onChange={(e) => props.onChange({ ...draft, body: e.target.value })}
        />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary admin-btn-sm"
          disabled={props.busy}
          onClick={() => {
            if (window.confirm(`Send the win-back email to ${draft.to}?`)) props.onSend();
          }}
          data-testid={`${prefix}-send-winback`}
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
    </div>
  );
}
