"use client";

import { CloudinaryPicker } from "@/app/components/admin/CloudinaryPicker";

/**
 * The full Cloudinary library in a modal: folder tree, labels, paged grid,
 * drag-to-folder, and upload from this computer.
 *
 * Thin adapter over `CloudinaryPicker` so the blog and resources editors keep
 * their simple "give me one URL" contract.
 */
export function AdminMediaPicker({
  kind,
  open,
  onClose,
  onPick,
  folder = "nura/admin",
}: {
  kind: "image" | "video";
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  /** Folder uploads land in when no folder is selected in the sidebar. */
  folder?: string;
}) {
  if (!open) return null;

  return (
    <CloudinaryPicker
      mediaType={kind}
      single
      used={[]}
      defaultFolder={folder}
      onClose={onClose}
      onImport={(urls) => {
        const url = urls[0];
        if (url) onPick(url);
        onClose();
      }}
    />
  );
}
