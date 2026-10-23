"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getSectionDef } from "@/lib/marketing-sections";
import { AdminSectionChip } from "./AdminSectionChip";
import { readEditorFocus, type EditorFocus } from "./editor-focus";
import { useIsPlatformAdmin } from "./useIsPlatformAdmin";

const openEditors = new Set<string>();
const openFocus = new Map<string, EditorFocus>();
const listeners = new Set<() => void>();

function setEditorOpen(id: string, open: boolean, focus: EditorFocus | null = null) {
  if (open) openEditors.add(id);
  else openEditors.delete(id);
  if (open && focus) openFocus.set(id, focus);
  else openFocus.delete(id);
  listeners.forEach((listener) => listener());
}

export function closeAllEditors() {
  if (openEditors.size === 0) return;
  openEditors.clear();
  openFocus.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const MarketingSectionEditor = dynamic(
  () => import("./MarketingSectionEditor").then((mod) => mod.MarketingSectionEditor),
  { ssr: false }
);

let openSnapshot = "";
function openKey() {
  openSnapshot = [...openEditors].join("|");
  return openSnapshot;
}

/** Admin-only Edit chip. Renders nothing for everyone else. */
export function SectionEdit({ id, lift = false }: { id: string; lift?: boolean }) {
  const admin = useIsPlatformAdmin();
  const def = getSectionDef(id);
  if (!admin || !def) return null;
  return (
    <AdminSectionChip
      name={def.name}
      id={id}
      lift={lift}
      onEdit={() => setEditorOpen(id, true, readEditorFocus(id))}
    />
  );
}

/**
 * Open panels live here, once per page, not inside the chip: a section that
 * hides or swaps markup while you edit it (e.g. "Show this section" off)
 * must not unmount its own panel.
 */
export function SectionEditorHost() {
  const key = useSyncExternalStore(subscribe, openKey, () => "");
  if (!key || typeof document === "undefined") return null;
  return createPortal(
    <>
      {key.split("|").map((id) => (
        <MarketingSectionEditor
          key={id}
          id={id}
          focus={openFocus.get(id) ?? null}
          onClose={() => setEditorOpen(id, false)}
        />
      ))}
    </>,
    document.body
  );
}
