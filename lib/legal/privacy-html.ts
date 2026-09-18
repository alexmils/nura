/**
 * Prepare Termly-exported Privacy HTML for /privacy (same chrome as /terms).
 * Injects a Nura product-details addendum (Art. 9, sessions, subprocessors, delete).
 */
import { DATA_HOSTING_REGION, LEGAL_DOC_VERSION } from "@/lib/legal-entity";
import { PRIVACY_BODY_HTML } from "@/lib/legal/privacy-body.generated";
import {
  demoteDocumentTitleH1,
  softSentenceCaseHeading,
  stripTermlyBranding,
  stripTermlyPresentation,
} from "@/lib/legal/terms-html";

export type PrivacyTocItem = { id: string; label: string };

/** Termly section anchors + Nura product addendum. */
export const PRIVACY_TOC: PrivacyTocItem[] = [
  { id: "nura-privacy", label: "Nura product details" },
  { id: "infocollect", label: "1. What information do we collect?" },
  { id: "infouse", label: "2. How do we process your information?" },
  { id: "legalbases", label: "3. What legal bases do we rely on?" },
  { id: "whoshare", label: "4. When and with whom we share" },
  { id: "cookies", label: "5. Cookies and tracking" },
  { id: "ai", label: "6. Artificial intelligence products" },
  { id: "sociallogins", label: "7. Social logins" },
  { id: "intltransfers", label: "8. International transfers" },
  { id: "inforetain", label: "9. How long we keep information" },
  { id: "infosafe", label: "10. How we keep information safe" },
  { id: "privacyrights", label: "11. Your privacy rights" },
  { id: "DNT", label: "12. Do-not-track features" },
  { id: "uslaws", label: "13. United States privacy rights" },
  { id: "policyupdates", label: "14. Updates to this notice" },
  { id: "contact", label: "15. How to contact us" },
  { id: "request", label: "16. Review, update, or delete your data" },
];

const HELP_CONTROL =
  '<button type="button" class="help-text-link legal-open-help" data-open-help>Need help</button>';

/**
 * Product-specific notice from the prior Privacy draft.
 * Countries only for hosting — never IPs or hosting-vendor names.
 */
