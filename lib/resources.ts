/** Shared types + validation for the Resources CMS (blog-style). */

export type ResourceKind = "article" | "video" | "safety";

export const RESOURCE_KINDS: readonly ResourceKind[] = [
  "article",
  "video",
  "safety",
] as const;

export const RESOURCE_COVER_MAX_CHARS = 500_000; // ~375KB data URL
export const RESOURCE_BODY_MAX_CHARS = 200_000;
export const RESOURCE_TITLE_MAX = 200;
export const RESOURCE_SUMMARY_MAX = 500;

export type ResourcePost = {
  id: string;
  slug: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  body: string | null;
  coverUrl: string | null;
  videoUrl: string | null;
  readMinutes: number | null;
  featured: boolean;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Public/card shape used by `/app/resources` UI (matches former ResourceItem). */
export type ResourceItem = {
  id?: string;
  slug: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  readMinutes?: number;
  videoUrl?: string;
  coverUrl?: string;
  body?: string;
  /** Present on list cards when body exists but is omitted from payload. */
  hasBody?: boolean;
  featured?: boolean;
};

export function isResourceKind(value: unknown): value is ResourceKind {
  return (
    typeof value === "string" &&
    (RESOURCE_KINDS as readonly string[]).includes(value)
  );
}

/** Lowercase slug: letters, digits, hyphens; 2–80 chars. */
export function normalizeResourceSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidResourceSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2;
}

/**
 * Allowlist for cover images and markdown `![]()` URLs:
 * https image URL, or jpeg/png/webp data URL under size cap.
 */
export function isValidResourceCoverUrl(value: string): boolean {
  if (value.startsWith("data:image/")) {
    if (value.length > RESOURCE_COVER_MAX_CHARS) return false;
    return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);
  }
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Alias for markdown / shared image sanitization. */
export function isValidResourceImageUrl(value: string): boolean {
  return isValidResourceCoverUrl(value);
}

/** Extract markdown image URLs from body text. */
export function extractMarkdownImageUrls(body: string): string[] {
  const urls: string[] = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

/** Safe CSS `background-image` value, or null if URL is not an allowed cover. */
export function cssBackgroundImageUrl(url: string): string | null {
  if (!isValidResourceCoverUrl(url)) return null;
  const escaped = url
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n\f]/g, "");
  return `url("${escaped}")`;
}

const VIDEO_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
  "dailymotion.com",
  "www.dailymotion.com",
  "dai.ly",
  "www.dai.ly",
  "loom.com",
  "www.loom.com",
  "streamable.com",
  "www.streamable.com",
]);

export function isValidResourceVideoUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (VIDEO_HOSTS.has(host)) return true;
    return /\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Build an iframe-friendly embed URL, or null if not embeddable. */
export function resourceVideoEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (!VIDEO_HOSTS.has(host)) return null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id
        ? `https://www.youtube.com/embed/${encodeURIComponent(id)}`
        : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      }
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[embedIdx + 1])}`;
      }
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[shortsIdx + 1])}`;
      }
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${encodeURIComponent(id)}`
        : null;
    }
    if (host === "dai.ly" || host === "www.dai.ly") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id
        ? `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}`
        : null;
    }
    if (host.endsWith("dailymotion.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const index = parts.indexOf("video");
      const id = index >= 0 ? parts[index + 1] : parts[0];
      return id
        ? `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}`
        : null;
    }
    if (host.endsWith("loom.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.loom.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host.endsWith("streamable.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://streamable.com/e/${encodeURIComponent(id)}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Full detail payload (article page). */
export function postToResourceItem(post: ResourcePost): ResourceItem {
  return {
    id: post.id,
    slug: post.slug,
    kind: post.kind,
    title: post.title,
    summary: post.summary,
    readMinutes: post.readMinutes ?? undefined,
    videoUrl: post.videoUrl ?? undefined,
    coverUrl: post.coverUrl ?? undefined,
    body: post.body ?? undefined,
    hasBody: Boolean(post.body?.trim()),
    featured: post.featured,
  };
}

/** List/card payload — omits body to keep JSON small. */
export function postToResourceCard(post: ResourcePost): ResourceItem {
  const item = postToResourceItem(post);
  delete item.body;
  return item;
}

export function slugifyTitle(title: string): string {
  return normalizeResourceSlug(title) || "resource";
}
