"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import type { BlogCategoryRecord, BlogPostRecord } from "@/lib/blog-db";

/**
 * Public blog at /blog. The editor is its own page (`/admin/blog/<id>`), not a
 * tab here, so the list stays a list.
 */

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [categories, setCategories] = useState<BlogCategoryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/blog");
    const data = await res.json();
    if (res.ok) {
      setPosts(data.posts ?? []);
      setCategories(data.categories ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCanWrite(d.user?.role === "platform_admin"))
      .catch(() => setCanWrite(false));
  }, [load]);

  const setPublished = async (post: BlogPostRecord, published: boolean) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", slug: post.slug, published }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update post");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not update post");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (post: BlogPostRecord) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", slug: post.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete post");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete post");
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      [post.title, post.slug, ...(post.categories ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [posts, query]);

  const uncategorised = posts.filter(
    (post) => (post.categories ?? []).length === 0
  ).length;
  const publishedCount = posts.filter((post) => post.published).length;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Blog"
        subtitle="Public guides at /blog. Nothing here appears in /app/resources."
      />

      <main className="admin-main">
        {!canWrite && (
          <p className="admin-invite-msg">
            Support can read the blog; only platform admins can edit.
          </p>
        )}
        {msg && <p className="admin-invite-msg">{msg}</p>}

        <section className="admin-panel">
          <div className="admin-content-toolbar">
            <input
              className="field"
              value={query}
              placeholder="Filter by title, slug, or category"
              onChange={(e) => setQuery(e.target.value)}
            />
            {canWrite && (
              <button
                type="button"
                className="btn-primary shrink-0"
                disabled={busy}
                onClick={() => router.push("/admin/blog/new")}
              >
                New post
              </button>
            )}
          </div>

          <div className="admin-content-stats">
            <span>
              <strong>{posts.length}</strong> posts
            </span>
            <span>
              <strong>{publishedCount}</strong> published
            </span>
            <span>
              <strong>{posts.length - publishedCount}</strong> drafts
            </span>
            {uncategorised > 0 ? (
              <span className="admin-content-warn">
                <strong>{uncategorised}</strong> with no category
              </span>
            ) : null}
          </div>

          <ul className="admin-content-list">
            {visible.map((post) => {
              const chips = (post.categories ?? []).map((slug) => {
                const name =
                  categories.find((c) => c.slug === slug)?.name ?? slug;
                return (
                  <span key={slug} className="admin-chip">
                    {name}
                  </span>
                );
              });
              return (
                <li key={post.id} className="admin-content-item">
                  <button
                    type="button"
                    className="admin-content-row"
                    onClick={() => router.push(`/admin/blog/${post.id}`)}
                  >
                    <span className="admin-content-main">
                      <span className="admin-content-title">{post.title}</span>
                      <span className="admin-content-meta">
                        /blog/{post.slug}
                      </span>
                    </span>
                    <span className="admin-chips">
                      <span
                        className={`admin-chip ${
                          post.published ? "admin-chip--ok" : "admin-chip--warn"
                        }`}
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                      {chips.length ? (
                        chips
                      ) : (
                        <span className="admin-chip admin-chip--muted">
                          No category
                        </span>
                      )}
                    </span>
                  </button>
                  {canWrite ? (
                    <div className="admin-content-actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => void setPublished(post, !post.published)}
                      >
                        {post.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost is-danger"
                        disabled={busy}
                        onClick={() => void remove(post)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {visible.length === 0 ? (
              <li className="admin-panel-sub">No posts match.</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
