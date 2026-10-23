/**
 * Per-orb Nura tuning: colours for all four voice states and gentle preset
 * retouches, so every orb in the picker reads in the brand's green / yellow /
 * pastel family on the cream voice stage. Idle is the calm reference; the
 * live states stay green and only get more intense: listening a lighter,
 * fresher green, thinking a deeper, cooler green, speaking the most vivid
 * green. Pale lime / cream only as small highlights, never gold or orange. Pure data (node-testable).
 *
 * Orbkit knows idle / thinking / speaking. Listening rides idle's motion and
 * gets its own colours through the explicit `colors` prop (see VoiceOrb).
 * Only keys an orb declares are used here; tests check that against the files.
 */
import type { VoiceOrbId } from "@/lib/voice-orb-catalog";
import type { OrbkitState, VoiceOrbState } from "./voice-orb-env";
import { ORB_SHADOWS, ORB_STATE_PRESETS, ORB_TINTS } from "./voice-orb-env";

export type OrbLook = {
  /** Colours per voice state, keyed by the orb's own colour keys. */
  colors: Record<VoiceOrbState, Record<string, string>>;
  /** Merged key by key over the orb's shipped presets. */
  statePresets?: Partial<Record<OrbkitState, Record<string, number>>>;
};

const cloud = (s: VoiceOrbState) => ({ light: ORB_TINTS[s], shadow: ORB_SHADOWS[s] });

