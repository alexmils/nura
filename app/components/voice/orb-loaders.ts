"use client";

/**
 * One lazy chunk per Orbkit orb file: voice mode only downloads the orb the
 * admin picked; the picker downloads all of them. Keys are the allowlisted
 * bases in lib/voice-orb-catalog (all MIT Orbkit originals).
 */
import type { OrbVariant } from "@/components/ui/orbkit-core";
import type { VoiceOrbBase } from "@/lib/voice-orb-catalog";

export const ORB_LOADERS: Record<VoiceOrbBase, () => Promise<OrbVariant>> = {
  "shdr-21": () => import("@/components/ui/shdr-21").then((m) => m.shdr21Orb),
  "shdr-13": () => import("@/components/ui/shdr-13").then((m) => m.shdr13Orb),
  "shdr-16": () => import("@/components/ui/shdr-16").then((m) => m.shdr16Orb),
  "shdr-17": () => import("@/components/ui/shdr-17").then((m) => m.shdr17Orb),
  "shdr-32": () => import("@/components/ui/shdr-32").then((m) => m.shdr32Orb),
  "shdr-14": () => import("@/components/ui/shdr-14").then((m) => m.shdr14Orb),
  "shdr-29": () => import("@/components/ui/shdr-29").then((m) => m.shdr29Orb),
};

const cache = new Map<VoiceOrbBase, Promise<OrbVariant>>();

export function loadOrbVariant(base: VoiceOrbBase): Promise<OrbVariant> {
  let p = cache.get(base);
  if (!p) {
    p = ORB_LOADERS[base]();
    p.catch(() => cache.delete(base));
    cache.set(base, p);
  }
  return p;
}
