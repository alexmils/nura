import {
  ArticleSection,
  EmdrCloseSection,
  EmdrCompareSection,
  EmdrFaqSection,
} from "@/app/components/frontend/ArticleSections";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { EmdrKeepReading } from "@/app/components/frontend/EmdrKeepReading";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { EMDR_FAQ_ITEMS as EMDR_FAQ } from "@/lib/emdr-faq";
import { isSectionShown } from "@/lib/marketing-layout";
import { articleSlotIds, faqPairs, getSectionDef, isSectionOn, sectionList } from "@/lib/marketing-sections";
import { loadMarketingCopy, loadPageLayouts } from "@/lib/marketing-sections-db";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildEmdrJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("emdr");
}

const stripMarkup = (value: string) =>
  value.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1").replace(/\*\*([^*\n]+)\*\*/g, "$1");

/** Visible FAQ for JSON-LD. Unedited answers keep the canonical EMDR_FAQ strings. */
function emdrFaqJsonLd(config: Parameters<typeof faqPairs>[0]) {
  const defaults = sectionList(getSectionDef("emdr-faq")?.defaults, "items");
  return faqPairs(config).map((pair) => {
    const original = EMDR_FAQ.find((item) => item.q === pair.q);
    const untouched = defaults.some((item) => item.q === pair.q && item.a === pair.a);
    return { q: pair.q, a: original && untouched ? original.a : stripMarkup(pair.a) };
  });
}

export default async function EmdrPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);
  const [copy, layouts] = await Promise.all([loadMarketingCopy(), loadPageLayouts()]);
  const faq = isSectionShown(layouts.emdr, "emdr-faq") && isSectionOn(copy["emdr-faq"]) ? emdrFaqJsonLd(copy["emdr-faq"]) : [];

  return (
    <FrontendShell>
      <JsonLd data={buildEmdrJsonLd(origin, faq)} />
      <article className="frontend-legal frontend-legal--long">
        <PageSections
          page="emdr"
          slots={{
            ...Object.fromEntries(articleSlotIds("emdr-intro").map((id) => [id, <ArticleSection key={id} id={id} />])),
            "emdr-compare": <EmdrCompareSection />,
            ...Object.fromEntries(articleSlotIds("emdr-guide").map((id) => [id, <ArticleSection key={id} id={id} />])),
            "emdr-faq": <EmdrFaqSection />,
            "emdr-close": <EmdrCloseSection />,
            "emdr-more": <EmdrKeepReading />,
          }}
        />
      </article>
    </FrontendShell>
  );
}