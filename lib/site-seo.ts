import type { Metadata } from "next";
import {
  BRAND_DESCRIPTION,
  BRAND_DOMAIN,
  BRAND_LEGAL,
  BRAND_SPOKEN,
  BRAND_TITLE_STEM,
  brandMetadataBase,
  stripBrandTitleSuffix,
} from "@/lib/brand";
import {
  isValidClarityId,
  isValidGa4Id,
  isValidGtmId,
  maskPublicId,
  type PlatformSeoConfig,
  type SeoPageId,
  SEO_PAGE_IDS,
  DEFAULT_PLATFORM_SEO,
} from "@/lib/seo-config";
import {
  maskIpForDisplay,
  parseAnalyticsIgnoreIps,
} from "@/lib/analytics-ignore";
import { getPlatformSettings, getPublicAppUrl } from "@/lib/platform-settings";
import { localeAlternates } from "@/lib/seo-jsonld";
import { absoluteOgImageUrl } from "@/lib/seo-og-image";
import type {
  MarketingSeoStatus,
  PublicMarketingTags,
  SeoConnection,
  SiteSeoPage,
} from "@/lib/site-seo-types";

export type {
  ConnectionStatus,
  MarketingSeoStatus,
  PublicMarketingTags,
  SeoConnection,
  SiteSeoPage,
} from "@/lib/site-seo-types";
export { absoluteOgImageUrl, displayOgImageUrl } from "@/lib/seo-og-image";

type PageDefault = {
  id: SeoPageId;
  path: string;
  label: string;
  title: string;
  description: string;
};

/**
 * Admin → SEO once saved the then-current defaults into `app_settings.seo.pages`.
 * Treat those stems as empty so copy updates ship without a manual clear.
 * Custom titles/descriptions that are not in this set stay.
 */
export const RETIRED_SEO_TITLES = new Set([
  "About",
  "EMDR Support",
  "EMDR therapy online in the app",
  "Resources",
  "Terms",
  "Nura — guided EMDR, therapy resources, and support",
  "guided EMDR, therapy resources, and support",
  "Guided EMDR therapy online app",
  "Clinical review for Nura",
  "How clinical review works at Nura",
  // Production Admin SEO overrides that double-branded with the layout template
  "AI Guided EMDR Therapy Online — Bilateral Stimulation App",
  "AI Guided EMDR Therapy Online — Bilateral Stimulation App | Nura",
  "Ai Guided EMDR Therapy Online — Bilateral Stimulation App | Nura",
  "Ai Guided EMDR Therapy Online — Bilateral Stimulation App",
  "AI EMDR Therapy App — Guided Bilateral Stimulation",
  "AI EMDR Therapy App — Guided Bilateral Stimulation | Nura",
  "AI-guided EMDR therapy online — bilateral stimulation app",
  "AI-guided EMDR therapy — bilateral stimulation",
  "Using AI-guided EMDR safely — when to stop and get help",
  // Round 2 — duplicate home/emdr stem + jab titles
  "AI-guided EMDR therapy online",
  "What this app does not do",
  "EMDR therapy — where to start",
  "Knowledge — short clips about sessions and safety",
  "EMDR therapy blog — guides and visual sets",
  "Plans for AI-guided EMDR",
  "FAQ — sessions, Free sets, and the trial",
  "Support — how to get help",
  "Support — Contact the Nura Team",
]);

