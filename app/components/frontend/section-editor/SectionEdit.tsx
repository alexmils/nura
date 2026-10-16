"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getSectionDef } from "@/lib/marketing-sections";
import { AdminSectionChip } from "./AdminSectionChip";
import { useIsPlatformAdmin } from "./useIsPlatformAdmin";

const openEditors = new Set<string>();
const listeners = new Set<() => void>();

function setEditorOpen(id: string, open: boolean) {
  if (open) openEditors.add(id);
  else openEditors.delete(id);
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

/** Admin-only Edit chip. Renders nothing for everyone else. */
export function SectionEdit({ id, lift = false }: { id: string; lift?: boolean }) {
  const admin = useIsPlatformAdmin();
  const open = useSyncExternalStore(
    subscribe,
    () => openEditors.has(id),
    () => false
  );
  const def = getSectionDef(id);
  if (!admin || !def) return null;
  return (
    <>
      <AdminSectionChip
        name={def.name}
        id={id}
        lift={lift}
        onEdit={() => setEditorOpen(id, true)}
      />
      {open
        ? createPortal(
            <MarketingSectionEditor id={id} onClose={() => setEditorOpen(id, false)} />,
            document.body
          )
        : null}
    </>
  );
}
