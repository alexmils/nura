"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { AdminMediaField } from "@/app/components/admin/AdminMediaField";
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

const TABS = ["library", "editor"] as const;
type Tab = (typeof TABS)[number];
const ALL_TAB_ITEMS = [
  { id: "library", label: "Library" },
  { id: "editor", label: "Editor" },
] as const;

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

function AdminResourcesPageInner() {
  const [items, setItems] = useState<ResourcePost[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  const tabItems = useMemo(
    () => (canWrite ? ALL_TAB_ITEMS : ALL_TAB_ITEMS.filter((t) => t.id === "library")),
    [canWrite]
  );
  const [tab, setTab] = useAdminTab(
    canWrite ? TABS : (["library"] as const),
    "library"
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/resources");
    const data = await res.json();
    if (res.ok) setItems(data.resources ?? []);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCanWrite(d.user?.role === "platform_admin"))
      .catch(() => setCanWrite(false));
  }, [load]);

  const resetForm = () => setForm(EMPTY);

  const openEditor = (item?: ResourcePost) => {
    setForm(item ? postToForm(item) : EMPTY);
    setMsg("");
    setTab("editor");
  };

  const save = async () => {
    if (!canWrite) {
      setMsg("Only platform admins can edit resources");
      return;
    }
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
      if (data.resource) setForm(postToForm(data.resource as ResourcePost));
      setMsg(data.resource?.enabled ? "Saved." : "Saved as draft.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: ResourcePost) => {
    if (!canWrite) return;
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", resourceId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      if (form.id === item.id) resetForm();
      setMsg("Deleted");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.slug, item.kind].join(" ").toLowerCase().includes(q)
    );
  }, [items, query]);

  const drafts = items.filter((item) => !item.enabled).length;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Resources"
        subtitle="Articles, videos, and guides in /app/resources."
      />

      <main className="admin-main">
        {!canWrite && (
          <p className="admin-invite-msg">
            Support can view resources; only platform admins can create or edit.
          </p>
        )}
        {msg && <p className="admin-invite-msg">{msg}</p>}

        <AdminTabs
          tabs={tabItems}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {tab === "library" && (
          <section className="admin-panel">
            <div className="admin-content-toolbar">
              <input
                className="field"
                value={query}
                placeholder="Filter by title, slug, or kind"
                onChange={(e) => setQuery(e.target.value)}
              />
              {canWrite && (
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={busy}
                  onClick={() => openEditor()}
                >
                  New resource
                </button>
              )}
            </div>

            <div className="admin-content-stats">
              <span>
                <strong>{items.length}</strong> resources
              </span>
              <span>
                <strong>{items.length - drafts}</strong> visible
              </span>
              <span>
                <strong>{drafts}</strong> drafts
              </span>
            </div>

            <ul className="admin-content-list">
              {visible.map((item) => (
                <li key={item.id} className="admin-content-item">
                  <button
                    type="button"
                    className="admin-content-row"
                    onClick={() => openEditor(item)}
                  >
                    <span className="admin-content-main">
                      <span className="admin-content-title">{item.title}</span>
                      <span className="admin-content-meta">
                        /app/resources/{item.slug}
                      </span>
                    </span>
                    <span className="admin-chips">
                      <span className="admin-chip">{item.kind}</span>
                      <span
                        className={`admin-chip ${
                          item.enabled ? "admin-chip--ok" : "admin-chip--warn"
                        }`}
                      >
                        {item.enabled ? "Visible" : "Draft"}
                      </span>
                      {item.featured ? (
                        <span className="admin-chip admin-chip--muted">
                          Featured
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {canWrite ? (
                    <div className="admin-content-actions">
                      <button
                        type="button"
                        className="btn-ghost is-danger"
                        disabled={busy}
                        onClick={() => void remove(item)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
              {visible.length === 0 ? (
                <li className="admin-panel-sub">No resources match.</li>
              ) : null}
            </ul>
          </section>
        )}

        {tab === "editor" && canWrite && (
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
                  Markdown. Images, bold, and links are allowed.
                </p>
                <textarea
                  className="field admin-body-textarea"
                  rows={22}
                  value={form.body}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                />
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

              <button
                type="button"
                className="btn-secondary w-full"
                disabled={busy}
                onClick={() => setTab("library")}
              >
                Back to library
              </button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminResourcesPage() {
  return (
    <Suspense>
      <AdminResourcesPageInner />
    </Suspense>
  );
}
