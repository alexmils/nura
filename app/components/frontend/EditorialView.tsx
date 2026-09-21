import Link from "next/link";
import { BRAND_LIMITS_LINE, BRAND_SPOKEN, BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import "./public-cluster.css";

export function EditorialView() {
  return (
    <article className="fe-cluster">
      <div className="fe-cluster-inner">
        <p className="fe-cluster-kicker">Editorial</p>
        <h1>How we write these guides</h1>
        <p className="fe-cluster-dek">
          Public pages on Nura are self-help explainers. They are not a
          clinician’s letterhead, and they are not signed by a licensed EMDR
          therapist.
        </p>

        <div className="fe-cluster-body">
          <section>
            <h2>What you are reading</h2>
            <p>
              The{" "}
              <Link href="/blog">guides</Link> describe how EMDR-style visual
              sets work in this app: a moving ball, AI agent-guided and Self-guided modes,
              grounding, and when to stop. They exist so search and a tired
              Tuesday night can meet the same honest sentences.
            </p>
            <p>
              They are written by the {BRAND_SPOKEN} product team. Dates on each
              article are when that page was last edited, not a medical review
              stamp.
            </p>
          </section>

          <section>
            <h2>What we will not put on the page</h2>
            <p>
              We will not invent a named clinical advisor to look like a
              directory of therapists. We do not currently publish a licensed
              EMDR clinician as author or reviewer of these guides. How clinical
              review works — and which external authorities we cite — is on{" "}
              <Link href="/about/clinical-team">Clinical review</Link>. If a
              named advisor is listed later, credentials will be checkable —
              not a stock bio.
            </p>
            <p>
              We also will not claim Nura treats PTSD, diagnoses anything, or
              replaces the person who can see your face.
            </p>
          </section>

          <section>
            <h2>How that shows up in a session</h2>
            <p>
              The differentiator is in the product, not in a white coat:{" "}
              <Link href="/emdr">
                visual sets with a moving ball in a Nura session
              </Link>
              . Chat that only talks about EMDR is not a set. This software
              still is not emergency care.
            </p>
          </section>

          <section>
            <h2>If you need a human</h2>
            <p>
              Use local emergency services if you are unsafe. For clinical EMDR,
              you need a trained person — not this site. Questions about the
              product: {BRAND_SUPPORT_EMAIL}.
            </p>
          </section>
        </div>

        <p className="fe-cluster-note">
          {BRAND_LIMITS_LINE}{" "}
          <Link href="/limits">Read the limits</Link>.
        </p>
      </div>
    </article>
  );
}
