import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { PricingPageView } from "@/app/components/frontend/PricingPageView";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { faqPairs } from "@/lib/marketing-sections";
import { loadMarketingCopy } from "@/lib/marketing-sections-db";
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
  const copy = await loadMarketingCopy();

  return (
    <FrontendShell wide>
      <JsonLd data={buildPricingJsonLd(origin, faqPairs(copy["pricing-faq"]))} />
      <PricingPageView />
    </FrontendShell>
  );
}
