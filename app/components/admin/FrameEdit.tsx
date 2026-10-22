"use client";

import { useEffect } from "react";
import {
  clearSectionDraft,
  getSectionDraft,
  setSectionDraft,
  useSectionDraft,
} from "@/app/components/frontend/section-editor/section-draft";
import { FRAME_DRAG, type FrameDrag } from "@/app/components/admin/frame-drag";
import { imagePosition, type ImagePosition } from "@/lib/image-position";

/**
 * Edit / Done beside a photograph (ported from alexandermils FrameEdit).
 * Edit lets that photo be dragged on the page (scroll to zoom); Done keeps it.
 */
export function FrameEdit({
  frameKey: key,
  url,
  value,
  onDone,
  className = "fe-editor-frame-btn",
}: {
  frameKey: string;
  url: string;
  value?: unknown;
  onDone: (position: ImagePosition) => void;
  className?: string;
}) {
  const drag = useSectionDraft<FrameDrag>(FRAME_DRAG);
  const on = drag?.key === key;
  useEffect(
    () => () => {
      if (getSectionDraft<FrameDrag>(FRAME_DRAG)?.key === key) clearSectionDraft(FRAME_DRAG);
    },
    [key],
  );
  useEffect(() => {
    if (!on || !drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSectionDraft(FRAME_DRAG);
        return;
      }
      if (e.key !== "Enter" || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      const next = imagePosition(drag);
      onDone(next);
      setSectionDraft(FRAME_DRAG, { ...drag, x: next.x, y: next.y, zoom: next.zoom, done: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, drag, onDone]);
  useEffect(() => {
    if (!drag?.done || drag.key !== key) return;
    const now = imagePosition(value);
    if (now.x === drag.x && now.y === drag.y && now.zoom === drag.zoom) clearSectionDraft(FRAME_DRAG);
  }, [drag, key, value]);
  return (
    <button
      type="button"
      className={on ? `${className} is-on` : className}
      aria-pressed={on}
      onClick={() => {
        if (on && drag) {
          const next = imagePosition(drag);
          onDone(next);
          setSectionDraft(FRAME_DRAG, { ...drag, x: next.x, y: next.y, zoom: next.zoom, done: true });
          return;
        }
        const p = imagePosition(value);
        setSectionDraft(FRAME_DRAG, { key, url, x: p.x, y: p.y, zoom: p.zoom });
      }}
    >
      {on ? "Done" : "Edit"}
    </button>
  );
}
