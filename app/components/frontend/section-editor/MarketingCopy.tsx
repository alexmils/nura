"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  defaultMarketingCopy,
  normalizeSection,
  type SectionConfig,
} from "@/lib/marketing-sections";
import { useDraftOr } from "./section-draft";

const FALLBACK = defaultMarketingCopy();

const MarketingCopyContext = createContext<Record<string, SectionConfig>>(FALLBACK);

export function MarketingCopyProvider({
  sections,
  children,
}: {
  sections: Record<string, SectionConfig>;
  children: ReactNode;
}) {
  return (
    <MarketingCopyContext.Provider value={sections}>
      {children}
    </MarketingCopyContext.Provider>
  );
}

export function useSectionConfig(id: string): SectionConfig {
  const map = useContext(MarketingCopyContext);
  const saved = map[id] ?? FALLBACK[id] ?? {};
  return normalizeSection(id, useDraftOr(id, saved));
}
