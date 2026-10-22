"use client";

import { useEffect, useState } from "react";
import { BlogCta } from "@/app/components/frontend/BlogCta";
import {
  BLOG_CTA_TEMPLATES,
  BLOG_CTA_TEMPLATE_LABELS,
  type BlogCtaData,
  type BlogCtaTemplate,
} from "@/lib/blog-cta";

const DEFAULTS: BlogCtaData = {
  template: "calm",
  title: "Practice between sessions",
  body: "Seven days, three guided sessions, and a set timer you control.",
  button: "Start your 7-day trial",
  href: "/pricing",
  background: "",
  text: "",
};

/**
 * Build one CTA and preview it with the exact component the article renders.
 * Nothing is saved here; the caller inserts the serialized block at the cursor
 * or at the end of the post.
 */
export function AdminCtaBuilder({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (data: BlogCtaData) => void;
}) {
  const [form, setForm] = useState<BlogCtaData>(DEFAULTS);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(DEFAULTS);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    onInsert({
      ...form,
      title: form.title.trim(),
      body: form.body?.trim() || undefined,
      button: form.button?.trim() || undefined,
      href: form.href?.trim() || undefined,
      background: form.background?.trim() || undefined,
      text: form.text?.trim() || undefined,
    });
    onClose();
  }

  return (
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Add a call to action"
    >
      <div className="admin-modal admin-cta-builder">
        <div className="admin-media-picker-head">
          <h2 className="admin-box-title">Call to action</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="admin-field-label">
          Template
          <select
            className="field"
            value={form.template}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                template: e.target.value as BlogCtaTemplate,
              }))
            }
          >
            {BLOG_CTA_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {BLOG_CTA_TEMPLATE_LABELS[template]}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field-label">
          Title
          <input
            className="field"
            value={form.title}
            maxLength={140}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>

        <label className="admin-field-label">
          Body
          <textarea
            className="field"
            rows={3}
            value={form.body ?? ""}
            maxLength={400}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </label>

        <div className="admin-cta-row">
          <label className="admin-field-label">
            Button
            <input
              className="field"
              value={form.button ?? ""}
              maxLength={48}
              onChange={(e) =>
                setForm((f) => ({ ...f, button: e.target.value }))
              }
            />
          </label>
          <label className="admin-field-label">
            Link
            <input
              className="field"
              value={form.href ?? ""}
              placeholder="/pricing or https://…"
              onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
            />
          </label>
        </div>

        <div className="admin-cta-row">
          <label className="admin-field-label">
            Background
            <span className="admin-cta-colour">
              <input
                type="color"
                value={form.background || "#eaf4e2"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, background: e.target.value }))
                }
              />
              <input
                className="field"
                value={form.background ?? ""}
                placeholder="default"
                onChange={(e) =>
                  setForm((f) => ({ ...f, background: e.target.value }))
                }
              />
            </span>
          </label>
          <label className="admin-field-label">
            Text colour
            <span className="admin-cta-colour">
              <input
                type="color"
                value={form.text || "#2a3020"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, text: e.target.value }))
                }
              />
              <input
                className="field"
                value={form.text ?? ""}
                placeholder="default"
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              />
            </span>
          </label>
        </div>

        <p className="admin-panel-sub">Preview</p>
        <BlogCta data={form} />

        {error ? (
          <p className="admin-mcp-wizard-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-content-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            Insert CTA
          </button>
        </div>
      </div>
    </div>
  );
}
