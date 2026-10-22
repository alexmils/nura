"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminCtaBuilder } from "@/app/components/admin/AdminCtaBuilder";
import { AdminMediaField } from "@/app/components/admin/AdminMediaField";
import { serializeBlogCta, type BlogCtaData } from "@/lib/blog-cta";
import {
  CLUSTER_TOPICS,
  CLUSTER_TOPIC_LABEL,
  type ClusterTopic,
} from "@/lib/content-cluster";
import type { BlogCategoryRecord, BlogPostRecord } from "@/lib/blog-db";

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

export default function AdminBlogEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<BlogCategoryRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const sectionRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaSectionRef = useRef<number | null>(null);
  const [ctaTarget, setCtaTarget] = useState<number | "end" | null>(null);

  function insertCta(data: BlogCtaData) {
    const block = serializeBlogCta(data);
    const target = ctaTarget;
    setCtaTarget(null);
    if (target === null) return;
    if (target === "end") {
      setForm((f) => {
        const last = f.sections.length - 1;
        if (last < 0) return f;
        const next = [...f.sections];
        const current = next[last].paragraphs.trim();
        next[last] = {
          ...next[last],
          paragraphs: current ? `${current}\n\n${block}` : block,
        };
        return { ...f, sections: next };
      });
      return;
    }
    insertAtSection(target, `\n\n${block}\n\n`);
  }

  function insertAtSection(index: number, snippet: string) {
    const el = sectionRefs.current[index];
    const current = form.sections[index]?.paragraphs ?? "";
    const pos = el?.selectionStart ?? current.length;
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) =>
        i === index
          ? { ...s, paragraphs: s.paragraphs.slice(0, pos) + snippet + s.paragraphs.slice(pos) }
          : s
      ),
    }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = pos + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  }

  /** Screenshot names are all digits; that alt text helps nobody. */
  function altFromFilename(name: string): string {
    const base = name
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return base && !/^[\d\s]+$/.test(base) ? base : "";
  }

  async function insertMediaFile(file: File, kind: "image" | "video") {
    const index = mediaSectionRef.current;
    if (index === null) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "nura/blog");
      const res = await fetch("/api/admin/cloudinary/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const url = String(data.url ?? "");
      if (!url) throw new Error("Upload returned no URL.");
      const alt = altFromFilename(file.name) || kind;
      insertAtSection(index, `\n\n![${alt}](${url})\n\n`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      mediaSectionRef.current = null;
    }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/blog");
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not load posts");
      setLoaded(true);
      return;
    }
    setCategories(data.categories ?? []);
    const posts = (data.posts ?? []) as BlogPostRecord[];
    if (id === "new") {
      setForm(EMPTY);
      setMissing(false);
    } else {
      const post = posts.find((p) => p.id === id || p.slug === id);
      if (post) {
        setForm(postToForm(post));
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

  const save = async (publish?: boolean) => {
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
      const saved = data.post as BlogPostRecord | undefined;
      if (saved) {
        setForm(postToForm(saved));
        setMissing(false);
        if (id === "new") router.replace(`/admin/blog/${saved.id}`);
      }
      setMsg(published ? "Published." : "Saved as draft.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save post");
    } finally {
      setBusy(false);
    }
  };

  const slugPreview = useMemo(
    () => form.slug || slugify(form.title),
    [form.slug, form.title]
  );

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
          <Link href="/admin/blog" className="admin-back-link">
            ← All posts
          </Link>
          <p className="admin-panel-sub">That post no longer exists.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <main className="admin-main">
        <div className="admin-editor-topbar">
          <Link href="/admin/blog" className="admin-back-link">
            ← All posts
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
                /blog/{slugPreview || "slug"}
              </p>
            </div>

            <div className="admin-box">
              <h3 className="admin-box-title">Sections</h3>
              <p className="admin-panel-sub">
                One paragraph per blank line. An em dash is rewritten and the
                acronym BLS is rejected. Insert media drops markdown at the
                cursor. A bare YouTube or Vimeo link becomes an embed.
              </p>
              <input
                ref={imageInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void insertMediaFile(file, "image");
                  e.target.value = "";
                }}
              />
              <input
                ref={videoInputRef}
                type="file"
                hidden
                accept="video/mp4,video/webm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void insertMediaFile(file, "video");
                  e.target.value = "";
                }}
              />
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
                        disabled={busy}
                        onClick={() => {
                          mediaSectionRef.current = index;
                          imageInputRef.current?.click();
                        }}
                      >
                        Insert image
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => {
                          mediaSectionRef.current = index;
                          videoInputRef.current?.click();
                        }}
                      >
                        Insert video
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => setCtaTarget(index)}
                      >
                        Insert CTA
                      </button>
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
                      ref={(el) => {
                        sectionRefs.current[index] = el;
                      }}
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
              <div className="admin-content-actions">
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
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setCtaTarget("end")}
                >
                  Add closing CTA
                </button>
              </div>
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
                  href={`/blog/${slugPreview}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on site
                </a>
              ) : null}
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
          </aside>
        </div>
      </main>

      <AdminCtaBuilder
        open={ctaTarget !== null}
        onClose={() => setCtaTarget(null)}
        onInsert={insertCta}
      />
    </div>
  );
}
