import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { PricingPageView } from "@/app/components/frontend/PricingPageView";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { faqPairs, isSectionOn } from "@/lib/marketing-sections";
import { isSectionShown } from "@/lib/marketing-layout";
import { loadMarketingCopy, loadPageLayouts } from "@/lib/marketing-sections-db";
import { buildPricingJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("pricing");
}

export default async function PricingPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);
  const [copy, layouts] = await Promise.all([loadMarketingCopy(), loadPageLayouts()]);
  const faq = isSectionShown(layouts.pricing, "pricing-faq") && isSectionOn(copy["pricing-faq"]) ? faqPairs(copy["pricing-faq"]) : [];

  return (
    <FrontendShell wide>
      <JsonLd data={buildPricingJsonLd(origin, faq)} />
      <PricingPageView />
    </FrontendShell>
  );
}