const NURA_PRIVACY_ADDENDUM = `
<section id="nura-privacy" class="legal-addendum">
  <h2>Nura product details</h2>
  <p>
    The sections below describe how Nura (operated by Receptly LLC) handles
    account, session, and billing data in the product. They supplement the
    Privacy Notice on this page.
  </p>

  <h3 id="nura-special">Special category data (GDPR Art. 9)</h3>
  <p>
    Session transcripts, intake answers, risk notes, SUD/VoC ratings, and related
    mental-health content are special category data. We process that data only
    with your explicit consent under GDPR Article 9(2)(a) (and equivalent UK GDPR
    where applicable), collected before your first processing session and recorded
    with a timestamp and document version. You may withdraw consent by deleting
    your account or contacting us via ${HELP_CONTROL}; withdrawal does not affect
    prior lawful processing.
  </p>

  <h3 id="nura-collect">What we collect in the product</h3>
  <ul>
    <li><strong>Account data:</strong> email, name, password hash or OAuth identifiers</li>
    <li><strong>Session data:</strong> messages, protocol phase, targets, SUD/VoC, intake / client profile fields, risk flags and notes</li>
    <li><strong>Usage and billing metadata:</strong> Stripe customer / subscription ids</li>
    <li><strong>Technical logs:</strong> IP address (when a trusted proxy is configured), user agent, consent records, audit events</li>
    <li><strong>Marketing analytics cookies</strong> only after consent (see cookie banner and below)</li>
  </ul>

  <h3 id="nura-cookies">Cookies on marketing pages</h3>
  <p>
    On public marketing pages we use necessary cookies to remember your cookie
    choice. Marketing tags (Google Analytics 4, Google Tag Manager, Microsoft
    Clarity) may load in a limited mode so vendors can verify installation. Full
    cookies and cross-session tracking start only after you allow analytics or
    marketing cookies in the banner. You can change that choice anytime via
    Cookie settings in the site footer. Session cookies for signing in to the app
    are required for the product to work.
  </p>

  <h3 id="nura-storage">Where data is stored</h3>
  <p>${DATA_HOSTING_REGION}</p>

  <h3 id="nura-subprocessors">Subprocessors</h3>
  <p>We use providers to run the product, including:</p>
  <ul>
    <li>Application and database hosting in the European Union and the United States</li>
    <li>Cloudflare (DNS, CDN, Turnstile bot protection)</li>
    <li>Stripe (payments)</li>
    <li>Email delivery (Brevo; optional Gmail API fallback)</li>
    <li>LLM providers for AI agent-guided sessions and related AI features: OpenAI, Anthropic (Claude), and DeepSeek (as configured)</li>
    <li>Optional marketing tags (Consent Mode / limited until cookie accept): Google Analytics 4, Google Tag Manager, Microsoft Clarity</li>
  </ul>
  <p>
    We aim to keep Data Processing Agreements (DPAs) with each subprocessor.
    Status is tracked internally for launch readiness.
  </p>

  <h3 id="nura-llm">Large language models</h3>
  <p>
    When you use AI agent-guided chat or related AI features, relevant prompts and
    session context are sent to the configured model provider (OpenAI, Anthropic
    (Claude), and/or DeepSeek) so the product can respond. Our product intent is
    that customer content is not used to train foundation models. Where a provider
    offers zero-retention or “no training” contractual options, we prefer those
    settings. Confirm current provider terms via ${HELP_CONTROL}; do not assume
    every vendor default matches this intent until a DPA is on file.
  </p>

  <h3 id="nura-bases">Legal bases (product summary)</h3>
  <ul>
    <li><strong>Contract</strong> — account, sessions, billing</li>
    <li><strong>Consent</strong> — special category session content; non-essential cookies</li>
    <li><strong>Legitimate interests</strong> — security, fraud prevention, product integrity</li>
    <li><strong>Legal obligation</strong> — tax / accounting where required</li>
  </ul>

  <h3 id="nura-retention">Retention</h3>
  <p>
    Account and session data are kept while your account is active. Deleted
    accounts are removed or anonymized from primary stores within a reasonable
    period (target: 30 days), except backups and records we must keep for legal,
    billing, or dispute reasons. Consent and key audit events may be retained
    longer as proof of compliance.
  </p>

  <h3 id="update-or-delete">Update or delete your account</h3>
  <p>You can update or delete your account yourself in the app:</p>
  <ul>
    <li><strong>Update profile</strong> — Sign in → Settings → Profile. Change your display name or photo, then Save profile.</li>
    <li><strong>Delete account</strong> — Sign in → Settings → Profile → Danger zone → Delete account. Type your account email to confirm. This permanently removes your account, sessions, intake notes, and memory notes. If a Stripe subscription is on file, it must cancel successfully before deletion finishes.</li>
  </ul>
  <p>
    Prefer chat help instead? Open ${HELP_CONTROL} while signed in from the
    address on your account. We may ask you to verify ownership before erasure.
  </p>

  <h3 id="nura-rights">Your rights</h3>
  <p>
    Subject to applicable law (including GDPR), you may request access,
    correction, erasure (Art. 17), restriction, objection, and portability
    (Art. 20). Start with the in-app delete flow above, or use ${HELP_CONTROL}.
    You may also lodge a complaint with your local supervisory authority.
  </p>

  <h3 id="nura-transfers">International transfers</h3>
  <p>
    Some subprocessors may process data outside the EEA/UK. Where required, we
    rely on appropriate safeguards such as Standard Contractual Clauses (SCCs) or
    equivalent mechanisms.
  </p>

  <h3 id="nura-security">Security and breaches</h3>
  <p>
    We use access controls, encrypted transport (TLS), and database row-level
    security for user data tables where implemented. No method is perfectly
    secure. If a personal-data breach poses risk, we will notify the competent
    authority within 72 hours where GDPR requires it, and affected users when
    required.
  </p>

  <h3 id="nura-children">Children</h3>
  <p>
    The service is for adults 18+. We do not knowingly collect special category
    data from children.
  </p>

  <h3 id="nura-related">Related documents</h3>
  <p>
    See also <a href="/terms">Terms of service</a>. Product safety positioning
    remains wellness / self-help — not a medical device. See
    <a href="/limits">Limits</a> and <a href="/safety">Safety</a>.
  </p>

  <h3 id="nura-changes">Changes</h3>
  <p>
    We may update this policy and bump ${LEGAL_DOC_VERSION.privacy}. Material
    changes will be posted here; re-consent may be required for session use when
    the informed-consent version changes.
  </p>
</section>
`.trim();

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

/** Drop Termly's built-in TOC (we render a clean nav in React). */
function stripTermlyToc(html: string): string {
  return html.replace(
    /<h2[^>]*>\s*TABLE OF CONTENTS\s*<\/h2>[\s\S]*?(?=<div[^>]*id="infocollect"|<h2[^>]*>\s*1\.\s*WHAT INFORMATION)/i,
    "",
  );
}

function rewriteHeadingCase(html: string): string {
  return html.replace(
    /<(h[23])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_all, tag, attrs, inner) => {
      const plain = inner
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!plain || !/[A-Z]{3,}/.test(plain)) {
        return `<${tag}${attrs}>${inner}</${tag}>`;
      }
      return `<${tag}${attrs}>${softSentenceCaseHeading(plain)}</${tag}>`;
    },
  );
}

