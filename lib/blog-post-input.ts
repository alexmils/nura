/**
 * Pure validation + sanitizing for blog post copy.
 *
 * Kept separate from `lib/blog-db.ts` so the editorial rules (no em dash, no
 * BLS acronym, size caps) are unit-testable without Postgres, and so both the
 * admin API and the MCP endpoint share one gate.
 */

export const BLOG_TITLE_MAX = 200;
export const BLOG_DESCRIPTION_MAX = 400;
export const BLOG_DEK_MAX = 400;
export const BLOG_KICKER_MAX = 80;
export const BLOG_ANCHOR_MAX = 300;
export const BLOG_SECTIONS_MAX = 40;
export const BLOG_PARAGRAPHS_MAX = 40;
export const BLOG_BODY_MAX_CHARS = 200_000;

export type BlogSectionInput = { heading: string; paragraphs: string[] };

/** Em dash reads as AI copy; new copy gets a real separator instead. */
export function stripEmDash(value: string, separator: string): string {
  return value.replace(/\s*—\s*/g, separator).replace(/\s+/g, " ").trim();
}

/** Titles take a colon, body copy a comma. */
export function cleanCopy(value: string, mode: "title" | "body"): string {
  return stripEmDash(value, mode === "title" ? ": " : ", ");
}

/**
 * BLS is internal jargon and must never reach a public page
 * (`.cursor/rules/nura-brand.mdc`). Case-insensitive: "bls" is not a word.
 */
export function hasBlsAcronym(value: string): boolean {
  return /\bbls\b/i.test(value);
}

/** Every user-facing string a post can carry. */
export function userFacingCopy(input: {
  title: string;
  description: string;
  dek: string;
  kicker?: string;
  emdrAnchor?: string;
  sections: BlogSectionInput[];
}): string[] {
  return [
    input.title,
    input.description,
    input.dek,
    input.kicker ?? "",
    input.emdrAnchor ?? "",
    ...input.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
  ];
}

/** First string that uses the acronym, or null. */
export function findBlsAcronym(input: Parameters<typeof userFacingCopy>[0]): string | null {
  for (const value of userFacingCopy(input)) {
    if (hasBlsAcronym(value)) return value;
  }
  return null;
}

export function blogBodyLength(sections: BlogSectionInput[]): number {
  return sections.reduce(
    (sum, section) =>
      sum +
      section.heading.length +
      section.paragraphs.reduce((n, p) => n + p.length, 0),
    0
  );
}

export type SectionsParseResult =
  | { ok: true; sections: BlogSectionInput[] }
  | { ok: false; error: string };

/** Normalize + bound the article body. */
export function parseSections(value: unknown): SectionsParseResult {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      ok: false,
      error: "Sections are required (at least one heading with paragraphs)",
    };
  }
  if (value.length > BLOG_SECTIONS_MAX) {
    return {
      ok: false,
      error: `Use at most ${BLOG_SECTIONS_MAX} sections`,
    };
  }
  const out: BlogSectionInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Each section needs a heading and paragraphs" };
    }
    const section = raw as { heading?: unknown; paragraphs?: unknown };
    const heading =
      typeof section.heading === "string" ? cleanCopy(section.heading, "body") : "";
    if (!heading) {
      return { ok: false, error: "Each section needs a heading" };
    }
    const paragraphs = Array.isArray(section.paragraphs)
      ? section.paragraphs
          .filter((p): p is string => typeof p === "string")
          .map((p) => cleanCopy(p, "body"))
          .filter(Boolean)
      : [];
    if (paragraphs.length === 0) {
      return { ok: false, error: `"${heading}" needs at least one paragraph` };
    }
    if (paragraphs.length > BLOG_PARAGRAPHS_MAX) {
      return {
        ok: false,
        error: `"${heading}" has too many paragraphs (max ${BLOG_PARAGRAPHS_MAX})`,
      };
    }
    out.push({ heading, paragraphs });
  }

  const length = blogBodyLength(out);
  if (length > BLOG_BODY_MAX_CHARS) {
    return {
      ok: false,
      error: `Body is too long (${length} characters, max ${BLOG_BODY_MAX_CHARS})`,
    };
  }
  return { ok: true, sections: out };
}

/** Site-relative path or https URL. Empty is allowed (a fallback cover is used). */
export function isValidCoverUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Remote hosts allowed in `next.config.ts` → `images.remotePatterns`.
 * A cover from any other host makes `next/image` throw at render time, which
 * would take the whole page down, so those URLs are rejected on write and
 * swapped for the fallback on read.
 */
export const BLOG_REMOTE_IMAGE_HOSTS = [
  "images.unsplash.com",
  "images.pexels.com",
] as const;

/** Can this cover be rendered by `next/image`? */
export function isOptimizableBlogCover(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (t.startsWith("/")) return !t.startsWith("//");
  try {
    const u = new URL(t);
    return (
      u.protocol === "https:" &&
      (BLOG_REMOTE_IMAGE_HOSTS as readonly string[]).includes(
        u.hostname.toLowerCase()
      )
    );
  } catch {
    return false;
  }
}

/** Deterministic fallback so a post without a cover never renders an empty src. */
const FALLBACK_COVERS = [
  "/marketing/landing/reading.jpg",
  "/marketing/landing/green-landscape.jpg",
  "/marketing/landing/practice-space.jpg",
  "/marketing/landing/forest-path.jpg",
  "/marketing/landing/calm-water.jpg",
  "/marketing/landing/calm-rest.jpg",
] as const;

export function defaultBlogCover(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COVERS[hash % FALLBACK_COVERS.length]!;
}
