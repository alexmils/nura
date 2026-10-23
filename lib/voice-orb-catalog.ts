/**
 * Voice-mode orb catalogue: the allowlist of orb looks an admin can pick in
 * Admin -> Platform -> Voice orb, and the validation for that choice.
 * Pure (no React, no DB), so it runs in node tests and on the server.
 *
 * Every entry renders an Orbkit ORIGINAL orb, MIT (c) 2026 zzzzshawn
 * (https://github.com/zzzzshawn/orbkit, CREDITS.md "Original orbs").
 * The XorDev ports in Orbkit are non-commercial only and must never appear
 * here: see NON_COMMERCIAL_ORB_SLUGS, which the tests check against.
 */

/** Orbkit originals (MIT) whose files ship in components/ui. */
export const VOICE_ORB_BASES = [
  "shdr-21",
  "shdr-13",
  "shdr-16",
  "shdr-17",
  "shdr-32",
  "shdr-14",
  "shdr-29",
] as const;
export type VoiceOrbBase = (typeof VOICE_ORB_BASES)[number];

/** Orbkit's 14 MIT originals (CREDITS.md). */
export const MIT_ORBKIT_SLUGS = [
  "shdr-11", "shdr-12", "shdr-13", "shdr-14", "shdr-16", "shdr-17", "shdr-21",
  "shdr-23", "shdr-24", "shdr-27", "shdr-29", "shdr-30", "shdr-32", "shdr-33",
] as const;

/** Orbkit ports of XorDev shaders: NON-COMMERCIAL. Never use in Nura. */
export const NON_COMMERCIAL_ORB_SLUGS = [
  "shdr-01", "shdr-02", "shdr-03", "shdr-04", "shdr-05", "shdr-06", "shdr-07",
  "shdr-08", "shdr-09", "shdr-10", "shdr-15", "shdr-18", "shdr-19", "shdr-20",
  "shdr-22", "shdr-25", "shdr-26", "shdr-28", "shdr-31",
] as const;

export type VoiceOrbOption = {
  /** Stored in app_settings.voiceOrbId. Stable: never rename a shipped id. */
  id: string;
  /** Shown in the picker. */
  name: string;
  /** Orbkit file the look renders with. */
  base: VoiceOrbBase;
  /** A Nura-tuned variant of an orb that is also listed on its own. */
  variant: boolean;
  /** One line for the picker card. */
  blurb: string;
  license: "MIT";
};

export const VOICE_ORB_OPTIONS = [
  { id: "shdr-21", name: "Cloud", base: "shdr-21", variant: false, blurb: "Light diffusing through a soft cloud.", license: "MIT" },
  { id: "shdr-21-halo", name: "Cloud \u00b7 Halo", base: "shdr-21", variant: true, blurb: "A lighter, airier cloud with a pastel glow.", license: "MIT" },
  { id: "shdr-13", name: "Plasma", base: "shdr-13", variant: false, blurb: "Glowing filaments crawling from a warm core.", license: "MIT" },
  { id: "shdr-13-soft", name: "Plasma \u00b7 Soft", base: "shdr-13", variant: true, blurb: "Fewer, softer threads; calmer and hazier.", license: "MIT" },
  { id: "shdr-16", name: "Sunlit water", base: "shdr-16", variant: false, blurb: "Sunlight through water, a caustic net drifting over the ball.", license: "MIT" },
  { id: "shdr-16-mint", name: "Sunlit water \u00b7 Mint", base: "shdr-16", variant: true, blurb: "The caustic net on pale mint water.", license: "MIT" },
  { id: "shdr-17", name: "Aurora storm", base: "shdr-17", variant: false, blurb: "Grainy bands of weather flowing around the ball.", license: "MIT" },
  { id: "shdr-32", name: "Galaxy", base: "shdr-32", variant: false, blurb: "A slow spiral of gas and stars inside the ball.", license: "MIT" },
  { id: "shdr-14", name: "Pixel dome", base: "shdr-14", variant: false, blurb: "Drifting plasma dithered into soft two-tone pixels.", license: "MIT" },
  { id: "shdr-29", name: "Light tiles", base: "shdr-29", variant: false, blurb: "A tile wall lighting up in flowing blobs.", license: "MIT" },
] as const satisfies readonly VoiceOrbOption[];

export type VoiceOrbId = (typeof VOICE_ORB_OPTIONS)[number]["id"];

export const VOICE_ORB_IDS: readonly VoiceOrbId[] = VOICE_ORB_OPTIONS.map((o) => o.id);

export const DEFAULT_VOICE_ORB_ID: VoiceOrbId = "shdr-21";

/** Voice mode start/end chimes. On unless an admin turns them off. */
export const DEFAULT_VOICE_SOUNDS = true;

const ID_SET: ReadonlySet<string> = new Set(VOICE_ORB_IDS);

export function isVoiceOrbId(value: unknown): value is VoiceOrbId {
  return typeof value === "string" && ID_SET.has(value);
}

/** Any stored / requested value -> a known id (unknown values fall back to the default). */
export function normalizeVoiceOrbId(value: unknown): VoiceOrbId {
  if (typeof value !== "string") return DEFAULT_VOICE_ORB_ID;
  const v = value.trim().toLowerCase();
  return isVoiceOrbId(v) ? v : DEFAULT_VOICE_ORB_ID;
}

export function normalizeVoiceSounds(value: unknown): boolean {
  return value !== false;
}

export function voiceOrbOption(id: unknown): (typeof VOICE_ORB_OPTIONS)[number] {
  const key = normalizeVoiceOrbId(id);
  return VOICE_ORB_OPTIONS.find((o) => o.id === key) ?? VOICE_ORB_OPTIONS[0];
}

export type VoiceOrbUpdate = { orbId?: VoiceOrbId; sounds?: boolean };

/**
 * Validates the admin PUT body. Strict: an unknown id is a 400, not a
 * silent fallback, so a typo never quietly resets the live orb.
 */
export function parseVoiceOrbUpdate(
  body: unknown
): { ok: true; update: VoiceOrbUpdate } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const update: VoiceOrbUpdate = {};
  if ("orbId" in b) {
    if (!isVoiceOrbId(b.orbId)) return { ok: false, error: "Unknown orb id." };
    update.orbId = b.orbId;
  }
  if ("sounds" in b) {
    if (typeof b.sounds !== "boolean") return { ok: false, error: "sounds must be true or false." };
    update.sounds = b.sounds;
  }
  if (update.orbId === undefined && update.sounds === undefined) {
    return { ok: false, error: "Nothing to update." };
  }
  return { ok: true, update };
}
