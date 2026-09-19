/**
 * Clinical blog categories for `/blog` — the themes people start with
 * (mirrors the home "Why people start" grid). Slugs are stable and stored;
 * names and descriptions are UI + meta copy.
 *
 * A post can sit in more than one category. `/learn` keeps the separate
 * Understand / Practice / Safety reading paths.
 */

export type BlogCategoryDef = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
};

export const BLOG_CATEGORIES: readonly BlogCategoryDef[] = [
  {
    slug: "trauma",
    name: "Trauma",
    description:
      "Guides on trauma, memory, and where EMDR-style sets fit between sessions.",
    sortOrder: 10,
  },
  {
    slug: "ptsd",
    name: "PTSD",
    description:
      "What the treatment guidelines say about PTSD, and where self-help practice starts and stops.",
    sortOrder: 20,
  },
  {
    slug: "anxiety",
    name: "Anxiety",
    description:
      "Anxiety, activation, and what a visual set can and cannot do for a racing body.",
    sortOrder: 30,
  },
  {
    slug: "panic",
    name: "Panic",
    description:
      "Panic, grounding, and how to stay in the room before you ever start a set.",
    sortOrder: 40,
  },
  {
    slug: "grief",
    name: "Grief",
    description:
      "Grief that does not file itself away, and gentle practice on the harder days.",
    sortOrder: 50,
  },
  {
    slug: "phobias",
    name: "Phobias",
    description:
      "Fear that arrives before you can think, and how a target for a set gets chosen.",
    sortOrder: 60,
  },
  {
    slug: "childhood-memories",
    name: "Childhood memories",
    description:
      "Early memories, why they surface now, and how to pace yourself when they do.",
    sortOrder: 70,
  },
  {
    slug: "self-worth",
    name: "Self-worth",
    description:
      "The sentences you believe about yourself, and how they show up during a set.",
    sortOrder: 80,
  },
] as const;

export const BLOG_CATEGORY_SLUGS: readonly string[] = BLOG_CATEGORIES.map(
  (c) => c.slug
);

/** Lowercase slug: letters, digits, hyphens; 2–80 chars. */
export function normalizeBlogCategorySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isBlogCategorySlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    BLOG_CATEGORY_SLUGS.includes(normalizeBlogCategorySlug(value))
  );
}

const BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

export function blogCategoryBySlug(slug: string): BlogCategoryDef | null {
  return BY_SLUG.get(normalizeBlogCategorySlug(slug)) ?? null;
}

/** Display name for a stored slug; unknown slugs fall back to the raw slug. */
export function blogCategoryName(slug: string): string {
  return blogCategoryBySlug(slug)?.name ?? slug;
}

/**
 * Keep only known slugs, deduped, preserving the caller's order.
 *
 * Order is editorial: it decides the chip on the blog card, the order on the
 * article page, and the RSS `<category>` order. The first slug is the one the
 * card shows, so it must not be re-sorted into canonical order.
 */
export function sanitizeBlogCategorySlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const slug = normalizeBlogCategorySlug(value);
    if (!BLOG_CATEGORY_SLUGS.includes(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
