"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ClipboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import {
  TaskImageLightbox,
  TaskImageStrip,
} from "@/app/components/admin/TaskImageStrip";
import { useToast } from "@/app/components/Toast";
import {
  ADMIN_TASK_STATUS_LABEL,
  type AdminTask,
  type AdminTaskStatus,
} from "@/lib/admin-tasks";
import { imageFileFromClipboard } from "@/lib/clipboard-image";
import { fetchJson } from "@/lib/fetch-json";

export function AdminTaskDetail({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [row, setRow] = useState<AdminTask | null>(null);
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    const task = await fetchJson<AdminTask>(`/api/admin/tasks/${taskId}`);
    setRow(task);
    setBody(task.body || "");
    setLabel(task.label || "");
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        await load();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load task.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function save() {
    const text = body.trim();
    if (!text) {
      toast("Task text can’t be empty.", "error");
      return;
    }
    setBusy(true);
    try {
      const updated = await fetchJson<AdminTask>(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          label: label.trim() || null,
        }),
      });
      setRow(updated);
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(st: AdminTaskStatus) {
    setBusy(true);
    try {
      const updated = await fetchJson<AdminTask>(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: st }),
      });
      setRow(updated);
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function attachImage(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/tasks/${taskId}/image`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as AdminTask & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setRow(data);
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e: ClipboardEvent) {
    const file = imageFileFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    void attachImage(file);
  }

  async function removeOne(url: string) {
    setBusy(true);
    try {
      const updated = await fetchJson<AdminTask>(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeImageUrl: url }),
      });
      setRow(updated);
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove image.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAllImages() {
    setBusy(true);
    try {
      const updated = await fetchJson<AdminTask>(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearImages: true }),
      });
      setRow(updated);
      toast("Saved.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not remove images.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeTask() {
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    try {
      await fetchJson(`/api/admin/tasks/${taskId}`, { method: "DELETE" });
      toast("Deleted.");
      router.push("/admin/tasks");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.", "error");
      setBusy(false);
    }
  }

  if (err && !row) {
    return (
      <div className="admin-page">
        <main className="admin-main max-w-2xl space-y-4">
          <Link href="/admin/tasks" className="admin-task-back">
            ← Tasks
          </Link>
          <p className="admin-invite-msg text-[var(--destructive)]">{err}</p>
        </main>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Task"
        subtitle="Edit text and images. Ctrl+V pastes a screenshot."
      />
      <main className="admin-main max-w-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/tasks" className="admin-task-back">
            ← Tasks
          </Link>
          <TaskImageStrip urls={row.imageUrls} size="md" />
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            ["pending", "idea", "in_progress", "completed"] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              disabled={busy || row.status === st}
              className={`admin-task-filter ${
                row.status === st ? "active" : ""
              }`}
              onClick={() => void setStatus(st)}
            >
              {ADMIN_TASK_STATUS_LABEL[st]}
            </button>
          ))}
        </div>

        <textarea
          className="admin-task-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={onPaste}
          placeholder="Task text. Ctrl+V pastes a screenshot."
          disabled={busy}
        />

        <label className="block text-sm text-[var(--text-secondary)]">
          Label
          <input
            className="admin-task-input mt-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ui, billing…"
            disabled={busy}
          />
        </label>

        {row.imageUrls.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
              Images · {row.imageUrls.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {row.imageUrls.map((url, i) => (
                <div key={`${url}-${i}`} className="relative">
                  <button
                    type="button"
                    className="cursor-pointer block overflow-hidden rounded border border-[var(--border)] hover:border-[#84B067]"
                    title="View image"
                    onClick={() => setLightboxIndex(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-24 w-24 object-cover" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-1 top-1 cursor-pointer rounded border border-[var(--border)] bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80 hover:text-white"
                    disabled={busy}
                    onClick={() => void removeOne(url)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {row.imageUrls.length > 1 ? (
              <button
                type="button"
                className="admin-task-btn"
                disabled={busy}
                onClick={() => void removeAllImages()}
              >
                Remove all images
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="admin-task-btn accent"
            disabled={busy}
            onClick={() => void save()}
          >
            Save
          </button>
          <label className="admin-task-btn inline-flex cursor-pointer items-center">
            Attach image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void attachImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="admin-task-btn"
            disabled={busy}
            onClick={() => void removeTask()}
          >
            Delete
          </button>
        </div>

        {lightboxIndex != null && row.imageUrls.length > 0 ? (
          <TaskImageLightbox
            urls={row.imageUrls}
            index={lightboxIndex}
            onIndexChange={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        ) : null}
      </main>
    </div>
  );
}
