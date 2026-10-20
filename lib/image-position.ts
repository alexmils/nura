/**
 * Where a cropped photo sits in its frame (ported from alexandermils
 * src/lib/image-position.ts). x/y are percentages; zoom 1 fills the frame.
 * Nura keeps section data as strings, so a position is stored next to its
 * image as `<imageKey>Pos` = "x y zoom" (e.g. bgImagePos = "40 70 1.3").
 * An untouched image stores nothing, so it renders exactly as before.
 */
import type { CSSProperties } from "react";

export type ImagePosition = { x: number; y: number; zoom: number };

export const IMAGE_CENTER: ImagePosition = { x: 50, y: 50, zoom: 1 };

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

const LEGACY: Record<string, { x: number; y: number }> = {
  "left-top": { x: 0, y: 0 },
  top: { x: 50, y: 0 },
  "right-top": { x: 100, y: 0 },
  left: { x: 0, y: 50 },
  center: { x: 50, y: 50 },
  right: { x: 100, y: 50 },
  "left-bottom": { x: 0, y: 100 },
  bottom: { x: 50, y: 100 },
  "right-bottom": { x: 100, y: 100 },
};

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function clampZoom(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n * 100) / 100));
}

function zoomOf(value: unknown): number {
  if (value && typeof value === "object" && "zoom" in value) {
    const z = (value as { zoom: unknown }).zoom;
    if (typeof z === "number") return clampZoom(z);
  }
  return 1;
}

/** Accepts a saved point, a stored "x y zoom" string, a legacy name, or anything else (centre). */
export function imagePosition(value: unknown): ImagePosition {
  if (typeof value === "string") {
    if (LEGACY[value]) return { ...LEGACY[value], zoom: 1 };
    const parts = value.trim().split(/\s+/).map(Number);
    if (parts.length >= 2 && parts.slice(0, 3).every(Number.isFinite)) {
      return { x: clamp(parts[0]!), y: clamp(parts[1]!), zoom: clampZoom(parts[2] ?? 1) };
    }
    return IMAGE_CENTER;
  }
  if (value && typeof value === "object" && "x" in value && "y" in value) {
    const v = value as { x: unknown; y: unknown };
    if (typeof v.x === "number" && typeof v.y === "number" && Number.isFinite(v.x) && Number.isFinite(v.y)) {
      return { x: clamp(v.x), y: clamp(v.y), zoom: zoomOf(value) };
    }
  }
  return IMAGE_CENTER;
}

export function isCentred(p: ImagePosition): boolean {
  return p.x === 50 && p.y === 50 && p.zoom === 1;
}

/** Stored form: "x y zoom", or "" for the untouched default. */
export function formatImagePosition(value: unknown): string {
  const p = imagePosition(value);
  return isCentred(p) ? "" : `${p.x} ${p.y} ${p.zoom}`;
}

/** The section-data key that holds an image's position. */
export function framePosKey(imageKey: string): string {
  return `${imageKey}Pos`;
}

/** CSS object-position for an `object-cover` image. */
export function objectPositionFor(value: unknown): string {
  const p = imagePosition(value);
  return `${p.x}% ${p.y}%`;
}

/** Position plus zoom, so a slideshow can jump when either changes. */
export function frameSignature(value: unknown): string {
  const p = imagePosition(value);
  return `${p.x}% ${p.y}%@${p.zoom}`;
}

/** object-position and a scale that zooms into that point. `extra` is a frame adjustment. */
export function frameStyle(value: unknown, extra = 1): { objectPosition: string; transform: string; transformOrigin: string } {
  const p = imagePosition(value);
  const scale = Math.round(p.zoom * extra * 1000) / 1000;
  const at = `${p.x}% ${p.y}%`;
  return { objectPosition: at, transform: `scale(${scale})`, transformOrigin: at };
}

/** Inline style for a stored position, or undefined when untouched (the image keeps its CSS). */
export function storedFrameStyle(stored: unknown): CSSProperties | undefined {
  if (typeof stored !== "string" || !stored.trim()) return undefined;
  const p = imagePosition(stored);
  if (isCentred(p)) return undefined;
  return frameStyle(p);
}

/** Stable id shared by an Edit button and the photograph it moves. */
export function frameKey(scope: string, id: string) {
  return `${scope}::${id}`;
}
