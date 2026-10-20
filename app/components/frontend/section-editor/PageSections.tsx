"use client";

import dynamic from "next/dynamic";
import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LayoutList } from "lucide-react";
import {
  customSectionType,
  getSectionDef,
  hasSectionParts,
  isCustomSectionId,
  type CustomSectionType,
} from "@/lib/marketing-sections";
import { MARKETING_PAGES, slotLabel, type MarketingPageId } from "@/lib/marketing-layout";
import { CustomSection } from "./CustomSection";
import { SectionGate } from "./EditablePart";
import { usePageLayout } from "./MarketingCopy";
import { useIsPlatformAdmin } from "./useIsPlatformAdmin";

const PageLayoutEditor = dynamic(
  () => import("./PageLayoutEditor").then((mod) => mod.PageLayoutEditor),
  { ssr: false }
);

let openPage: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function openLayoutEditor(page: MarketingPageId) {
  openPage = page;
  emit();
}

export function closeLayoutEditor() {
  openPage = null;
  emit();
}

/**
 * Renders a page's sections in the saved order, skipping hidden ones and
 * inserting admin-added sections. With no saved layout the output is the
 * slots in code order with no extra markup. Admins also get a "Page layout"
 * button and a thin marker where a hidden section sits.
 */
export function PageSections({
  page,
  slots,
}: {
  page: MarketingPageId;
  slots: Record<string, ReactNode>;
}) {
  const layout = usePageLayout(page);
  const admin = useIsPlatformAdmin();
  const open = useSyncExternalStore(
    subscribe,
    () => openPage === page,
    () => false
  );
  // Custom sections can be choreographed as a pair (poster -> video screen).
  const shown = layout.sections.filter((entry) => !entry.hidden);
  const typeOf = (id?: string): CustomSectionType | null =>
    id && isCustomSectionId(id) ? customSectionType(id) : null;
  return (
    <>
      {layout.sections.map((entry) => {
        if (entry.hidden) {
          return admin ? <HiddenMarker key={entry.id} page={page} id={entry.id} /> : null;
        }
        if (isCustomSectionId(entry.id)) {
          const at = shown.indexOf(entry);
          return (
            <SectionGate key={entry.id} id={entry.id}>
              <CustomSection
                id={entry.id}
                nextType={typeOf(shown[at + 1]?.id)}
                prevType={typeOf(shown[at - 1]?.id)}
              />
            </SectionGate>
          );
        }
        const node = slots[entry.id] ?? null;
        // Split components switch their own parts off; everything else is gated here.
        if (getSectionDef(entry.id) && !hasSectionParts(entry.id)) {
          return (
            <SectionGate key={entry.id} id={entry.id}>
              {node}
            </SectionGate>
          );
        }
        return <Fragment key={entry.id}>{node}</Fragment>;
      })}
      {admin ? <LayoutButton page={page} /> : null}
      {admin && open ? <PageLayoutEditor page={page} onClose={closeLayoutEditor} /> : null}
    </>
  );
}

function HiddenMarker({ page, id }: { page: MarketingPageId; id: string }) {
  return (
    <div className="fe-hidden-marker" data-admin-chip>
      <span>
        Hidden from visitors: <strong>{isCustomSectionId(id) ? "Added section" : slotLabel(page, id)}</strong>
      </span>
      <button type="button" onClick={() => openLayoutEditor(page)}>
        Page layout
      </button>
    </div>
  );
}

function LayoutButton({ page }: { page: MarketingPageId }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <button
      type="button"
      data-admin-chip
      className="fe-layout-fab"
      onClick={() => openLayoutEditor(page)}
      aria-label={`Page layout: ${MARKETING_PAGES[page].label}`}
    >
      <LayoutList size={16} aria-hidden />
      Page layout
    </button>,
    document.body
  );
}