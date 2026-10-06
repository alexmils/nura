"use client";

import { use } from "react";
import { AdminTaskDetail } from "@/app/components/admin/AdminTaskDetail";

export default function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  if (!id) {
    return (
      <div className="admin-page p-6 text-[var(--text-secondary)]">
        Task not found.
      </div>
    );
  }
  return <AdminTaskDetail taskId={id} />;
}
