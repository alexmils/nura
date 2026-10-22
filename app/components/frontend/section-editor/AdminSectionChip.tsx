"use client";

import { Pencil } from "lucide-react";

export function AdminSectionChip({
  name,
  id,
  onEdit,
  lift = false,
}: {
  name: string;
  id: string;
  onEdit: () => void;
  lift?: boolean;
}) {
  return (
    <div
      data-admin-chip
      className={lift ? "fe-section-chip fe-section-chip--lift" : "fe-section-chip"}
    >
      <span className="fe-section-chip-name">{name}</span>
      <span aria-hidden className="fe-section-chip-dot">
        ·
      </span>
      <code className="fe-section-chip-id">{id}</code>
      <button type="button" onClick={onEdit} aria-label={`Edit section: ${name}`}>
        <Pencil size={14} aria-hidden />
        Edit
      </button>
    </div>
  );
}
