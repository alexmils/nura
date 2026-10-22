"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";

type Item = {
  id: string;
  userId: string;
  score: number;
  comment: string | null;
  source: string;
  kind: "feedback" | "review";
  publishedAt: string | null;
  featured: boolean;
  adminSeenAt: string | null;
  createdAt: string;
  userEmail?: string;
  userName?: string | null;
};

type Tab = "reviews" | "feedback";

function sourceLabel(source: string): string {
  if (source === "trial_end_email") return "Trial end email";
  if (source === "review_email") return "Review request email";
  if (source === "page") return "Feedback page";
  if (source === "session_end") return "After session";
  if (source === "forced") return "Forced";
  if (source === "days_elapsed") return "Days elapsed";
  return source;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function memberName(item: Item): string {
  return item.userName?.trim() || item.userEmail || item.userId;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<Tab>("reviews");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "unpublished" | "featured"
  >("all");
  const [selected, setSelected] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editScore, setEditScore] = useState<number | "">("");
  const [editComment, setEditComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const openedFromQuery = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/feedback");
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not load feedback");
      return;
    }
    setItems(data.items ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (unread <= 0) return;
    void fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_seen" }),
    }).then(() => setUnread(0));
  }, [unread]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // The admin mail links straight to one item: open it once the list arrives.
  useEffect(() => {
    if (openedFromQuery.current || items.length === 0) return;
    openedFromQuery.current = true;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const match = items.find((item) => item.id === id);
    if (match) openItem(match);
  }, [items]);

  function openItem(item: Item) {
    setSelected(item);
    setEditing(false);
    setConfirmDelete(false);
    setEditScore(item.score);
    setEditComment(item.comment ?? "");
  }

  const reviews = items.filter((item) => item.kind === "review");
  const feedback = items.filter((item) => item.kind === "feedback");
  const shown = tab === "reviews" ? reviews : feedback;

  const query = search.trim().toLowerCase();
  const filtered = shown.filter((item) => {
    if (tab === "reviews") {
      if (statusFilter === "published" && !item.publishedAt) return false;
      if (statusFilter === "unpublished" && item.publishedAt) return false;
      if (statusFilter === "featured" && !item.featured) return false;
    }
    if (!query) return true;
    return [
      item.userName,
      item.userEmail,
      item.comment,
      item.source,
      sourceLabel(item.source),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  async function updateReview(
    item: Item,
    action: "publish" | "feature",
    payload: { published?: boolean; featured?: boolean }
  ) {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: item.id, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: Item;
        error?: string;
      };
      if (!res.ok || !data.item) {
        setMsg(data.error ?? "Could not update the review");
        return;
      }
      setItems((prev) =>
        prev.map((row) => (row.id === data.item!.id ? data.item! : row))
      );
      setSelected(data.item);
      setMsg(
        action === "publish"
          ? payload.published
            ? "Review published."
            : "Review unpublished."
          : payload.featured
            ? "Review featured."
            : "Review unfeatured."
      );
    } catch {
      setMsg("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!selected) return;
    const score = Number(editScore);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      setMsg("Score must be between 1 and 10.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: selected.id,
          score,
          comment: editComment,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: Item;
        error?: string;
      };
      if (!res.ok || !data.item) {
        setMsg(data.error ?? "Could not save the changes");
        return;
      }
      setItems((prev) =>
        prev.map((row) => (row.id === data.item!.id ? data.item! : row))
      );
      setSelected(data.item);
      setEditing(false);
      setMsg("Saved.");
    } catch {
      setMsg("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: selected.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setMsg(data.error ?? "Could not delete the item");
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== selected.id));
      setSelected(null);
      setConfirmDelete(false);
      setMsg("Deleted.");
    } catch {
      setMsg("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page admin-feedback-page">
      <AdminPageHeader
        title="Feedback & reviews"
        subtitle="Private member notes, and the reviews you choose to publish. Click a row to read, edit, publish or delete it."
      />
      <main className="admin-main">
        {msg ? <p className="admin-inline-msg">{msg}</p> : null}

        <div className="admin-feedback-tabs" role="tablist" aria-label="Feedback type">
          {(
            [
              ["reviews", "Reviews", reviews.length],
              ["feedback", "Feedback", feedback.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`admin-feedback-tab${tab === id ? " is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
              <span className="admin-feedback-tab-count">{count}</span>
            </button>
          ))}
        </div>

        <div className="admin-feedback-toolbar">
          <input
            type="search"
            className="field admin-feedback-search"
            placeholder="Search member, email or note"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search feedback and reviews"
          />
          {tab === "reviews" ? (
            <select
              className="field admin-feedback-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "all"
                    | "published"
                    | "unpublished"
                    | "featured"
                )
              }
              aria-label="Filter reviews by status"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="unpublished">Not published</option>
              <option value="featured">Featured</option>
            </select>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <p className="admin-muted">
            {shown.length === 0
              ? tab === "reviews"
                ? "No reviews yet. They arrive from the review email a month after the trial."
                : "No private feedback yet."
              : "No items match your search or filter."}
          </p>
        ) : (
          <div className="admin-feedback-list">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-feedback-row${
                  item.publishedAt ? " is-published" : ""
                }`}
                onClick={() => openItem(item)}
              >
                <span className="admin-feedback-row-score">
                  {item.score}
                  <small>/10</small>
                </span>
                <span className="admin-feedback-row-body">
                  <span className="admin-feedback-row-top">
                    <span className="admin-feedback-row-member">
                      {memberName(item)}
                    </span>
                    <time dateTime={item.createdAt}>
                      {formatDate(item.createdAt)}
                    </time>
                  </span>
                  <span
                    className={`admin-feedback-snippet${
                      item.comment?.trim() ? "" : " is-empty"
                    }`}
                  >
                    {item.comment?.trim() || "No written note"}
                  </span>
                </span>
                <span className="admin-feedback-row-side">
                  <span className="admin-feedback-source">
                    {sourceLabel(item.source)}
                  </span>
                  <span className="admin-feedback-badges">
                    <span className="admin-feedback-badge">
                      {item.kind === "review" ? "Review" : "Feedback"}
                    </span>
                    {item.publishedAt ? (
                      <span className="admin-feedback-badge is-live">
                        Published
                      </span>
                    ) : null}
                    {item.featured ? (
                      <span className="admin-feedback-badge is-featured">
                        Featured
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {selected ? (
          <div
            className="admin-feedback-overlay"
            onClick={() => setSelected(null)}
          >
            <div
              className="admin-feedback-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-feedback-dialog-head">
                <div>
                  <p className="admin-kicker">
                    {selected.kind === "review" ? "Review" : "Private feedback"}
                  </p>
                  <h2 id="feedback-detail-title" className="admin-feedback-dialog-score">
                    {selected.score}
                    <span>/10</span>
                  </h2>
                </div>
                <button
                  type="button"
                  className="admin-feedback-close"
                  aria-label="Close"
                  onClick={() => setSelected(null)}
                >
                  ×
                </button>
              </div>

              {editing ? (
                <>
                  <label className="admin-feedback-edit-field">
                    Score (1–10)
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editScore}
                      onChange={(event) =>
                        setEditScore(
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                      className="field"
                    />
                  </label>
                  <label className="admin-feedback-edit-field">
                    Note
                    <textarea
                      rows={6}
                      maxLength={2000}
                      value={editComment}
                      onChange={(event) => setEditComment(event.target.value)}
                      className="field admin-textarea"
                    />
                  </label>
                  <div className="admin-feedback-edit-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={saving}
                      onClick={() => void saveEdit()}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={saving}
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p className="admin-feedback-full">
                  {selected.comment?.trim() || "No written note."}
                </p>
              )}

              <dl className="admin-feedback-facts">
                <div>
                  <dt>Member</dt>
                  <dd>
                    <Link href={`/admin/users/${selected.userId}`}>
                      {memberName(selected)}
                    </Link>
                    {selected.userEmail ? (
                      <span>{selected.userEmail}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{sourceLabel(selected.source)}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
              </dl>

              {selected.kind === "review" ? (
                <div className="admin-feedback-publish">
                  <label className="admin-feedback-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(selected.publishedAt)}
                      disabled={saving}
                      onChange={(event) =>
                        void updateReview(selected, "publish", {
                          published: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>Published</strong>
                      <small>
                        Show on the public reviews page. The member&apos;s email
                        is never shown.
                      </small>
                    </span>
                  </label>
                  <label
                    className={`admin-feedback-toggle${
                      selected.publishedAt ? "" : " is-disabled"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.featured}
                      disabled={saving || !selected.publishedAt}
                      onChange={(event) =>
                        void updateReview(selected, "feature", {
                          featured: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>Featured</strong>
                      <small>Pin to the top of the public reviews page.</small>
                    </span>
                  </label>
                </div>
              ) : (
                <p className="admin-muted">
                  This is private feedback. It is never published.
                </p>
              )}

              {confirmDelete ? (
                <div className="admin-feedback-confirm" role="alert">
                  <p>
                    Delete this {selected.kind === "review" ? "review" : "feedback"}?
                    This cannot be undone.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={saving}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-feedback-delete"
                      disabled={saving}
                      onClick={() => void deleteItem()}
                    >
                      {saving ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : editing ? null : (
                <div className="admin-feedback-dialog-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-feedback-delete"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                  <Link
                    href={`/admin/users/${selected.userId}`}
                    className="btn-secondary"
                  >
                    Open member
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
