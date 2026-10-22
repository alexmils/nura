"use client";

import { pageCtaId } from "@/lib/marketing-sections";
import { CustomSection } from "./CustomSection";

/** The page's own call to action (same look as an added "Call to action" section). */
export function PageCta({ page }: { page: string }) {
  return <CustomSection id={pageCtaId(page)} type="cta" />;
}
