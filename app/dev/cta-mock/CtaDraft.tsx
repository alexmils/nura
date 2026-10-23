"use client";

import { useLayoutEffect } from "react";
import { useMarketingCopyMap } from "@/app/components/frontend/section-editor/MarketingCopy";
import { clearSectionDraft, setSectionDraft } from "@/app/components/frontend/section-editor/section-draft";

/** Dev preview only: shows the closing CTA in `template` as an unsaved draft. */
export function CtaDraft({ template, dropBackground }: { template: string; dropBackground: boolean }) {
  const saved = useMarketingCopyMap()["home-close"];
  useLayoutEffect(() => {
    const next: Record<string, unknown> = { ...(saved ?? {}), template };
    if (dropBackground) {
      next.bgKind = "";
      next.bgImage = "";
      next.bgVideo = "";
    }
    setSectionDraft("home-close", next);
    return () => clearSectionDraft("home-close");
  }, [saved, template, dropBackground]);
  return null;
}
