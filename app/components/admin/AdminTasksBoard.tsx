"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { TaskImageStrip } from "@/app/components/admin/TaskImageStrip";
import { useToast } from "@/app/components/Toast";
import {
  ADMIN_TASK_STATUS_LABEL,
  type AdminTask,
  type AdminTaskStatus,
} from "@/lib/admin-tasks";
import { fetchJson } from "@/lib/fetch-json";

const FILTERS: { id: AdminTaskStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "idea", label: "Idea" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

function oneLine(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

function statusTone(status: string): string {
  if (status === "completed") return "admin-task-pill muted";
  if (status === "idea") return "admin-task-pill accent";
  if (status === "in_progress") return "admin-task-pill accent-soft";
  return "admin-task-pill";
}

export function AdminTasksBoard() {
  const router = useRouter();
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<AdminTask[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLabel, setFilterLabel] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    task: AdminTask;
  } | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filterStatus !== "all") qs.set("status", filterStatus);
    if (filterLabel) qs.set("label", filterLabel);
    if (search.trim()) qs.set("q", search.trim());
    const q = qs.toString();
    const res = await fetchJson<{ items: AdminTask[]; labels: string[] }>(
      `/api/admin/tasks${q ? `?${q}` : ""}`
    );
    setItems(res.items);
    setLabels(res.labels || []);
  }, [filterLabel, filterStatus, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        await load();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load tasks.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

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

  function openTask(row: AdminTask) {
    setMenu(null);
    router.push(`/admin/tasks/${row.id}`);
  }

  function onRowContextMenu(e: ReactMouseEvent, row: AdminTask) {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 140;
    const menuH = 88;
    const x = Math.min(
      e.clientX,
      (typeof window !== "undefined" ? window.innerWidth : e.clientX) -
        menuW -
        pad
    );
    const y = Math.min(
      e.clientY,
      (typeof window !== "undefined" ? window.innerHeight : e.clientY) -
        menuH -
        pad
    );
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y), task: row });
  }

  async function removeTask(row: AdminTask) {
    setMenu(null);
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    try {
      await fetchJson(`/api/admin/tasks/${row.id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((t) => t.id !== row.id));
      toast("Deleted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleComplete(row: AdminTask) {
    const next: AdminTaskStatus =
      row.status === "completed" ? "pending" : "completed";
    setBusy(true);
    try {
      await fetchJson(`/api/admin/tasks/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await load();
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  }

  const openRows = items.filter((t) => t.status !== "completed");
  const doneRows = items.filter((t) => t.status === "completed");

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Tasks"
        subtitle="Click a row to open · right-click Edit or Delete · add from Overview"
      />
      <main className="admin-main max-w-2xl space-y-5">
        {err ? <p className="admin-invite-msg text-[var(--destructive)]">{err}</p> : null}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`admin-task-filter ${
                filterStatus === s.id ? "active" : ""
              }`}
              onClick={() => setFilterStatus(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {labels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
              Label
            </span>
            <button
              type="button"
              className={`admin-task-filter ${!filterLabel ? "active" : ""}`}
              onClick={() => setFilterLabel("")}
            >
              Any
            </button>
            {labels.map((lab) => (
              <button
                key={lab}
                type="button"
                className={`admin-task-filter ${
                  filterLabel === lab ? "active" : ""
                }`}
                onClick={() =>
                  setFilterLabel((cur) => (cur === lab ? "" : lab))
                }
              >
                {lab}
              </button>
            ))}
          </div>
        ) : null}

        <input
          className="admin-task-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
        />

        <ul className="admin-task-list">
          {items.length === 0 ? (
            <li className="admin-task-empty">
              No tasks yet. Add one from Overview.
            </li>
          ) : (
            <>
              {openRows.map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  busy={busy}
                  onOpen={() => openTask(row)}
                  onToggleComplete={() => void toggleComplete(row)}
                  onContextMenu={(e) => onRowContextMenu(e, row)}
                />
              ))}
              {doneRows.length > 0 && filterStatus === "all" ? (
                <li className="admin-task-section">
                  Completed · {doneRows.length}
                </li>
              ) : null}
              {doneRows.map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  busy={busy}
                  onOpen={() => openTask(row)}
                  onToggleComplete={() => void toggleComplete(row)}
                  onContextMenu={(e) => onRowContextMenu(e, row)}
                />
              ))}
            </>
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
              onClick={() => void removeTask(menu.task)}
            >
              Delete
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function TaskRow({
  row,
  busy,
  onOpen,
  onToggleComplete,
  onContextMenu,
}: {
  row: AdminTask;
  busy: boolean;
  onOpen: () => void;
  onToggleComplete: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}) {
  const done = row.status === "completed";
  return (
    <li>
      <div
        className="admin-task-row"
        onClick={onOpen}
        onContextMenu={onContextMenu}
        title="Open task · right-click for Edit or Delete"
      >
        <button
          type="button"
          className={`admin-task-check ${done ? "done" : ""}`}
          title={done ? "Mark pending" : "Mark completed"}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
          aria-label={done ? "Mark pending" : "Mark completed"}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`admin-task-body ${done ? "done" : ""}`}>
            {oneLine(row.body)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={statusTone(row.status)}>
              {ADMIN_TASK_STATUS_LABEL[row.status] || row.status}
            </span>
            {row.label ? (
              <span className="admin-task-pill muted">{row.label}</span>
            ) : null}
          </div>
        </div>
        {row.imageUrls.length > 0 ? (
          <TaskImageStrip urls={row.imageUrls} className="mt-0.5" />
        ) : null}
      </div>
    </li>
  );
}