export const RETIRED_SEO_DESCRIPTIONS = new Set([
  "A calm place for guided EMDR sessions, therapy resources, and support. Self-help — not a licensed therapist.",
  "What EMDR is, how visual sets work, and how a Nura session is structured.",
  "What guided EMDR therapy looks like in the Nura app: intake, grounding, visual sets, and check-ins. Online, on your schedule — not a licensed therapist.",
  "Guides for EMDR and therapy support on Nura.",
  "Privacy policy for Nura",
  "Privacy policy for NuraHelp",
  "Terms of service for Nura",
  "Terms of service for NuraHelp",
  // F8 — internal placeholder that shipped in production meta
  "How clinical review works for Nura’s self-help EMDR Support app — named advisor listed when configured.",
  "How clinical review works for Nura's self-help EMDR Support app — named advisor listed when configured.",
  // F3 — disclaimer burned into snippets (keep on /limits page body, not meta)
  "Guided EMDR therapy in a calm online app — visual sets, optional voice, and resources. Self-help, not a licensed therapist.",
  "Guided EMDR sessions with AI support: visual, audio, and tactile bilateral stimulation, on your schedule. Self-help — not a licensed therapist.",
  "Articles on EMDR therapy, visual sets, and practice between sessions. Newest first — self-help, not a licensed therapist.",
  "Nura is an online app for guided EMDR therapy between sessions. Self-help software — not a licensed therapist or emergency care.",
  "Nura public guides are self-help explainers about visual sets and practice. Not signed by a licensed EMDR clinician.",
  "Terms for using Nura, the online EMDR therapy app operated by Receptly LLC. Self-help software — not a substitute for professional clinical care.",
  "How to use Nura’s AI-guided EMDR safely: when to stop a session, when to see a clinician, and crisis lines if you are not safe. Not emergency care.",
  "How Nura checks intake and safety copy for its self-help EMDR Support app — citing EMDRIA, APA, NICE, WHO, and PubMed. Not a named clinician letterhead.",
  // Round 2 — short / disclaimer meta
  "Guided EMDR therapy in a calm online app — visual sets, optional voice, and resources for practice between sessions.",
  "Guided EMDR sessions with AI support: visual sets, optional voice, and practice on your schedule.",
  "Weekly, monthly, and yearly plans for AI-guided EMDR — start with a 7-day trial.",
  "Answers about Nura sessions, Free sets, the trial, privacy, and when to get help.",
  "Reach Nura by in-app Need help chat or email — plus safety and crisis links.",
  "What Nura does not do: no diagnosis, no treatment, no clinical judgment, no crisis care — and where to go instead.",
  "Curated EMDR reading paths: understand, practice, and safety. Short guides in order — not the full archive.",
]);

/** Bump when default title/description copy changes so `unstable_cache` cannot keep the last resolve. */
export const SEO_COPY_REVISION = "p0-seo-round3-titles-1";

export function documentTitle(pageTitle: string): string {
  const suffix = ` — ${BRAND_SPOKEN}`;
  const t = stripBrandTitleSuffix(pageTitle);
  if (!t) return `${BRAND_TITLE_STEM}${suffix}`;
  if (t === BRAND_SPOKEN || t.endsWith(suffix)) return t;
  return `${t}${suffix}`;
}

function effectiveSeoText(
  raw: string | undefined,
  fallback: string,
  retired: ReadonlySet<string>,
  extraReject?: ReadonlySet<string>
): string {
  const t = (raw || "").trim();
  if (!t || retired.has(t) || extraReject?.has(t)) return fallback;
  return t;
}

