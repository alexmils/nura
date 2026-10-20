"use client";

import { clearSectionDraft, getSectionDraft } from "@/app/components/frontend/section-editor/section-draft";
import { formatImagePosition, framePosKey, imagePosition, type ImagePosition } from "@/lib/image-position";
import type { SectionConfig, SectionItem } from "@/lib/marketing-sections";

/** Live crop drag. The page photograph and its Edit button share `key`. */
export const FRAME_DRAG = "frame-drag";

export type FrameDrag = { key: string; url: string; x: number; y: number; zoom: number; done?: boolean };

export function parseFrameKey(full: string): { scope: string; id: string } | null {
  const i = full.indexOf("::");
  if (i < 0) return null;
  return { scope: full.slice(0, i), id: full.slice(i + 2) };
}

/** Apply an in-progress crop drag like FrameEdit Done, then clear FRAME_DRAG. */
export function flushActiveFrameDrag(apply: (key: string, position: ImagePosition) => void): void {
  const drag = getSectionDraft<FrameDrag>(FRAME_DRAG);
  if (!drag) return;
  if (!drag.done) apply(drag.key, imagePosition(drag));
  clearSectionDraft(FRAME_DRAG);
}

/**
 * Nura frame paths inside one section's data: "bgImage", "image",
 * "mediaImage", or "<list>.<index>.<imageKey>" for a list item.
 */
export function readFramePath(config: SectionConfig | null | undefined, path: string): string {
  if (!config) return "";
  const parts = path.split(".");
  if (parts.length === 3) {
    const list = config[parts[0]!];
    const item = Array.isArray(list) ? list[Number(parts[1])] : undefined;
    const v = item?.[framePosKey(parts[2]!)];
    return typeof v === "string" ? v : "";
  }
  const v = config[framePosKey(path)];
  return typeof v === "string" ? v : "";
}

export function patchFramePath(config: SectionConfig, path: string, position: unknown): SectionConfig {
  const stored = formatImagePosition(position);
  const parts = path.split(".");
  if (parts.length === 3) {
    const list = config[parts[0]!];
    if (!Array.isArray(list)) return config;
    const index = Number(parts[1]);
    const key = framePosKey(parts[2]!);
    return {
      ...config,
      [parts[0]!]: list.map((item, i) => {
        if (i !== index) return item;
        const next: SectionItem = { ...item };
        if (stored) next[key] = stored;
        else delete next[key];
        return next;
      }),
    };
  }
  const next: SectionConfig = { ...config };
  if (stored) next[framePosKey(path)] = stored;
  else delete next[framePosKey(path)];
  return next;
}
