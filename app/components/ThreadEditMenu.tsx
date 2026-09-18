"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "./AppProvider";

export function ThreadEditMenu({
  threadId,
  onClose,
}: {
  threadId: string;
  onClose: () => void;
}) {
  const { threads, memoryEnabled, updateThreadLocal, selectThread } = useApp();
  const thread = threads.find((t) => t.id === threadId);
  const [title, setTitle] = useState(thread?.title ?? "");
  const [description, setDescription] = useState(thread?.description ?? "");

  useEffect(() => {
    void selectThread(threadId);
  }, [threadId, selectThread]);

  useEffect(() => {
    setTitle(thread?.title ?? "");
    setDescription(thread?.description ?? "");
  }, [thread?.title, thread?.description, threadId]);

  if (!thread) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="apple-sheet w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-[length:var(--ui-headline)] font-semibold tracking-[-0.02em]">
          Edit session
        </h2>
        <label className="mb-4 block">
          <span className="settings-label mb-2">Title</span>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mb-4 block">
          <span className="settings-label mb-2">Description</span>
          <input
            className="field"
            value={description}
            placeholder="Optional note for this session"
            maxLength={160}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {memoryEnabled && (
          <p className="mb-5 settings-help">
            Memory notes are account-wide.{" "}
            <Link
              href="/app/settings?tab=memory"
              className="settings-muted font-medium text-[var(--accent)] hover:underline"
              onClick={onClose}
            >
              Manage memory
            </Link>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              void updateThreadLocal(threadId, {
                title,
                description: description.trim(),
              });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