export const SITE_SEO_DEFAULTS: PageDefault[] = [
  {
    id: "home",
    path: "/",
    label: "Home",
    title: BRAND_TITLE_STEM,
    description: BRAND_DESCRIPTION,
  },
  {
    id: "about",
    path: "/about",
    label: "About",
    title: "About the EMDR therapy online app",
    description:
      "Nura is an online app for guided EMDR therapy between sessions — AI agent-guided practice and self-guided visual sets on your schedule.",
  },
  {
    id: "clinical-team",
    path: "/about/clinical-team",
    label: "Clinical review",
    title: "How clinical review works",
    description:
      "How Nura checks intake and safety copy — citing EMDRIA, APA, NICE, WHO, and PubMed guidance.",
  },
  {
    id: "editorial",
    path: "/editorial",
    label: "Editorial",
    title: "How we write these guides",
    description:
      "How Nura writes public EMDR guides: product-team explainers about visual sets, practice, and safety.",
  },
  {
    id: "emdr",
    path: "/emdr",
    label: "EMDR",
    title: "AI EMDR App — Guided Bilateral Stimulation Online",
    description:
      "Guided EMDR sessions with AI support: visual, audio, and tactile bilateral stimulation, on your schedule. See how a session runs, phase by phase.",
  },
  {
    id: "learn",
    path: "/learn",
    label: "Learn",
    title: "Learn EMDR — Guides by Topic, Safety & Practice",
    description:
      "Start here: short EMDR guides on how it works, visual sets you run yourself, and staying safe between sessions. Each one reads in a single sitting.",
  },
  {
    id: "knowledge",
    path: "/knowledge",
    label: "Knowledge",
    title: "EMDR Video Clips — Sessions & Safety",
    description:
      "Short clips answering the questions people ask before a session: how AI agent-guided works, what Self-guided does, the trial, and when to stop.",
  },
  {
    id: "blog",
    path: "/blog",
    label: "Blog",
    title: "EMDR Articles — Guides, Visual Sets & Safety",
    description:
      "Every Nura guide in one place: what EMDR is, how bilateral stimulation works, grounding, and what to do between sessions. Newest first.",
  },
  {
    id: "pricing",
    path: "/pricing",
    label: "Pricing",
    title: "Pricing — EMDR App Plans & Free Trial",
    description:
      "Nura pricing: $4.99/week, $14.99/month, or $99/year after a 7-day trial. Every plan unlocks AI agent-guided and Self-guided sessions. Cancel anytime.",
  },
  {
    id: "faq",
    path: "/faq",
    label: "FAQ",
    title: "EMDR App FAQ — Common Questions",
    description:
      "Answers to the questions people ask before starting: is guided EMDR safe, how long a session takes, what happens if you feel worse, and how billing works.",
  },
  {
    id: "support",
    path: "/support",
    label: "Support",
    title: "Support — Get Help With Your Account",
    description:
      "Get help with your Nura account, billing, sessions, or data. How to reach us and what to include so we can fix it fast.",
  },
  {
    id: "changelog",
    path: "/changelog",
    label: "What's new",
    title: "What's new",
    description:
      "Product notes for the Nura EMDR therapy online app — session updates, fixes, and removals.",
  },
  {
    id: "privacy",
    path: "/privacy",
    label: "Privacy",
    title: "Privacy",
    description: `How Receptly LLC handles account, session, and billing data for the Nura EMDR therapy app — what we store, why, and how to reach support.`,
  },
  {
    id: "terms",
    path: "/terms",
    label: "Terms",
    title: "Terms of service",
    description: `Terms for using Nura, the online EMDR therapy app operated by Receptly LLC — accounts, billing, and acceptable use.`,
  },
  {
    id: "safety",
    path: "/safety",
    label: "Safety",
    title: "Using AI-guided EMDR safely",
    description:
      "When to stop a Nura session, when to see a clinician, and crisis lines if you are not safe.",
  },
  {
    id: "limits",
    path: "/limits",
    label: "Limits",
    title: "What Nura Does Not Do — Limits of Guided EMDR",
    description:
      "An honest list of what Nura does not do: no diagnosis, no treatment, no clinical judgment, no crisis care. What a self-help tool can and cannot do alone.",
  },
];

export { isSeoPageId } from "@/lib/seo-config";

export function siteOrigin(publicAppUrl?: string): string {
  const raw = (publicAppUrl || "").trim() || brandMetadataBase().origin;
  try {
    return new URL(raw).origin;
  } catch {
    return `https://${BRAND_DOMAIN}`;
  }
}

export function resolveSiteSeoPages(
  seo: PlatformSeoConfig,
  publicAppUrl?: string
): SiteSeoPage[] {
  const origin = siteOrigin(publicAppUrl);
  const builtInDefault = `${origin}/brand/lockup.png`;
  const siteDefault = seo.defaultOgImageUrl.trim();
  return SITE_SEO_DEFAULTS.map((def) => {
    const o = seo.pages[def.id];
    const title = stripBrandTitleSuffix(
      effectiveSeoText(o?.title, def.title, RETIRED_SEO_TITLES)
    );
    const description = effectiveSeoText(
      o?.description,
      def.description,
      RETIRED_SEO_DESCRIPTIONS,
      def.id === "home" ? undefined : new Set([BRAND_DESCRIPTION])
    );
    const ogTitle = stripBrandTitleSuffix(
      effectiveSeoText(o?.ogTitle, title, RETIRED_SEO_TITLES)
    );
    const pageOg = o?.ogImageUrl?.trim() || "";
    const stored = pageOg || siteDefault;
    const ogImageUrl = absoluteOgImageUrl({
      stored,
      origin,
      pageId: def.id,
      hasPageOverride: Boolean(pageOg),
      fallback: builtInDefault,
      title: ogTitle || title,
      kicker: def.label,
    });
    const path = def.path;
    const canonical = path === "/" ? `${origin}/` : `${origin}${path}`;
    return {
      id: def.id,
      path,
      label: def.label,
      title,
      description,
      ogTitle,
      ogImageUrl,
      canonical,
      indexable: true,
    };
  });
}