export const VOICE_ORB_LOOKS: Record<VoiceOrbId, OrbLook> = {
  /* Cloud: the current default, unchanged. */
  "shdr-21": {
    colors: { idle: cloud("idle"), listening: cloud("listening"), thinking: cloud("thinking"), speaking: cloud("speaking") },
    statePresets: ORB_STATE_PRESETS,
  },
  /* Cloud · Halo: a softer, greener cloud that keeps its colour when speaking. */
  "shdr-21-halo": {
    colors: {
      idle: { light: "#b9e47e", shadow: "#4f8a2c" },
      listening: { light: "#c4f08a", shadow: "#58a032" },
      thinking: { light: "#7ed69a", shadow: "#2f7f4a" },
      speaking: { light: "#8cf05a", shadow: "#3c9a2a" },
    },
    statePresets: {
      idle: { density: 2.6, edgeSoft: 1.3, alphaGain: 1.3, ambient: 0.14, power: 1.35, shadowLift: 0.7 },
      thinking: { density: 2.6, edgeSoft: 1.3, alphaGain: 1.3, ambient: 0.16, power: 1.45, shadowLift: 0.75 },
      speaking: { density: 2.6, edgeSoft: 1.3, alphaGain: 1.35, ambient: 0.18, power: 1.6, shadowLift: 0.8 },
    },
  },
  /* Plasma: lime arcs from a sunny nucleus. */
  "shdr-13": {
    colors: {
      idle: { inner: "#f2cf5b", arc: "#6fbf2e", tint: "#fffbea" },
      listening: { inner: "#d0f59a", arc: "#86d83c", tint: "#f8ffe8" },
      thinking: { inner: "#bfeec0", arc: "#3fae5a", tint: "#f2fff4" },
      speaking: { inner: "#c8fa7a", arc: "#5fd62a", tint: "#f4ffe4" },
    },
  },
  /* Plasma · Soft: fewer, blurrier threads, lower exposure. */
  "shdr-13-soft": {
    colors: {
      idle: { inner: "#fff1b8", arc: "#9bd65a", tint: "#ffffff" },
      listening: { inner: "#f4fbc8", arc: "#9be35a", tint: "#ffffff" },
      thinking: { inner: "#e2f7dc", arc: "#5cc27a", tint: "#ffffff" },
      speaking: { inner: "#dcfbb0", arc: "#6ddc3a", tint: "#ffffff" },
    },
    statePresets: {
      idle: { fils: 4, soft: 0.14, sharp: 2.4, exposure: 8 },
      thinking: { fils: 5, soft: 0.14, sharp: 2.2, exposure: 8 },
      speaking: { fils: 5, soft: 0.12, sharp: 2.6, exposure: 7 },
    },
  },
  /* Sunlit water: deep green water, pale-gold caustics. */
  "shdr-16": {
    colors: {
      idle: { deep: "#3d6b2c", sun: "#eef8a8", sheen: "#dcefc4" },
      listening: { deep: "#4a8a32", sun: "#dcfcb0", sheen: "#e0f6c8" },
      thinking: { deep: "#24684a", sun: "#d4f5d8", sheen: "#cdebd8" },
      speaking: { deep: "#3f9a2a", sun: "#bef76a", sheen: "#def8b8" },
    },
  },
  /* Sunlit water · Mint: pale mint water, softer net. */
  "shdr-16-mint": {
    colors: {
      idle: { deep: "#8cc79a", sun: "#fbffe6", sheen: "#eaf7e0" },
      listening: { deep: "#8fd48f", sun: "#f8ffe0", sheen: "#e8f9dc" },
      thinking: { deep: "#5fb88e", sun: "#eefff4", sheen: "#def4e6" },
      speaking: { deep: "#6fd06a", sun: "#ecffd0", sheen: "#e2fad0" },
    },
    statePresets: {
      idle: { gain: 4.5, contrast: 1.05, rim: 0.35 },
      thinking: { gain: 3, contrast: 1.0 },
      speaking: { gain: 3.2, contrast: 0.85 },
    },
  },
  /* Aurora storm: green-gold bands, little rainbow, light grain. */
  "shdr-17": {
    colors: {
      idle: { deep: "#2f5226", low: "#87d539", mid: "#cfe89a", hot: "#f2cf5b", flash: "#fffbe6" },
      listening: { deep: "#33602a", low: "#9ce64a", mid: "#d6f5a0", hot: "#b4f06a", flash: "#fbffe6" },
      thinking: { deep: "#1f4a32", low: "#4cc46a", mid: "#b8ecc4", hot: "#8fe08a", flash: "#f4fff4" },
      speaking: { deep: "#2a6a20", low: "#6ee83a", mid: "#c4f78a", hot: "#d4fb9a", flash: "#f8ffe8" },
    },
    statePresets: {
      idle: { rainbow: 0.15, grain: 0.22, filmGrain: 0.15 },
      thinking: { rainbow: 0.15, grain: 0.22, filmGrain: 0.15 },
      speaking: { rainbow: 0.12, grain: 0.2, filmGrain: 0.15, flash: 1.2 },
    },
  },
  /* Galaxy: lime and gold arms around a cream core, deep green night. */
  "shdr-32": {
    colors: {
      idle: { tint: "#ffffff", core: "#fff8dc", inner: "#a8e063", outer: "#f2cf5b", deep: "#1d2b16", rim: "#cfe89a" },
      listening: { tint: "#ffffff", core: "#f8ffe4", inner: "#b4ee6a", outer: "#8fd84a", deep: "#1f3418", rim: "#d8f5a8" },
      thinking: { tint: "#ffffff", core: "#effff2", inner: "#5cc87a", outer: "#3fa860", deep: "#12301f", rim: "#bfecc8" },
      speaking: { tint: "#ffffff", core: "#f4ffd8", inner: "#8ef04a", outer: "#5fd02e", deep: "#183a12", rim: "#c8f78a" },
    },
  },
  /* Pixel dome: forest ink on pastel paper. */
  "shdr-14": {
    colors: {
      idle: { ink: "#2f4a22", paper: "#d9f0a8" },
      listening: { ink: "#33582a", paper: "#d8f8b0" },
      thinking: { ink: "#1f4a34", paper: "#c8f0d4" },
      speaking: { ink: "#2a6a1c", paper: "#c4f58a" },
    },
  },
  /* Light tiles: pastel tiles on a soft moss wall, little confetti. */
  "shdr-29": {
    colors: {
      idle: { lit: "#d6f2a6", wall: "#4d6b3a" },
      listening: { lit: "#d8f8b0", wall: "#4f7a38" },
      thinking: { lit: "#bdeed0", wall: "#2f6a4a" },
      speaking: { lit: "#b8f770", wall: "#3f8a2a" },
    },
    statePresets: {
      idle: { confetti: 0.06, coverage: 0.6 },
      thinking: { confetti: 0.06, coverage: 0.5 },
      speaking: { confetti: 0.06, coverage: 0.55 },
    },
  },
};

export function orbLook(id: VoiceOrbId): OrbLook {
  return VOICE_ORB_LOOKS[id];
}

/** Orbkit's stateColors (idle / thinking / speaking) for a look. */
export function orbStateColors(look: OrbLook): Record<OrbkitState, Record<string, string>> {
  return { idle: look.colors.idle, thinking: look.colors.thinking, speaking: look.colors.speaking };
}
