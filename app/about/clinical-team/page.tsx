import { articleSlotIds } from "@/lib/marketing-sections";
import {
  ArticleSection,
  ClinicalAdvisorSection,
} from "@/app/components/frontend/ArticleSections";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { PageSections } from "@/app/components/frontend/section-editor/PageSections";
import {
  CLINICAL_ADVISOR,
  hasClinicalAdvisorConfigured,
} from "@/lib/legal-entity";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { buildClinicalReviewJsonLd } from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("clinical-team");
}

export default async function ClinicalTeamPage() {
  const advisor = hasClinicalAdvisorConfigured()
    ? {
        name: CLINICAL_ADVISOR.name ?? "",
        credentials: CLINICAL_ADVISOR.credentials,
        lastReviewedAt: CLINICAL_ADVISOR.lastReviewedAt,
      }
    : null;
  let publicUrl: string | undefined;
  try {
    publicUrl = await getPublicAppUrl();
  } catch {
    publicUrl = undefined;
  }
  const origin = siteOrigin(publicUrl);

  return (
    <FrontendShell>
      <JsonLd data={buildClinicalReviewJsonLd(origin)} />
      <article className="frontend-legal">
        <PageSections
          page="clinical"
          slots={{
            ...Object.fromEntries(articleSlotIds("clinical-intro").map((id) => [id, <ArticleSection key={id} id={id} />])),
            "clinical-advisor": <ClinicalAdvisorSection advisor={advisor} />,
            "clinical-outro": <ArticleSection id="clinical-outro" />,
          }}
        />
      </article>
    </FrontendShell>
  );
}