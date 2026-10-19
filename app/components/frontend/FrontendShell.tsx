import type { ReactNode } from "react";
import { FrontendShellClient } from "@/app/components/frontend/FrontendShellClient";
import { MarketingCopyProvider } from "@/app/components/frontend/section-editor/MarketingCopy";
import { MarketingExtras } from "@/app/components/frontend/MarketingExtras";
import { loadMarketingCopy, loadPageLayouts } from "@/lib/marketing-sections-db";

export async function FrontendShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Full-width main (home landing). */
  wide?: boolean;
  /** @deprecated chrome uses the brand lockup; kept for call-site compatibility */
  siteName?: string;
}) {
  const [sections, layouts] = await Promise.all([loadMarketingCopy(), loadPageLayouts()]);
  return (
    <MarketingCopyProvider sections={sections} layouts={layouts}>
      <FrontendShellClient wide={wide} marketingExtras={<MarketingExtras />}>
        {children}
      </FrontendShellClient>
    </MarketingCopyProvider>
  );
}

export { FrontendFooter } from "@/app/components/frontend/FrontendFooter";
