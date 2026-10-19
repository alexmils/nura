import { PageCta } from "@/app/components/frontend/section-editor/PageCta";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { SupportPageView } from "@/app/components/frontend/SupportPageView";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildSupportJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("support");
}

export default async function SupportPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);

  return (
    <FrontendShell>
      <JsonLd data={buildSupportJsonLd(origin)} />
      <PageSections page="support" slots={{ "page-cta-support": <PageCta page="support" />, "support-page": <SupportPageView /> }} />
    </FrontendShell>
  );
}
