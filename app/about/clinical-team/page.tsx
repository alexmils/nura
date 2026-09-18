import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { JsonLd } from "@/app/components/frontend/JsonLd";
import { BRAND_SPOKEN } from "@/lib/brand";
import { CLINICAL_AUTHORITIES } from "@/lib/clinical-authorities";
import {
  CLINICAL_ADVISOR,
  hasClinicalAdvisorConfigured,
} from "@/lib/legal-entity";
import { getPublicAppUrl } from "@/lib/platform-settings";
import {
  buildClinicalReviewJsonLd,
  CLINICAL_REVIEW_JSON_LD,
} from "@/lib/seo-jsonld";
import { buildCachedPageMetadata } from "@/lib/site-seo-cache";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildCachedPageMetadata("clinical-team");
}

export default async function ClinicalTeamPage() {
  const configured = hasClinicalAdvisorConfigured();
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
        <h1>{CLINICAL_REVIEW_JSON_LD.name}</h1>
        <p>
          {BRAND_SPOKEN} is self-help software. This page explains how we check
          intake screening, safety copy, and protocol barriers — and which
          external authorities we cite. It is not a claim that the app is
          therapy or a medical device.
        </p>

        <h2>What we review</h2>
        <ul>
          <li>Intake screening and red-flag barriers before sets can run</li>
          <li>Safety copy, crisis language, and consent gate wording</li>
          <li>When Self-guided and AI agent-guided sets stay off</li>
        </ul>

        <h2>Authorities we cite</h2>
        <p>
          Until a named clinician reviews these materials, we align product
          barriers and public safety copy against published guidance — not
          against an invented byline.
        </p>
        <ul>
          {CLINICAL_AUTHORITIES.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.label}
              </a>
              {" — "}
              {a.name}
            </li>
          ))}
        </ul>

        <h2>Named clinical advisor</h2>
        {configured ? (
          <>
            <p>
              <strong>{CLINICAL_ADVISOR.name}</strong>
              {CLINICAL_ADVISOR.credentials
                ? ` — ${CLINICAL_ADVISOR.credentials}`
                : null}
            </p>
            {CLINICAL_ADVISOR.lastReviewedAt ? (
              <p>
                Last review of intake and safety materials:{" "}
                {CLINICAL_ADVISOR.lastReviewedAt}
              </p>
            ) : null}
          </>
        ) : (
          <p>
            We do not list a named clinician as author or reviewer until someone
            has agreed to be named and has reviewed the materials. We will not
            invent credentials to look trustworthy.
          </p>
        )}

        <p>
          Public guides remain product-team explainers — see{" "}
          <Link href="/editorial">How we write</Link>. Related:{" "}
          <Link href="/about">About</Link>, <Link href="/safety">Safety</Link>,{" "}
          <Link href="/terms">Terms</Link>.
        </p>
      </article>
    </FrontendShell>
  );
}
