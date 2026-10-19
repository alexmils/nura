import { PageCta } from "@/app/components/frontend/section-editor/PageCta";
import { articleSlotIds } from "@/lib/marketing-sections";
import { ArticleSection } from "@/app/components/frontend/ArticleSections";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildSafetyJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("safety");
}

export default async function SafetyPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);

  return (
    <FrontendShell>
      <JsonLd data={buildSafetyJsonLd(origin)} />
      <article className="frontend-legal frontend-legal--long">
        <PageSections page="safety" slots={{ "page-cta-safety": <PageCta page="safety" />, ...Object.fromEntries(articleSlotIds("safety-page").map((id) => [id, <ArticleSection key={id} id={id} />])) }} />
      </article>
    </FrontendShell>
  );
}