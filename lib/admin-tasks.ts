/** Admin task board — statuses, labels, shared helpers. */

export const ADMIN_TASK_STATUSES = [
  "pending",
  "idea",
  "in_progress",
  "completed",
] as const;

export type AdminTaskStatus = (typeof ADMIN_TASK_STATUSES)[number];

export const ADMIN_TASK_STATUS_LABEL: Record<AdminTaskStatus, string> = {
  pending: "Pending",
  idea: "Idea",
  in_progress: "In progress",
  completed: "Completed",
};

export const MAX_IMAGES_PER_TASK = 12;
export const MAX_TASK_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_TASK_BODY = 8000;
export const MAX_TASK_LABEL = 64;

export type AdminTask = {
  id: string;
  body: string;
  status: AdminTaskStatus;
  label: string | null;
  imageUrls: string[];
  sortOrder: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function normalizeTaskStatus(
  raw: string | null | undefined,
  fallback: AdminTaskStatus = "pending"
): AdminTaskStatus {
  const s = (raw || fallback)
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  const mapped = s === "inprogress" ? "in_progress" : s;
  if ((ADMIN_TASK_STATUSES as readonly string[]).includes(mapped)) {
    return mapped as AdminTaskStatus;
  }
  throw new Error("Status must be pending, idea, in_progress, or completed.");
}

export function normalizeTaskLabel(raw: string | null | undefined): string | null {
  const label = (raw || "").trim();
  if (!label) return null;
  if (label.length > MAX_TASK_LABEL) {
    throw new Error(`Label is too long (max ${MAX_TASK_LABEL}).`);
  }
  return label;
}

export function normalizeTaskBody(raw: string | null | undefined): string {
  const body = (raw || "").trim();
  if (!body) throw new Error("Write some text first.");
  if (body.length > MAX_TASK_BODY) {
    throw new Error(`Text is too long (max ${MAX_TASK_BODY}).`);
  }
  return body;
}

/** Public API path for a stored media filename. */
export function adminTaskMediaUrl(filename: string): string {
  return `/api/admin/tasks/media/${encodeURIComponent(filename)}`;
}
