/** Which side a sound-row preview plays on, honoring Reverse left/right. */
export function previewPan(side: "left" | "right", reverseStereo: boolean): number {
  const base = side === "left" ? -1 : 1;
  return reverseStereo ? -base : base;
}

/**
 * Tapping a row's play button: same row stops it, another row replaces it.
 * Only one preview runs at a time.
 */
export function togglePreview<T extends string>(
  current: T | null,
  tapped: T
): { stop: T | null; start: T | null } {
  if (current === tapped) return { stop: current, start: null };
  return { stop: current, start: tapped };
}