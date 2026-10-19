import { EditorialView } from "@/app/components/frontend/EditorialView";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600; // PUBLIC_PAGE_REVALIDATE_SECONDS

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("editorial");
}

export default async function EditorialPage() {
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(origin),
      breadcrumbJsonLd(origin, [
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
        { name: "How we write", path: "/editorial" },
      ]),
    ],
  };

  return (
    <FrontendShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(graph) }}
      />
      <PageSections page="editorial" slots={{ "editorial-page": <EditorialView /> }} />
    </FrontendShell>
  );
}
