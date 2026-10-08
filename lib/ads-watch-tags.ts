/** Words pinned from the Meta / Google campaign search. Any tag may match. */

export function addWatchTag(tags: readonly string[], raw: string): string[] {
  const next = raw.trim().replace(/\s+/g, " ");
  if (!next) return tags as string[];
  if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) return tags as string[];
  return [...tags, next];
}

export function textMatchesWatchTags(
  tags: readonly string[],
  parts: Array<string | null | undefined>
): boolean {
  const active = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  if (active.length === 0) return true;
  const text = parts
    .flatMap((part) => {
      if (!part) return [];
      const raw = part.trim();
      if (!raw) return [];
      const lower = raw.toLowerCase();
      const spaced = lower.replace(/_/g, " ");
      return spaced === lower ? [lower] : [lower, spaced];
    })
    .join(" ");
  return active.some((tag) => text.includes(tag));
}
