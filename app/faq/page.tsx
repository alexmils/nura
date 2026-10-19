import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { FaqPageView } from "@/app/components/frontend/FaqPageView";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { faqPairs, isSectionOn } from "@/lib/marketing-sections";
import { isSectionShown } from "@/lib/marketing-layout";
import { loadMarketingCopy, loadPageLayouts } from "@/lib/marketing-sections-db";
import { buildPublicFaqJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("faq");
}

export default async function FaqPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);
  const [copy, layouts] = await Promise.all([loadMarketingCopy(), loadPageLayouts()]);
  const faq = isSectionShown(layouts.faq, "faq-page") && isSectionOn(copy["faq-questions"])
      ? faqPairs(copy["faq-questions"])
      : [];

  return (
    <FrontendShell>
      <JsonLd data={buildPublicFaqJsonLd(origin, faq)} />
      <PageSections page="faq" slots={{ "faq-page": <FaqPageView /> }} />
    </FrontendShell>
  );
}
