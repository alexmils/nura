"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Film, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import type { ResourcePost } from "@/lib/resources";

const KIND_LABEL: Record<ResourcePost["kind"], string> = {
  article: "Article",
  video: "Video",
  safety: "Safety",
};

function KindIcon({ kind }: { kind: ResourcePost["kind"] }) {
  if (kind === "video") return <Film size={18} />;
  if (kind === "safety") return <ShieldCheck size={18} />;
  return <FileText size={18} />;
}

/** Signed-in library at /app/resources. The editor is `/admin/resources/<id>`. */

export default function AdminResourcesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResourcePost[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "draft">("all");
  const [kind, setKind] = useState<"all" | ResourcePost["kind"]>("all");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

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

  const remove = async (item: ResourcePost) => {
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
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "visible" && !item.enabled) return false;
      if (filter === "draft" && item.enabled) return false;
      if (kind !== "all" && item.kind !== kind) return false;
      if (!q) return true;
      return [item.title, item.slug, item.kind]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, filter, kind]);

  const drafts = items.filter((item) => !item.enabled).length;
  const articles = items.filter((item) => item.kind === "article").length;
  const videos = items.filter((item) => item.kind === "video").length;
  const safety = items.filter((item) => item.kind === "safety").length;

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
                onClick={() => router.push("/admin/resources/new")}
              >
                New resource
              </button>
            )}
          </div>

          <div className="admin-filter-pills">
            {(
              [
                ["all", "All", items.length],
                ["visible", "Visible", items.length - drafts],
                ["draft", "Drafts", drafts],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`admin-filter-pill ${
                  filter === key ? "is-active" : ""
                }`}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label} <strong>{count}</strong>
              </button>
            ))}
          </div>

          <div className="admin-filter-pills">
            {(
              [
                ["all", "All types", items.length],
                ["article", "Articles", articles],
                ["video", "Videos", videos],
                ["safety", "Safety", safety],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`admin-filter-pill ${
                  kind === key ? "is-active" : ""
                }`}
                aria-pressed={kind === key}
                onClick={() => setKind(key)}
              >
                {label} <strong>{count}</strong>
              </button>
            ))}
          </div>

          <ul className="admin-content-list">
            {visible.map((item) => (
              <li key={item.id} className="admin-content-item">
                <button
                  type="button"
                  className="admin-content-row"
                  onClick={() => router.push(`/admin/resources/${item.id}`)}
                >
                  <span className="admin-content-lead">
                    <span
                      className={`admin-content-kind admin-content-kind--${item.kind}`}
                      aria-hidden
                    >
                      <KindIcon kind={item.kind} />
                    </span>
                    <span className="admin-content-main">
                      <span className="admin-content-title">{item.title}</span>
                      <span className="admin-content-meta">
                        /app/resources/{item.slug}
                      </span>
                    </span>
                  </span>
                  <span className="admin-chips">
                    <span className="admin-chip">{KIND_LABEL[item.kind]}</span>
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
      </main>
    </div>
  );
}
