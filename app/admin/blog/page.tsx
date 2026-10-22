"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import {
  CLUSTER_TOPICS,
  CLUSTER_TOPIC_LABEL,
  type ClusterTopic,
} from "@/lib/content-cluster";
import type { BlogCategoryRecord, BlogPostRecord } from "@/lib/blog-db";

/**
 * Public blog at /blog. Separate from /admin/resources, which is the signed-in
 * library at /app/resources: different tables, different audience.
 */

type SectionForm = { heading: string; paragraphs: string };

type FormState = {
  id: string;
  slug: string;
  title: string;
  description: string;
  dek: string;
  kicker: string;
  topic: ClusterTopic;
  categories: string[];
  featured: boolean;
  published: boolean;
  coverUrl: string;
  emdrAnchor: string;
  publishedAt: string;
  sections: SectionForm[];
};

const EMPTY: FormState = {
  id: "",
  slug: "",
  title: "",
  description: "",
  dek: "",
  kicker: "",
  topic: "understand",
  categories: [],
  featured: false,
  published: false,
  coverUrl: "",
  emdrAnchor: "",
  publishedAt: "",
  sections: [{ heading: "", paragraphs: "" }],
};

const TABS = ["posts", "editor"] as const;
type Tab = (typeof TABS)[number];
const ALL_TAB_ITEMS = [
  { id: "posts", label: "Posts" },
  { id: "editor", label: "Editor" },
] as const;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function postToForm(post: BlogPostRecord): FormState {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.description,
    dek: post.dek,
    kicker: post.kicker,
    topic: post.topic,
    categories: post.categories ?? [],
    featured: post.featured,
    published: post.published,
    coverUrl: post.coverUrl ?? "",
    emdrAnchor: post.emdrAnchor ?? "",
    publishedAt: post.publishedAt ? post.publishedAt.slice(0, 10) : "",
    sections: (post.sections ?? []).map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs.join("\n\n"),
    })),
  };
}

