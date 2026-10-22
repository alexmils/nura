"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminMediaField } from "@/app/components/admin/AdminMediaField";
import { AdminMediaPicker } from "@/app/components/admin/AdminMediaPicker";
import {
  RESOURCE_KINDS,
  slugifyTitle,
  type ResourceKind,
  type ResourcePost,
} from "@/lib/resources";

type FormState = {
  id: string;
  slug: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  body: string;
  coverUrl: string;
  videoUrl: string;
  readMinutes: string;
  featured: boolean;
  enabled: boolean;
  sortOrder: string;
};

const EMPTY: FormState = {
  id: "",
  slug: "",
  kind: "article",
  title: "",
  summary: "",
  body: "",
  coverUrl: "",
  videoUrl: "",
  readMinutes: "",
  featured: false,
  enabled: true,
  sortOrder: "0",
};

function postToForm(p: ResourcePost): FormState {
  return {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    summary: p.summary,
    body: p.body ?? "",
    coverUrl: p.coverUrl ?? "",
    videoUrl: p.videoUrl ?? "",
    readMinutes: p.readMinutes != null ? String(p.readMinutes) : "",
    featured: p.featured,
    enabled: p.enabled,
    sortOrder: String(p.sortOrder ?? 0),
  };
}

export default function AdminResourceEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [pickerKind, setPickerKind] = useState<"image" | "video" | null>(null);

  function insertAtCursor(snippet: string) {
    const el = bodyRef.current;
    const current = form.body;
    const pos = el?.selectionStart ?? current.length;
    setForm((f) => ({
      ...f,
      body: current.slice(0, pos) + snippet + current.slice(pos),
    }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = pos + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function insertMediaUrl(url: string, kind: "image" | "video") {
    insertAtCursor(`\n![${kind}](${url})\n`);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/resources");
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not load resources");
      setLoaded(true);
      return;
    }
    const items = (data.resources ?? []) as ResourcePost[];
    if (id === "new") {
      setForm(EMPTY);
      setMissing(false);
    } else {
      const item = items.find((r) => r.id === id || r.slug === id);
      if (item) {
        setForm(postToForm(item));
        setMissing(false);
      } else {
        setMissing(true);
      }
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          resource: {
            id: form.id || undefined,
            slug: form.slug || slugifyTitle(form.title),
            kind: form.kind,
            title: form.title,
            summary: form.summary,
            body: form.body,
            coverUrl: form.coverUrl || null,
            videoUrl: form.videoUrl || null,
            readMinutes: form.readMinutes ? Number(form.readMinutes) : null,
            featured: form.featured,
            enabled: form.enabled,
            sortOrder: Number(form.sortOrder) || 0,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const saved = data.resource as ResourcePost | undefined;
      if (saved) {
        setForm(postToForm(saved));
        setMissing(false);
        if (id === "new") router.replace(`/admin/resources/${saved.id}`);
      }
      setMsg(saved?.enabled ? "Saved." : "Saved as draft.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="admin-page">
        <main className="admin-main">
          <p className="admin-panel-sub">Loading…</p>
        </main>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="admin-page">
        <main className="admin-main">
          <Link href="/admin/resources" className="admin-back-link">
            ← All resources
          </Link>
          <p className="admin-panel-sub">That resource no longer exists.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <main className="admin-main">
        <div className="admin-editor-topbar">
          <Link href="/admin/resources" className="admin-back-link">
            ← All resources
          </Link>
          {msg ? <span className="admin-editor-msg">{msg}</span> : null}
        </div>

        <div className="admin-editor">
          <section className="admin-editor-main">
            <div className="admin-box">
              <input
                className="admin-title-input"
                value={form.title}
                placeholder="Add title"
                disabled={busy}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({
                    ...f,
                    title,
                    slug:
                      !f.id && (!f.slug || f.slug === slugifyTitle(f.title))
                        ? slugifyTitle(title)
                        : f.slug,
                  }));
                }}
              />
              <label className="admin-field-label">
                Slug
                <input
                  className="field"
                  value={form.slug}
                  disabled={busy}
                  placeholder="auto from the title"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      slug: e.target.value.toLowerCase(),
                    }))
                  }
                />
              </label>
              <label className="admin-field-label">
                Summary
                <textarea
                  className="field"
                  rows={3}
                  value={form.summary}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, summary: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="admin-box">
              <h3 className="admin-box-title">Body</h3>
              <p className="admin-panel-sub">
                Markdown. Images, bold, and video clips are allowed.
              </p>
              <div className="admin-body-tools">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setPickerKind("image")}
                >
                  Insert image
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setPickerKind("video")}
                >
                  Insert video
                </button>
              </div>
              <textarea
                ref={bodyRef}
                className="field admin-body-textarea"
                rows={22}
                value={form.body}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
              />
              <p className="admin-panel-sub">
                A chip is inserted where the cursor was. MP4 and WebM render as
                a player inside the guide.
              </p>
            </div>
          </section>

          <aside className="admin-editor-side">
            <div className="admin-box">
              <h3 className="admin-box-title">Publish</h3>
              <p className="admin-panel-sub">
                {form.enabled
                  ? "Visible at /app/resources."
                  : "Draft, hidden from members."}
              </p>
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, enabled: e.target.checked }))
                  }
                />
                Visible
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.featured}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, featured: e.target.checked }))
                  }
                />
                Featured
              </label>
              <label className="admin-field-label">
                Sort order
                <input
                  className="field"
                  type="number"
                  value={form.sortOrder}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: e.target.value }))
                  }
                />
              </label>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : form.enabled ? "Save" : "Save draft"}
              </button>
            </div>

            <div className="admin-box">
              <h3 className="admin-box-title">Cover image</h3>
              <AdminMediaField
                label="Cover"
                value={form.coverUrl}
                onChange={(coverUrl) => setForm((f) => ({ ...f, coverUrl }))}
                folder="nura/resources"
                disabled={busy}
                hint="YouTube covers are derived automatically when left empty."
              />
            </div>

            <div className="admin-box">
              <h3 className="admin-box-title">Video</h3>
              <AdminMediaField
                label="Video"
                kind="video"
                value={form.videoUrl}
                onChange={(videoUrl) => setForm((f) => ({ ...f, videoUrl }))}
                folder="nura/resources"
                disabled={busy}
                hint="YouTube, Vimeo, or an https .mp4/.webm link. MP4 and WebM can be uploaded."
              />
            </div>

            <div className="admin-box">
              <h3 className="admin-box-title">Details</h3>
              <label className="admin-field-label">
                Kind
                <select
                  className="field"
                  value={form.kind}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      kind: e.target.value as ResourceKind,
                    }))
                  }
                >
                  {RESOURCE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field-label">
                Read minutes
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={120}
                  value={form.readMinutes}
                  disabled={busy}
                  placeholder="auto"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, readMinutes: e.target.value }))
                  }
                />
              </label>
            </div>
          </aside>
        </div>
      </main>

      <AdminMediaPicker
        kind={pickerKind ?? "image"}
        open={pickerKind !== null}
        folder="nura/resources"
        onClose={() => setPickerKind(null)}
        onPick={(url) => insertMediaUrl(url, pickerKind ?? "image")}
      />
    </div>
  );
}
