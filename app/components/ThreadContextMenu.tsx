"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  x: number;
  y: number;
  onRename: () => void;
  onEditDescription: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function ThreadContextMenu({
  x,
  y,
  onRename,
  onEditDescription,
  onDelete,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad)),
      top: Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Ignore the release of the long press that opened the menu.
    const openedAt = performance.now();
    const onPointer = (e: PointerEvent) => {
      if (performance.now() - openedAt < 120) return;
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="dropdown-menu thread-context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      aria-label="Session actions"
    >
      <button
        type="button"
        role="menuitem"
        className="dropdown-item w-full text-left"
        onClick={onRename}
      >
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        className="dropdown-item w-full text-left"
        onClick={onEditDescription}
      >
        Edit description
      </button>
      <div className="dropdown-divider" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="dropdown-item dropdown-item-danger w-full text-left"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