function AdminBlogPageInner() {
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [categories, setCategories] = useState<BlogCategoryRecord[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  const tabItems = useMemo(
    () => (canWrite ? ALL_TAB_ITEMS : ALL_TAB_ITEMS.filter((t) => t.id === "posts")),
    [canWrite]
  );
  const [tab, setTab] = useAdminTab(
    canWrite ? TABS : (["posts"] as const),
    "posts"
  );

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

  const openEditor = (post?: BlogPostRecord) => {
    setForm(post ? postToForm(post) : EMPTY);
    setMsg("");
    setTab("editor");
  };

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const sections = form.sections
        .map((section) => ({
          heading: section.heading.trim(),
          paragraphs: section.paragraphs
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
        }))
        .filter((section) => section.heading && section.paragraphs.length > 0);

      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.description.trim()) throw new Error("Description is required.");
      if (!form.emdrAnchor.trim()) throw new Error("EMDR link text is required.");
      if (form.categories.length === 0) {
        throw new Error("Choose at least one category.");
      }
      if (sections.length === 0) {
        throw new Error("Add at least one section with a heading and a paragraph.");
      }

      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          post: {
            ...(form.id ? { id: form.id } : {}),
            slug: form.slug || slugify(form.title),
            title: form.title,
            description: form.description,
            dek: form.dek,
            kicker: form.kicker,
            topic: form.topic,
            categories: form.categories,
            featured: form.featured,
            published: form.published,
            coverUrl: form.coverUrl || null,
            emdrAnchor: form.emdrAnchor,
            publishedAt: form.publishedAt || undefined,
            sections,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save post");
      setMsg("Saved.");
      await load();
      setTab("posts");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save post");
    } finally {
      setBusy(false);
    }
  };

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

  const uncategorised = posts.filter((post) => (post.categories ?? []).length === 0).length;

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

        <AdminTabs
          tabs={tabItems}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {tab === "posts" && (
          <section className="admin-panel">
            <div className="admin-filters mb-4">
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
                  onClick={() => openEditor()}
                >
                  New post
                </button>
              )}
            </div>

            <h2 className="admin-panel-title">
              {visible.length} of {posts.length} posts
            </h2>
            {uncategorised > 0 ? (
              <p className="admin-panel-sub">
                {uncategorised} post{uncategorised === 1 ? "" : "s"} have no
                category and no category page.
              </p>
            ) : null}

            <ul className="admin-resources-list">
              {visible.map((post) => (
                <li key={post.id} className="admin-resources-list-item">
                  <div className="min-w-0">
                    <strong>{post.title}</strong>
                    <p className="admin-panel-sub !mt-1">
                      {post.published ? "published" : "draft"}
                      {post.featured ? " · featured" : ""}
                      {(post.categories ?? []).length
                        ? ` · ${post.categories.join(", ")}`
                        : " · no category"}
                      {" · "}/blog/{post.slug}
                    </p>
                  </div>
                  <div className="admin-resources-list-actions">
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busy}
                          onClick={() => openEditor(post)}
                        >
                          Edit
                        </button>
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
                          className="btn-ghost"
                          disabled={busy}
                          onClick={() => void remove(post)}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
              {visible.length === 0 ? (
                <li className="admin-panel-sub">No posts match.</li>
              ) : null}
            </ul>
          </section>
        )}

        {tab === "editor" && canWrite && (
          <section className="admin-panel">
            <h2 className="admin-panel-title">
              {form.id ? "Edit post" : "New post"}
            </h2>

            <label className="admin-field-label">
              Title
              <input
                className="field"
                value={form.title}
                disabled={busy}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({
                    ...f,
                    title,
                    slug: !f.id && (!f.slug || f.slug === slugify(f.title))
                      ? slugify(title)
                      : f.slug,
                  }));
                }}
              />
            </label>

            <label className="admin-field-label">
              Slug
              <input
                className="field"
                value={form.slug}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))
                }
              />
            </label>

            <label className="admin-field-label">
              Description
              <input
                className="field"
                value={form.description}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>

            <label className="admin-field-label">
              Dek
              <input
                className="field"
                value={form.dek}
                disabled={busy}
                onChange={(e) => setForm((f) => ({ ...f, dek: e.target.value }))}
              />
            </label>

            <label className="admin-field-label">
              Kicker
              <input
                className="field"
                value={form.kicker}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kicker: e.target.value }))
                }
              />
            </label>

            <label className="admin-field-label">
              Topic
              <select
                className="field"
                value={form.topic}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, topic: e.target.value as ClusterTopic }))
                }
              >
                {CLUSTER_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {CLUSTER_TOPIC_LABEL[topic]}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="admin-field-label">
              Categories
              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <label key={category.slug} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(category.slug)}
                      disabled={busy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          categories: e.target.checked
                            ? [...f.categories, category.slug]
                            : f.categories.filter((c) => c !== category.slug),
                        }))
                      }
                    />
                    <span>
                      {category.name} ({category.postCount})
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="admin-field-label">
              EMDR link text
              <input
                className="field"
                value={form.emdrAnchor}
                disabled={busy}
                placeholder="How a guided session is structured in Nura"
                onChange={(e) =>
                  setForm((f) => ({ ...f, emdrAnchor: e.target.value }))
                }
              />
            </label>

            <label className="admin-field-label">
              Cover image URL
              <input
                className="field"
                value={form.coverUrl}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, coverUrl: e.target.value }))
                }
              />
            </label>

            <label className="admin-field-label">
              Published date
              <input
                type="date"
                className="field"
                value={form.publishedAt}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, publishedAt: e.target.value }))
                }
              />
            </label>

            <div className="admin-filters mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, published: e.target.checked }))
                  }
                />
                Published
              </label>
              <label className="flex items-center gap-2">
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
            </div>

            <h3 className="admin-panel-title">Sections</h3>
            <p className="admin-panel-sub">
              One paragraph per blank line. An em dash is rewritten and the
              acronym BLS is rejected.
            </p>
            {form.sections.map((section, index) => (
              <div key={index} className="admin-panel mb-4">
                <label className="admin-field-label">
                  Heading
                  <input
                    className="field"
                    value={section.heading}
                    disabled={busy}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sections: f.sections.map((s, i) =>
                          i === index ? { ...s, heading: e.target.value } : s
                        ),
                      }))
                    }
                  />
                </label>
                <label className="admin-field-label">
                  Paragraphs
                  <textarea
                    className="field"
                    rows={6}
                    value={section.paragraphs}
                    disabled={busy}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sections: f.sections.map((s, i) =>
                          i === index ? { ...s, paragraphs: e.target.value } : s
                        ),
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy || form.sections.length === 1}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      sections: f.sections.filter((_, i) => i !== index),
                    }))
                  }
                >
                  Remove section
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  sections: [...f.sections, { heading: "", paragraphs: "" }],
                }))
              }
            >
              Add section
            </button>

            <div className="admin-filters mt-6">
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save post"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setTab("posts")}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function AdminBlogPage() {
  return (
    <Suspense>
      <AdminBlogPageInner />
    </Suspense>
  );
}
