import Link from "next/link";
import { appPath, LOGIN_PATH } from "@/lib/app-base";
import {
  BRAND_LIMITS_LINE,
  BRAND_SPOKEN,
  BRAND_SUPPORT_EMAIL,
  BRAND_TAGLINE,
} from "@/lib/brand";
import { legalEntityDisplayName } from "@/lib/legal-entity";
import "./public-cluster.css";

/**
 * About hub — E-E-A-T surface. Honest operator + product facts; no fake
 * clinician byline. Copy follows redpen: one job per section, no BLS jargon.
 */
export function AboutView() {
  const operator = legalEntityDisplayName();

  return (
    <article className="fe-cluster">
      <div className="fe-cluster-inner">
        <p className="fe-cluster-kicker">About</p>
        <h1>About the EMDR therapy online app</h1>
        <p className="fe-cluster-dek">{BRAND_TAGLINE}</p>

        <div className="fe-cluster-body">
          <section>
            <h2>What Nura is</h2>
            <p>
              {BRAND_SPOKEN} is a calm web app for AI-guided EMDR practice:
              AI agent-guided sessions with optional voice, or self-guided visual sets you
              run yourself — no agent, no chat. It is software for practice
              between sessions, not a clinic, not an EHR, and not emergency care.
            </p>
            <p>{BRAND_LIMITS_LINE}</p>
          </section>

          <section>
            <h2>Who operates it</h2>
            <p>
              {BRAND_SPOKEN} is operated by {operator}. The spoken brand is{" "}
              {BRAND_SPOKEN}; the domain is nurahelp.com. Legal pages name the
              operator — Terms and Privacy — so you can see who is responsible
              for the product and for how data is handled.
            </p>
          </section>

          <section>
            <h2>How sessions work</h2>
            <p>
              In an AI agent-guided session, a session agent walks phases and can
              invite a visual set when it is time. Self-guided is sets on your terms:
              you choose speed, animation, sound, and repeats from session
              controls. Both modes stay inside the same calm workspace.
            </p>
            <p>
              A plain-language product overview is on{" "}
              <Link href="/emdr">AI-guided EMDR</Link>. Plans and the trial are
              on <Link href="/pricing">Prices</Link>.
            </p>
          </section>

          <section>
            <h2>What we publish</h2>
            <p>
              Public guides live in two places with different jobs:{" "}
              <Link href="/learn">Learn</Link> is a curated reading path
              (understand, practice, safety). <Link href="/blog">Blog</Link> is
              the chronological archive — newest first. How those pages are
              written is on <Link href="/editorial">How we write</Link>.
            </p>
          </section>

          <section>
            <h2>Clinical review and safety</h2>
            <p>
              We do not invent a named clinician to pad trust. How intake and
              safety copy are checked — and which external authorities we cite
              (EMDRIA, APA, NICE, WHO, PubMed) — is on{" "}
              <Link href="/about/clinical-team">Clinical review</Link>. When to
              pause or get help is on <Link href="/safety">Safety</Link>. What
              the product will not claim is on <Link href="/limits">Limits</Link>
              .
            </p>
          </section>

          <section>
            <h2>How to reach us</h2>
            <p>
              Product questions go to <Link href="/support">Support</Link> (
              {BRAND_SUPPORT_EMAIL}). Common answers are on{" "}
              <Link href="/faq">FAQ</Link>. If you are in crisis, use local
              emergency services or 988 in the US — Nura is not crisis care.
            </p>
          </section>
        </div>

        <div className="fe-cluster-actions frontend-hero-actions">
          <Link href={appPath("/create-account")} className="frontend-btn-primary">
            Get started
          </Link>
          <Link href="/learn" className="frontend-btn-ghost">
            Learn
          </Link>
          <Link href={LOGIN_PATH} className="frontend-btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </article>
  );
}
