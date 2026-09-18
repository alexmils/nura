/**
 * Prepare Termly-exported Terms HTML for /terms:
 * - strip chrome / empty TOC duplicates we replace in React
 * - inject Nura product-safety addendum after §1 Our Services
 * - normalize privacy link (blank notice days fixed at export)
 */
import { TERMS_BODY_HTML } from "@/lib/legal/terms-body.generated";

export type TermsTocItem = { id: string; label: string };

/** Termly section anchors + Nura addendum. */
export const TERMS_TOC: TermsTocItem[] = [
  { id: "agreement", label: "Agreement to our legal terms" },
  { id: "services", label: "1. Our services" },
  { id: "nura-product", label: "1A. Nura product notice" },
  { id: "ip", label: "2. Intellectual property rights" },
  { id: "userreps", label: "3. User representations" },
  { id: "userreg", label: "4. User registration" },
  { id: "purchases", label: "5. Purchases and payment" },
  { id: "subscriptions", label: "6. Subscriptions" },
  { id: "prohibited", label: "7. Prohibited activities" },
  { id: "ugc", label: "8. User generated contributions" },
  { id: "license", label: "9. Contribution license" },
  { id: "reviews", label: "10. Guidelines for reviews" },
  { id: "socialmedia", label: "11. Social media" },
  { id: "thirdparty", label: "12. Third-party websites and content" },
  { id: "advertisers", label: "13. Advertisers" },
  { id: "sitemanage", label: "14. Services management" },
  { id: "ppyes", label: "15. Privacy policy" },
  { id: "copyrightyes", label: "16. Copyright infringements" },
  { id: "terms", label: "17. Term and termination" },
  { id: "modifications", label: "18. Modifications and interruptions" },
  { id: "law", label: "19. Governing law" },
  { id: "disputes", label: "20. Dispute resolution" },
  { id: "corrections", label: "21. Corrections" },
  { id: "disclaimer", label: "22. Disclaimer" },
  { id: "liability", label: "23. Limitations of liability" },
  { id: "indemnification", label: "24. Indemnification" },
  { id: "userdata", label: "25. User data" },
  { id: "electronic", label: "26. Electronic communications" },
  { id: "california", label: "27. California users and residents" },
  { id: "misc", label: "28. Miscellaneous" },
  { id: "contact", label: "29. Contact us" },
];

const NURA_ADDENDUM = `
<section id="nura-product" class="legal-addendum">
  <h2>1A. Nura product notice (self-help software)</h2>
  <p>
    The Services include the Nura web application at nurahelp.com (EMDR Support
    sessions). Nura is self-help software operated by Receptly LLC. It is not a
    licensed therapist, psychiatrist, psychologist, or other clinician. It does
    not diagnose, treat, or cure disease. It is not a medical device and is not
    emergency care. Do not use it as a substitute for professional clinical
    judgment or in-person care.
  </p>
  <h3 id="nura-risk">Assumption of risk</h3>
  <p>
    Working with difficult memories can bring up intense emotions, flooding, or
    intrusive material. You choose to use the product at your own risk. You are
    responsible for deciding whether self-guided or AI agent-guided sets are
    appropriate for you, and for stopping if you feel unsafe.
  </p>
  <h3 id="nura-emergency">No emergency duty</h3>
  <p>
    Nura does not monitor you in real time and has no duty to provide crisis
    intervention. If you might hurt yourself or someone else, contact emergency
    services or a crisis line immediately — in the US, call or text
    <strong>988</strong>. See our
    <a href="/learn">Learn</a> page for additional links.
  </p>
  <h3 id="nura-ai">AI agent-guided features</h3>
  <p>
    AI agent-guided sessions and help chat use automated systems. Outputs can be
    incomplete or wrong. The session agent is not a human clinician and must not
    be treated as one.
  </p>
  <h3 id="nura-account">Accounts and deletion</h3>
  <p>
    You may stop using the Services at any time. To update or permanently delete
    your account in the app, see
    <a href="/privacy#update-or-delete">Privacy — Update or delete your account</a>.
    Some retention rules for backups and legal records are described there.
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
    /<h2[^>]*>\s*TABLE OF CONTENTS\s*<\/h2>[\s\S]*?(?=<div[^>]*id="services")/i,
    "",
  );
}

/**
 * Page already has one React `<h1>`. Termly's document title must not be a
 * second H1 — demote to a plain label (or strip if it only repeats the title).
 */
export function demoteDocumentTitleH1(html: string): string {
  return html.replace(/<h1(\b[^>]*)>([\s\S]*?)<\/h1>/gi, (_all, attrs, inner) => {
    const plain = String(inner)
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/^terms of service$/i.test(plain)) {
      return "";
    }
    const label = softSentenceCaseHeading(plain);
    return `<div class="frontend-legal-doc-label"${attrs}>${label}</div>`;
  });
}

function injectNuraAddendum(html: string): string {
  const marker =
    /(<div[^>]*id="services"[\s\S]*?<\/div>[\s\S]*?)(?=<div[^>]*align="center"[^>]*>\s*<strong>\s*<span>\s*<h2>\s*2\.\s*INTELLECTUAL|<h2>\s*2\.\s*INTELLECTUAL)/i;
  if (marker.test(html)) {
    return html.replace(marker, `$1\n${NURA_ADDENDUM}\n`);
  }
  const ipIdx = html.search(/id="ip"|2\.\s*INTELLECTUAL PROPERTY/i);
  if (ipIdx > 0) {
    return `${html.slice(0, ipIdx)}${NURA_ADDENDUM}\n${html.slice(ipIdx)}`;
  }
  return `${html}\n${NURA_ADDENDUM}`;
}

const HELP_CONTROL =
  '<button type="button" class="help-text-link legal-open-help" data-open-help>Need help</button>';

/** Soft sentence case for ALL-CAPS Termly headings (keeps "1." / "1A." prefixes). */
export function softSentenceCaseHeading(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const m = cleaned.match(/^(\d+[A-Za-z]?\.\s*)?(.*)$/);
  if (!m) return cleaned;
  const prefix = m[1] || "";
  const rest = (m[2] || "").toLowerCase();
  if (!rest) return prefix.trim();
  return `${prefix}${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

function rewriteHeadingCase(html: string): string {
  return html.replace(/<(h[23])(\b[^>]*)>([\s\S]*?)<\/\1>/gi, (_all, tag, attrs, inner) => {
    const plain = inner
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain || !/[A-Z]{3,}/.test(plain)) {
      return `<${tag}${attrs}>${inner}</${tag}>`;
    }
    return `<${tag}${attrs}>${softSentenceCaseHeading(plain)}</${tag}>`;
  });
}

