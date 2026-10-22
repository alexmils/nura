/**
 * CTA blocks inside a guide.
 *
 * A CTA is one paragraph that starts with `::cta ` followed by JSON. Keeping it
 * in the paragraph list means it can sit anywhere in the flow, the admin can
 * insert it at the cursor, and the MCP agent can write it without a new field
 * on the post.
 */

export const BLOG_CTA_TEMPLATES = ["calm", "split", "band", "minimal"] as const;
export type BlogCtaTemplate = (typeof BLOG_CTA_TEMPLATES)[number];

export const BLOG_CTA_TEMPLATE_LABELS: Record<BlogCtaTemplate, string> = {
  calm: "Calm card",
  split: "Split row",
  band: "Dark band",
  minimal: "Minimal line",
};

export type BlogCtaData = {
  template: BlogCtaTemplate;
  title: string;
  body?: string;
  button?: string;
  href?: string;
  /** CSS hex colour. Anything else is ignored, so stored copy cannot inject CSS. */
  background?: string;
  text?: string;
};

const PREFIX = "::cta";
const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i;

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function colour(value: unknown): string | undefined {
  const v = str(value, 9);
  return v && HEX.test(v) ? v : undefined;
}

/** `/pricing`, `#anchor`, or an https URL. */
function href(value: unknown): string | undefined {
  const v = str(value, 300);
  if (!v) return undefined;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    return new URL(v).protocol === "https:" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeBlogCta(raw: unknown): BlogCtaData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 140);
  if (!title) return null;
  const template = BLOG_CTA_TEMPLATES.includes(r.template as BlogCtaTemplate)
    ? (r.template as BlogCtaTemplate)
    : "calm";
  return {
    template,
    title,
    body: str(r.body, 400),
    button: str(r.button, 48),
    href: href(r.href),
    background: colour(r.background),
    text: colour(r.text),
  };
}

/** A paragraph is a CTA when it starts with `::cta` and parses. */
export function parseBlogCta(paragraph: string): BlogCtaData | null {
  const trimmed = paragraph.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  const json = trimmed.slice(PREFIX.length).trim();
  if (!json.startsWith("{")) return null;
  try {
    return normalizeBlogCta(JSON.parse(json));
  } catch {
    return null;
  }
}

export function serializeBlogCta(data: BlogCtaData): string {
  const clean = normalizeBlogCta(data);
  if (!clean) throw new Error("A CTA needs a title.");
  return `${PREFIX} ${JSON.stringify(clean)}`;
}

/** Insert a CTA at the end of the last section (the "closing CTA" path). */
export function appendCtaToSections<T extends { paragraphs: string[] }>(
  sections: T[],
  cta: string,
  position: number | "end" = "end"
): T[] {
  if (sections.length === 0) return sections;
  const index =
    position === "end"
      ? sections.length - 1
      : Math.min(Math.max(position, 0), sections.length - 1);
  return sections.map((section, i) =>
    i === index
      ? { ...section, paragraphs: [...section.paragraphs, cta] }
      : section
  );
}
