import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { LearnHub } from "@/app/components/frontend/LearnHub";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildLearnJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("learn");
}

export default async function LearnPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }

  return (
    <FrontendShell>
      <JsonLd data={buildLearnJsonLd(siteOrigin(publicUrl))} />
      <PageSections page="learn" slots={{ "learn-hub": <LearnHub /> }} />
    </FrontendShell>
  );
}
