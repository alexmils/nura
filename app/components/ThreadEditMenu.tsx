"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "./AppProvider";

export function ThreadEditMenu({
  threadId,
  focus = "title",
  onClose,
}: {
  threadId: string;
  /** Field to focus: "description" for the Edit description action. */
  focus?: "title" | "description";
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const el = focus === "description" ? descriptionRef.current : titleRef.current;
    el?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the dialog opens
  }, [Boolean(thread)]);

  if (!thread) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="apple-sheet w-full max-w-md p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Edit session"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-[length:var(--ui-headline)] font-semibold tracking-[-0.02em]">
          Edit session
        </h2>
        <label className="mb-4 block">
          <span className="settings-label mb-2">Title</span>
          <input
            ref={titleRef}
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mb-4 block">
          <span className="settings-label mb-2">Description</span>
          <input
            ref={descriptionRef}
            className="field"
            value={description}
            placeholder="Optional note for this session"
            maxLength={160}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {memoryEnabled && (
          <p className="mb-5 settings-help">
            These notes follow you into every session.{" "}
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
