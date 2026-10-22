"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  defaultMarketingCopy,
  isSectionOn,
  normalizeSection,
  type SectionConfig,
} from "@/lib/marketing-sections";
import {
  defaultLayout,
  layoutDraftId,
  normalizeLayout,
  type MarketingPageId,
  type PageLayout,
} from "@/lib/marketing-layout";
import { useDraftOr } from "./section-draft";

const FALLBACK = defaultMarketingCopy();

type Layouts = Partial<Record<MarketingPageId, PageLayout>>;

const MarketingCopyContext = createContext<Record<string, SectionConfig>>(FALLBACK);
const LayoutContext = createContext<Layouts>({});

export function MarketingCopyProvider({
  sections,
  layouts = {},
  children,
}: {
  sections: Record<string, SectionConfig>;
  layouts?: Layouts;
  children: ReactNode;
}) {
  return (
    <MarketingCopyContext.Provider value={sections}>
      <LayoutContext.Provider value={layouts}>{children}</LayoutContext.Provider>
    </MarketingCopyContext.Provider>
  );
}

export function useSectionConfig(id: string): SectionConfig {
  const map = useContext(MarketingCopyContext);
  const saved = map[id] ?? FALLBACK[id] ?? {};
  return normalizeSection(id, useDraftOr(id, saved));
}

/** False when the section's own "Show this section" switch is off (live while editing). */
export function useSectionOn(id: string): boolean {
  return isSectionOn(useSectionConfig(id));
}

/** Saved copy for every section (no drafts). */
export function useMarketingCopyMap(): Record<string, SectionConfig> {
  return useContext(MarketingCopyContext);
}

/** Saved layout for a page, or the live draft while the layout editor is open. */
export function usePageLayout(page: MarketingPageId): PageLayout {
  const layouts = useContext(LayoutContext);
  const saved = layouts[page] ?? defaultLayout(page);
  const value = useDraftOr<PageLayout>(layoutDraftId(page), saved);
  return value === saved ? saved : normalizeLayout(page, value);
}

export function useSavedPageLayout(page: MarketingPageId): PageLayout {
  const layouts = useContext(LayoutContext);
  return layouts[page] ?? defaultLayout(page);
}