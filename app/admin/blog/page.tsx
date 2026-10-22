"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { AdminMediaField } from "@/app/components/admin/AdminMediaField";
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

  const save = async (publish?: boolean) => {
    if (!canWrite) return;
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

      const published = publish ?? form.published;
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
            published,
            coverUrl: form.coverUrl || null,
            emdrAnchor: form.emdrAnchor,
            publishedAt: form.publishedAt || undefined,
            sections,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save post");
      if (data.post) setForm(postToForm(data.post as BlogPostRecord));
      setMsg(published ? "Published." : "Saved as draft.");
      await load();
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
      if (form.id === post.id) setForm(EMPTY);
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

        <AdminTabs
          tabs={tabItems}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {tab === "posts" && (
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
                  onClick={() => openEditor()}
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
                      onClick={() => openEditor(post)}
                    >
                      <span className="admin-content-main">
                        <span className="admin-content-title">
                          {post.title}
                        </span>
                        <span className="admin-content-meta">
                          /blog/{post.slug}
                        </span>
                      </span>
                      <span className="admin-chips">
                        <span
                          className={`admin-chip ${
                            post.published
                              ? "admin-chip--ok"
                              : "admin-chip--warn"
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
                        !f.id && (!f.slug || f.slug === slugify(f.title))
                          ? slugify(title)
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
                <p className="admin-panel-sub">
                  /blog/{form.slug || slugify(form.title) || "slug"}
                </p>
              </div>

              <div className="admin-box">
                <h3 className="admin-box-title">Sections</h3>
                <p className="admin-panel-sub">
                  One paragraph per blank line. An em dash is rewritten and the
                  acronym BLS is rejected.
                </p>
                {form.sections.map((section, index) => (
                  <div key={index} className="admin-section-card">
                    <div className="admin-section-card-head">
                      <span className="admin-chip admin-chip--muted">
                        Section {index + 1}
                      </span>
                      <div className="admin-content-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busy || index === 0}
                          onClick={() =>
                            setForm((f) => {
                              const next = [...f.sections];
                              [next[index - 1], next[index]] = [
                                next[index],
                                next[index - 1],
                              ];
                              return { ...f, sections: next };
                            })
                          }
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busy || index === form.sections.length - 1}
                          onClick={() =>
                            setForm((f) => {
                              const next = [...f.sections];
                              [next[index + 1], next[index]] = [
                                next[index],
                                next[index + 1],
                              ];
                              return { ...f, sections: next };
                            })
                          }
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="btn-ghost is-danger"
                          disabled={busy || form.sections.length === 1}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              sections: f.sections.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
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
                        rows={8}
                        value={section.paragraphs}
                        disabled={busy}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            sections: f.sections.map((s, i) =>
                              i === index
                                ? { ...s, paragraphs: e.target.value }
                                : s
                            ),
                          }))
                        }
                      />
                    </label>
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
              </div>
            </section>

            <aside className="admin-editor-side">
              <div className="admin-box">
                <h3 className="admin-box-title">Publish</h3>
                <p className="admin-panel-sub">
                  {form.published ? "Live on /blog." : "Draft, not on /blog."}
                </p>
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
                <div className="admin-content-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => void save(false)}
                  >
                    {busy ? "Saving…" : "Save draft"}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void save(true)}
                  >
                    {form.published ? "Update" : "Publish"}
                  </button>
                </div>
                {form.id ? (
                  <a
                    className="admin-media-link"
                    href={`/blog/${form.slug || slugify(form.title)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on site
                  </a>
                ) : null}
                <label className="admin-field-label admin-checkbox-row">
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

              <div className="admin-box">
                <h3 className="admin-box-title">Featured image</h3>
                <AdminMediaField
                  label="Cover"
                  value={form.coverUrl}
                  onChange={(coverUrl) => setForm((f) => ({ ...f, coverUrl }))}
                  folder="nura/blog"
                  disabled={busy}
                  hint="Shown on cards and at the top of the guide."
                />
              </div>

              <div className="admin-box">
                <h3 className="admin-box-title">Categories</h3>
                <div className="admin-chip-checks">
                  {categories.map((category) => (
                    <label key={category.slug} className="admin-chip-check">
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
                      <span>{category.name}</span>
                      <span className="admin-chip admin-chip--muted">
                        {category.postCount}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-box">
                <h3 className="admin-box-title">SEO and summary</h3>
                <label className="admin-field-label">
                  Meta description
                  <textarea
                    className="field"
                    rows={3}
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
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dek: e.target.value }))
                    }
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
                      setForm((f) => ({
                        ...f,
                        topic: e.target.value as ClusterTopic,
                      }))
                    }
                  >
                    {CLUSTER_TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {CLUSTER_TOPIC_LABEL[topic]}
                      </option>
                    ))}
                  </select>
                </label>
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
              </div>

              <button
                type="button"
                className="btn-secondary w-full"
                disabled={busy}
                onClick={() => setTab("posts")}
              >
                Back to posts
              </button>
            </aside>
          </div>
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
