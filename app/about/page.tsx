import { AboutView } from "@/app/components/frontend/AboutView";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildAboutJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("about");
}

export default async function AboutPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }

  return (
    <FrontendShell>
      <JsonLd data={buildAboutJsonLd(siteOrigin(publicUrl))} />
      <PageSections page="about" slots={{ "about-page": <AboutView /> }} />
    </FrontendShell>
  );
}