export async function getResolvedSiteSeoPages(): Promise<{
  pages: SiteSeoPage[];
  seo: PlatformSeoConfig;
  publicAppUrl: string;
}> {
  const [settings, url] = await Promise.all([
    getPlatformSettings(),
    getPublicAppUrl(),
  ]);
  return {
    pages: resolveSiteSeoPages(settings.seo, url),
    seo: settings.seo,
    publicAppUrl: url,
  };
}

export function metadataFromResolved(
  pageId: SeoPageId,
  pages: SiteSeoPage[],
  seo: PlatformSeoConfig = DEFAULT_PLATFORM_SEO
): Metadata {
  const page =
    pages.find((p) => p.id === pageId) ??
    resolveSiteSeoPages(seo).find((p) => p.id === pageId) ??
    pages[0];
  const verification: Metadata["verification"] = {};
  if (seo.gscVerification.trim()) {
    verification.google = seo.gscVerification.trim();
  }
  if (seo.bingVerification.trim()) {
    verification.other = {
      "msvalidate.01": seo.bingVerification.trim(),
    };
  }
  return {
    // Root `/` shares the layout segment, so the `%s — Nura` template does not apply.
    title:
      pageId === "home"
        ? { absolute: documentTitle(page.title) }
        : page.title,
    description: page.description,
    alternates: localeAlternates(page.canonical),
    openGraph: {
      title:
        page.ogTitle === page.title
          ? `${page.title} — ${BRAND_SPOKEN}`
          : page.ogTitle,
      description: page.description,
      url: page.canonical,
      siteName: BRAND_LEGAL,
      type: "website",
      locale: "en",
      images: [{ url: page.ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title:
        page.ogTitle === page.title
          ? `${page.title} — ${BRAND_SPOKEN}`
          : page.ogTitle,
      description: page.description,
      images: [page.ogImageUrl],
    },
    ...(Object.keys(verification).length ? { verification } : {}),
  };
}

export async function buildPageMetadata(pageId: SeoPageId): Promise<Metadata> {
  try {
    const resolved = await getResolvedSiteSeoPages();
    return metadataFromResolved(pageId, resolved.pages, resolved.seo);
  } catch {
    // Docker/CI builds have no DATABASE_URL — use static defaults.
    return metadataFromResolved(
      pageId,
      resolveSiteSeoPages(DEFAULT_PLATFORM_SEO)
    );
  }
}

export function buildMarketingSeoStatus(
  seo: PlatformSeoConfig,
  pages: SiteSeoPage[],
  publicAppUrl?: string
): MarketingSeoStatus {
  const origin = siteOrigin(publicAppUrl);
  const home = pages.find((p) => p.id === "home") ?? pages[0];
  const ga4 = seo.ga4MeasurementId.trim();
  const gtm = seo.gtmId.trim();
  const clarity = seo.clarityId.trim();
  const gscProp = seo.gscProperty.trim();
  const gscVer = seo.gscVerification.trim();
  const bing = seo.bingVerification.trim();
  const ignoreList = parseAnalyticsIgnoreIps(seo.ignoreIps);
  const gtmOn = isValidGtmId(gtm);
  const ga4On = isValidGa4Id(ga4);
  const clarityOn = isValidClarityId(clarity);
  const gscOn = Boolean(gscProp || gscVer);
  const bingOn = Boolean(bing);
  const ignoreOn = ignoreList.length > 0;

  const connections: SeoConnection[] = [
    {
      id: "gsc",
      name: "Google Search Console",
      status: gscOn ? "connected" : "not_connected",
      publicIdMasked: null,
      detail: gscProp || null,
      hint: gscOn
        ? "This domain is verified. Submit the sitemap in Search Console if you have not yet."
        : "Paste the verification code and property from Search Console.",
    },
    {
      id: "ignore_ips",
      name: "Ignored IPs",
      status: ignoreOn ? "connected" : "not_connected",
      publicIdMasked: null,
      detail: ignoreOn ? maskIpForDisplay(ignoreList[0]!) : null,
      hint: "Visits from these addresses do not load Analytics, Clarity, or Tag Manager. Past numbers in the Analytics tab may still include older clicks.",
    },
    {
      id: "clarity",
      name: "Microsoft Clarity",
      status: clarityOn ? "connected" : "not_connected",
      publicIdMasked: clarityOn ? maskPublicId(clarity) : null,
      detail: null,
      hint: "Tag loads on public marketing pages. Turn on Consent Mode in the Clarity project; Nura passes consentv2 so cookies stay off until analytics cookies are allowed. Never on sign-in or the logged-in app.",
    },
    {
      id: "ga4",
      name: "Google Analytics",
      status: ga4On ? "connected" : "not_connected",
      publicIdMasked: ga4On ? maskPublicId(ga4) : null,
      detail: null,
      hint: "Tag loads on the homepage and legal pages with Consent Mode (storage stays off until analytics cookies are allowed). Visit numbers live on the Analytics tab. Do not also add this ID in Tag Manager.",
    },
    {
      id: "gtm",
      name: "Google Tag Manager",
      status: gtmOn ? "connected" : "not_connected",
      publicIdMasked: gtmOn ? maskPublicId(gtm) : null,
      detail: null,
      hint: "Container loads on public marketing pages with Consent Mode (ads storage stays off until marketing cookies are allowed). Do not add Google Analytics or Clarity here — Nura already loads them. Use Tag Manager for Meta and LinkedIn later.",
    },
    {
      id: "bing",
      name: "Bing Webmaster Tools",
      status: bingOn ? "connected" : "not_connected",
      publicIdMasked: null,
      detail: null,
      hint: "Paste the verification code from Bing Webmaster Tools.",
    },
    {
      id: "meta",
      name: "Meta Pixel",
      status: gtmOn ? "via_tag_manager" : "not_connected",
      publicIdMasked: null,
      detail: null,
      hint: "Add the Meta Pixel inside Google Tag Manager. Nura does not load a separate Meta script.",
    },
    {
      id: "linkedin",
      name: "LinkedIn Insight",
      status: gtmOn ? "via_tag_manager" : "not_connected",
      publicIdMasked: null,
      detail: null,
      hint: "Add the LinkedIn tag inside Google Tag Manager. Nura does not load a separate LinkedIn script.",
    },
  ];

  return {
    siteUrl: origin,
    title: home.title,
    description: home.description,
    canonical: home.canonical,
    ogTitle: home.ogTitle,
    ogImageUrl: home.ogImageUrl,
    sitemapUrl: `${origin}/sitemap.xml`,
    robotsUrl: `${origin}/robots.txt`,
    llmsTxtUrl: `${origin}/llms.txt`,
    gscProperty: gscProp || null,
    sitemapNote: gscOn
      ? "Submitted in Search Console when you add it there — Google can take a few days to process it."
      : "Connect Search Console, then submit this sitemap URL.",
    connections,
  };
}

export function publicMarketingTags(
  seo: PlatformSeoConfig,
  skipAnalytics: boolean
): PublicMarketingTags {
  const ignoreList = parseAnalyticsIgnoreIps(seo.ignoreIps);
  return {
    ga4MeasurementId: isValidGa4Id(seo.ga4MeasurementId)
      ? seo.ga4MeasurementId.trim()
      : "",
    gtmId: isValidGtmId(seo.gtmId) ? seo.gtmId.trim() : "",
    clarityId: isValidClarityId(seo.clarityId) ? seo.clarityId.trim() : "",
    skipAnalytics,
    checkIgnoreIps: ignoreList.length > 0 && !skipAnalytics,
  };
}
