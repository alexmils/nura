"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskImageStrip } from "@/app/components/admin/TaskImageStrip";
import { useToast } from "@/app/components/Toast";
import {
  ADMIN_TASK_STATUS_LABEL,
  type AdminTask,
} from "@/lib/admin-tasks";
import { imageFileFromClipboard } from "@/lib/clipboard-image";
import { fetchJson } from "@/lib/fetch-json";
import "./admin-tasks.css";

export function AdminTasksOverviewCard() {
  const router = useRouter();
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    task: AdminTask;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchJson<{ items: AdminTask[] }>("/api/admin/tasks");
      setTasks(res.items);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!menu) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openTasks = useMemo(
    () => (tasks || []).filter((t) => t.status !== "completed").slice(0, 8),
    [tasks]
  );

  const counts = useMemo(() => {
    const rows = tasks || [];
    return {
      open: rows.filter((t) => t.status !== "completed").length,
      idea: rows.filter((t) => t.status === "idea").length,
      pending: rows.filter((t) => t.status === "pending").length,
    };
  }, [tasks]);

  function onPaste(e: ClipboardEvent) {
    const file = imageFileFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    setImage(file);
    toast("Image attached.");
  }

  async function addTask() {
    const text = draft.trim() || (image ? "Screenshot" : "");
    if (!text && !image) return;
    setBusy(true);
    try {
      const row = await fetchJson<AdminTask>("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text || "Screenshot", status: "idea" }),
      });
      if (image) {
        const fd = new FormData();
        fd.append("file", image);
        const res = await fetch(`/api/admin/tasks/${row.id}/image`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Upload failed.");
        }
      }
      setDraft("");
      setImage(null);
      await load();
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  }

  function openTask(row: AdminTask) {
    setMenu(null);
    router.push(`/admin/tasks/${row.id}`);
  }

  function onContextMenu(e: ReactMouseEvent, row: AdminTask) {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 140;
    const menuH = 88;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y), task: row });
  }

  async function deleteTask(row: AdminTask) {
    setMenu(null);
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    try {
      await fetchJson(`/api/admin/tasks/${row.id}`, { method: "DELETE" });
      setTasks((cur) => (cur || []).filter((t) => t.id !== row.id));
      toast("Deleted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel admin-dash-span-2 admin-tasks-card">
      <div className="admin-panel-head-row">
        <h2 className="admin-panel-title">Tasks</h2>
        <Link href="/admin/tasks" className="admin-task-btn solid">
          Open board →
        </Link>
      </div>

      <div className="admin-task-stats">
        <span className="admin-task-stat">
          <strong>{tasks == null ? "…" : counts.open}</strong> Open
        </span>
        <span className="admin-task-stat">
          <strong>{tasks == null ? "…" : counts.idea}</strong> Idea
        </span>
        <span className="admin-task-stat">
          <strong>{tasks == null ? "…" : counts.pending}</strong> Pending
        </span>
      </div>

      <div className="admin-task-composer">
        <label className="admin-task-composer-label" htmlFor="admin-task-draft">
          New task
        </label>
        <div className="admin-task-composer-row">
          <input
            id="admin-task-draft"
            type="text"
            className="admin-task-input"
            placeholder="Type the task here"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addTask();
              }
            }}
          />
          <button
            type="button"
            className="admin-task-btn solid"
            disabled={busy || (!draft.trim() && !image)}
            onClick={() => void addTask()}
          >
            Add task
          </button>
        </div>
        <p className="admin-task-composer-hint">
          Tip: Ctrl+V pastes a screenshot into this box.
        </p>
      </div>

      {image && preview ? (
        <div className="admin-task-attach">
          <p className="admin-task-composer-label">Attached screenshot</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" />
          <button
            type="button"
            className="admin-task-btn"
            disabled={busy}
            onClick={() => setImage(null)}
          >
            Remove image
          </button>
        </div>
      ) : null}

      <p className="admin-task-composer-hint" style={{ marginBottom: "0.75rem" }}>
        Open tasks below · click a row to open · right-click for Edit or Delete
      </p>

      <ul className="admin-task-list">
        {tasks == null ? (
          <li className="admin-task-empty">Loading tasks…</li>
        ) : openTasks.length === 0 ? (
          <li className="admin-task-empty">
            Nothing open yet. Type a task above, then Add task.
          </li>
        ) : (
          openTasks.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="admin-task-row w-full text-left"
                disabled={busy}
                title="Open task · right-click for Edit or Delete"
                onClick={() => openTask(row)}
                onContextMenu={(e) => onContextMenu(e, row)}
              >
                <span className="admin-task-row-main">
                  <span className="admin-task-body line-clamp-2">
                    {row.body}
                  </span>
                  <span className="admin-task-pill muted">
                    {ADMIN_TASK_STATUS_LABEL[row.status] || row.status}
                    {row.label ? ` · ${row.label}` : ""}
                  </span>
                </span>
                {row.imageUrls.length > 0 ? (
                  <TaskImageStrip urls={row.imageUrls} />
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>

      {menu ? (
        <div
          ref={menuRef}
          className="admin-task-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            className="admin-task-menu-item"
            onClick={() => openTask(menu.task)}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-task-menu-item muted"
            disabled={busy}
            onClick={() => void deleteTask(menu.task)}
          >
            Delete
          </button>
        </div>
      ) : null}
    </section>
  );
}