/**
 * Strip Termly Word/HTML chrome so CSS owns color, weight, and size.
 * Without this, half the body stays gray 11pt Arial and some blocks look bold.
 */
export function stripTermlyPresentation(html: string): string {
  let out = html
    .replace(/\sstyle=("([^"]*)"|'([^']*)')/gi, "")
    .replace(/\sclass="MsoNormal"/gi, "")
    .replace(/\sdata-custom-class="[^"]*"/gi, "")
    .replace(/&nbsp;/gi, " ");

  // Unwrap decorative wrappers around headings
  for (let i = 0; i < 4; i++) {
    out = out
      .replace(/<strong>\s*(<(h[23])\b[^>]*>[\s\S]*?<\/\2>)\s*<\/strong>/gi, "$1")
      .replace(/<(h[23])(\b[^>]*)>\s*<strong>([\s\S]*?)<\/strong>\s*<\/\1>/gi, "<$1$2>$3</$1>")
      .replace(/<span(\s[^>]*)?>\s*(<(h[23])\b[^>]*>[\s\S]*?<\/\3>)\s*<\/span>/gi, "$2");
  }

  // Unwrap empty attribute-less spans (former style carriers)
  for (let i = 0; i < 6; i++) {
    const next = out.replace(/<span>([\s\S]*?)<\/span>/gi, "$1");
    if (next === out) break;
    out = next;
  }

  // Drop empty leftover divs / lone breaks between blocks
  out = out
    .replace(/<div>\s*<\/div>/gi, "")
    .replace(/(?:<div>\s*<br\s*\/?>\s*<\/div>\s*){2,}/gi, "<br>")
    .replace(/\s{2,}/g, " ");

  return out;
}

/**
 * Never show Termly branding, generator footers, or termly.io links on public pages.
 */
export function stripTermlyBranding(html: string): string {
  return (
    html
      // Generator attribution footer (tight: only the attribution block)
      .replace(
        /<(div|p)\b[^>]*>\s*(?:<span\b[^>]*>\s*)?This (?:Privacy Policy|Privacy Notice|Terms of Service) was created using[\s\S]{0,500}?(?:Privacy Policy|Terms of Service)\s*Generator(?:\s*<\/a>)?\s*(?:<\/span>\s*)?<\/\1>/gi,
        "",
      )
      .replace(
        /This (?:Privacy Policy|Privacy Notice|Terms of Service) was created using[\s\S]{0,500}?(?:Privacy Policy|Terms of Service)\s*Generator(?:\s*<\/a>)?/gi,
        "",
      )
      // Hidden DSAR / tracking anchors hosted on Termly
      .replace(
        /<div\b[^>]*>\s*<a\b[^>]*href=["'][^"']*termly\.io[^"']*["'][^>]*>[\s\S]*?<\/a>\s*<\/div>/gi,
        "",
      )
      .replace(/<a\b[^>]*href=["'][^"']*termly\.io[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "")
      // Any leftover public "Termly" word
      .replace(/\bTermly(?:'s)?\b/gi, "")
      .replace(/\s{2,}/g, " ")
  );
}

/** Hide public support emails — open Need help instead (phone/mail stay). */
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

function lightSanitize(html: string): string {
  return html
    .replace(/https:\/\/nurahelp\.com\/privacy/gi, "/privacy")
    .replace(/\s+align="center"/gi, "")
    .replace(
      /\s+target="_blank"/gi,
      ' target="_blank" rel="noopener noreferrer"',
    )
    .replace(/<a\s+name="[^"]*"><\/a>/gi, "");
}

/** Pure transform used by generate script and tests. */
export function prepareTermsHtml(rawHtml: string): string {
  let body = extractBody(rawHtml);
  body = stripTermlyToc(body);
  body = demoteDocumentTitleH1(body);
  body = injectNuraAddendum(body);
  body = stripTermlyPresentation(body);
  body = stripTermlyBranding(body);
  body = rewriteHeadingCase(body);
  body = rewriteSupportEmails(body);
  return lightSanitize(body);
}

/** Runtime: bundled prepared HTML (regenerate after Termly export changes). */
export function loadPreparedTermsHtml(): string {
  return TERMS_BODY_HTML;
}