function rewriteSupportEmails(html: string): string {
  return html
    .replace(
      /email at\s*<a\b[^>]*href=["']mailto:[^"']+["'][^>]*>[\s\S]*?<\/a>/gi,
      HELP_CONTROL,
    )
    .replace(
      /<a\b[^>]*href=["']mailto:[^"']+["'][^>]*>[\s\S]*?<\/a>/gi,
      HELP_CONTROL,
    )
    .replace(/\bsupport@nurahelp\.com\b/gi, HELP_CONTROL);
}

/** Drop unfinished Termly blanks, editor markers, and browser scrape attrs. */
function scrubArtifacts(html: string): string {
  let out = html
    .replace(/\s*data-cursor-ref="[^"]*"/gi, "")
    // Termly editor markers — keep text, drop tags
    .replace(/<\/?bdt\b[^>]*>/gi, "");

  out = out
    .replace(/<li\b[^>]*>\s*(?:<[^>]+>\s*)*_{3,}(?:\s*<[^>]+>\s*)*(?:\.\s*)?(?:<[^>]+>\s*)*_{0,}(?:\s*<[^>]+>\s*)*<\/li>/gi, "")
    .replace(/\b_{5,}\b(?:\s*\.\s*_{5,})?/g, "");
  return out;
}

/** Country-level hosting only — never IPs, hostnames, or hosting-vendor names. */
function scrubPrivateInfra(html: string): string {
  return html
    .replace(
      /Our servers are located in(?:\s|<[^>]+>)*Germany(?:\s|<[^>]+>)*(?:and|,)?(?:\s|<[^>]+>)*United States/gi,
      "We process and store information in the European Union and the United States",
    )
    // Never ship infra details that may have leaked into a Termly field
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "")
    .replace(/\bCoolify\b/gi, "")
    .replace(/\bHetzner\b/gi, "")
    .replace(/\bserver\.nurahelp\.com\b/gi, "nurahelp.com")
    .replace(/\s{2,}/g, " ");
}

/** Ensure OpenAI, Anthropic (Claude), and DeepSeek are named as AI providers. */
function ensureAiProviders(html: string): string {
  if (/DeepSeek/i.test(html) && /Anthropic|Claude/i.test(html)) {
    return html;
  }
  // After bdt strip: `including OpenAI .`
  return html.replace(
    /including\s+OpenAI\s*\./i,
    "including OpenAI, Anthropic (Claude), and DeepSeek.",
  );
}

function lightSanitize(html: string): string {
  return html
    .replace(/https:\/\/(?:www\.)?nurahelp\.com\/privacy/gi, "/privacy")
    .replace(/https:\/\/(?:www\.)?nurahelp\.com\/support/gi, "/support")
    .replace(/https:\/\/(?:www\.)?nurahelp\.com(?=\/|"|'|\s|<|$)/gi, "https://nurahelp.com")
    .replace(/\s+align="center"/gi, "")
    .replace(
      /\s+target="_blank"/gi,
      ' target="_blank" rel="noopener noreferrer"',
    )
    .replace(/<a\s+name="[^"]*"><\/a>/gi, "");
}

function demotePrivacyTitle(html: string): string {
  // Drop Termly document title so React keeps a single page H1.
  let out = html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, (all) => {
    const plain = all
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return /^privacy (policy|notice)$/i.test(plain) ? "" : all;
  });
  return demoteDocumentTitleH1(out);
}

/** Inject product addendum before Termly §1 (or append if marker missing). */
function injectNuraPrivacyAddendum(html: string): string {
  if (/id="nura-privacy"/i.test(html)) return html;
  const marker = /(<div[^>]*id="infocollect")/i;
  if (marker.test(html)) {
    return html.replace(marker, `${NURA_PRIVACY_ADDENDUM}\n$1`);
  }
  return `${NURA_PRIVACY_ADDENDUM}\n${html}`;
}

/** Pure transform used by generate script and tests. */
export function preparePrivacyHtml(rawHtml: string): string {
  let body = extractBody(rawHtml);
  body = scrubArtifacts(body);
  body = stripTermlyToc(body);
  body = demotePrivacyTitle(body);
  body = ensureAiProviders(body);
  body = stripTermlyPresentation(body);
  body = scrubPrivateInfra(body);
  body = rewriteHeadingCase(body);
  body = rewriteSupportEmails(body);
  body = injectNuraPrivacyAddendum(body);
  body = stripTermlyBranding(body);
  return lightSanitize(body);
}

/** Runtime: bundled prepared HTML (regenerate after Termly export changes). */
export function loadPreparedPrivacyHtml(): string {
  return PRIVACY_BODY_HTML;
}
