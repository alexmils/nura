import { ArticleSection } from "@/app/components/frontend/ArticleSections";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildLimitsJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("limits");
}

export default async function LimitsPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);

  return (
    <FrontendShell>
      <JsonLd data={buildLimitsJsonLd(origin)} />
      <article className="frontend-legal frontend-legal--long">
        <PageSections page="limits" slots={{ "limits-page": <ArticleSection id="limits-page" /> }} />
      </article>
    </FrontendShell>
  );
}