"use client";

import type { ReactNode } from "react";
import { SectionEdit } from "./SectionEdit";
import { useIsPlatformAdmin } from "./useIsPlatformAdmin";

/**
 * Edit chip for blocks that sit loose inside a `.frontend-legal` article.
 * Visitors get the children only (no wrapper), so their markup is unchanged.
 */
export function EditableSlot({ id, children }: { id: string; children: ReactNode }) {
  const admin = useIsPlatformAdmin();
  if (!admin) return <>{children}</>;
  return (
    <div className="fe-has-edit fe-editable-slot" data-section={id}>
      <SectionEdit id={id} />
      {children}
    </div>
  );
}