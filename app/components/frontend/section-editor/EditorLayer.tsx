"use client";

import { useEffect, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";

let openCount = 0;

function setOpen(delta: number) {
  openCount = Math.max(0, openCount + delta);
  const root = document.documentElement;
  if (openCount > 0) {
    root.dataset.editorOpen = "";
    document.body.style.overflow = "hidden";
  } else {
    delete root.dataset.editorOpen;
    document.body.style.overflow = "";
  }
}

/** Portals a drawer to body and locks scroll while it is open. */
export function EditorLayer(props: HTMLAttributes<HTMLDivElement>) {
  useEffect(() => {
    setOpen(1);
    return () => setOpen(-1);
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<div data-editor-layer {...props} />, document.body);
}
