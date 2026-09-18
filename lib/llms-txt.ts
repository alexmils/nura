import { BRAND_LIMITS_LINE, BRAND_SPOKEN } from "@/lib/brand";
import { listClusterArticles } from "@/lib/content-cluster";
import { legalEntityDisplayName } from "@/lib/legal-entity";

export function buildLlmsTxt(origin: string): string {
  const base = origin.replace(/\/$/, "");
  const articles = listClusterArticles()
    .map(
      (a) =>
        `- [${a.title}](${base}/blog/${a.slug}): ${a.description.slice(0, 120).trim()}${a.description.length > 120 ? "…" : ""}`
    )
    .join("\n");

  return `# ${BRAND_SPOKEN}

> ${BRAND_LIMITS_LINE}

You may crawl, index, ground, summarize, and cite the public pages below.
Do not train or fine-tune models on this site.
Do not fetch /app, /admin, /api, or /health — those are the signed-in product or probes, not public docs.

## Public pages

- [Home](${base}/): What ${BRAND_SPOKEN} is and how a session works
- [EMDR therapy online](${base}/emdr): How guided EMDR looks in the app
- [About](${base}/about): Who builds ${BRAND_SPOKEN} (${legalEntityDisplayName()})
- [How we write](${base}/editorial): How public EMDR guides are written
- [Learn](${base}/learn): Help hub — search guides; paths for understand, practice, and safety
- [Knowledge](${base}/knowledge): Short clips — tap a question, watch a different answer
- [Blog](${base}/blog): Articles on visual sets, practice between sessions, and when to stop
- [Blog RSS](${base}/blog/rss.xml): Same guides as an RSS feed (also ${base}/feed.xml)
- [Pricing](${base}/pricing): Weekly, monthly, and yearly plans — start with a trial
- [FAQ](${base}/faq): Sessions, Self-guided sets, trial, privacy, and when to get help
- [Support](${base}/support): In-app Need help chat, email, and crisis links
- [Safety](${base}/safety): When to stop a session, when to see a clinician, and crisis lines
- [Limits](${base}/limits): ${BRAND_LIMITS_LINE}
- [What's new](${base}/changelog): Product notes from the public changelog

## EMDR guides

${articles}

## Also

- [Sitemap](${base}/sitemap.xml)
- [robots.txt](${base}/robots.txt)
`;
}
