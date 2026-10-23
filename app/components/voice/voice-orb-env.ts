/**
 * Pure helpers for the voice orb and the landscape glow. No React, no CSS,
 * so they run in node tests.
 */

export type VoiceOrbState = "idle" | "listening" | "thinking" | "speaking";
/** 0..1 loudness: a number, or a getter sampled once per frame. */
export type VoiceOrbLevel = number | (() => number);

export function readLevel(level: VoiceOrbLevel | undefined): number {
  const v = typeof level === "function" ? level() : level ?? 0;
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/**
 * Voice mode layout. The orb stage is the default everywhere (desktop,
 * tablets, portrait phones). Only a phone held sideways (landscape, short
 * viewport, touch pointer) drops the orb for text mode + the bottom glow.
 * Keep PHONE_LANDSCAPE_QUERY in sync with the @media rule in voice-stage.css.
 */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
export const PHONE_LANDSCAPE_QUERY = `(orientation: landscape) and (max-height: ${PHONE_LANDSCAPE_MAX_HEIGHT}px) and (pointer: coarse)`;

export type VoiceLayout = "stage" | "glow";

export function voiceLayout(env: { width: number; height: number; coarsePointer: boolean }): VoiceLayout {
  const landscape = env.width > env.height;
  if (landscape && env.height <= PHONE_LANDSCAPE_MAX_HEIGHT && env.coarsePointer) return "glow";
  return "stage";
}

export type OrbRenderer = "css" | "webgl";

/** The shader orb everywhere (iPhone included); the CSS blob only without WebGL or under reduced motion. */
export function pickOrbRenderer(env: { reducedMotion: boolean; webgl: boolean }): OrbRenderer {
  if (env.reducedMotion || !env.webgl) return "css";
  return "webgl";
}

/**
 * Orbkit (SHDR-21) only knows idle / thinking / speaking. Its idle is "calm,
 * slow drift: listening or waiting", so listening rides idle's motion and is
 * told apart by its tint and the live mic level.
 */
export type OrbkitState = "idle" | "thinking" | "speaking";

export function orbkitState(state: VoiceOrbState): OrbkitState {
  return state === "listening" ? "idle" : state;
}

/**
 * SHDR-21 lit-side ("light") colour per state. Idle is the user's pick
 * (#87d539), kept exact; the live states stay green and only gain intensity:
 * a lighter, fresher green while listening, a deeper, cooler green while
 * thinking, the most vivid green while speaking (no gold / citron).
 */
export const ORB_TINTS: Record<VoiceOrbState, string> = {
  idle: "#87d539",
  listening: "#9be84a",
  thinking: "#4fc46a",
  speaking: "#6ee83a",
};

/** SHDR-21 self-shadowed side: a deeper shade of each state's colour. */
export const ORB_SHADOWS: Record<VoiceOrbState, string> = {
  idle: "#5a8540",
  listening: "#5f9a34",
  thinking: "#2f7a45",
  speaking: "#3f9a2a",
};

/**
 * SHDR-21's shipped speaking preset (power 3.1, ambient 0.46) is tuned for a
 * dark page and washes out to white on Nura's cream. Tone it down, still
 * brighter than idle (1.9 / 0.12). Merged key by key over Orbkit's presets.
 */
export const ORB_STATE_PRESETS: Partial<Record<OrbkitState, Record<string, number>>> = {
  speaking: { power: 2.2, ambient: 0.28 },
};

export const ORB_STATE_COLORS: Record<OrbkitState, { light: string; shadow: string }> = {
  idle: { light: ORB_TINTS.idle, shadow: ORB_SHADOWS.idle },
  thinking: { light: ORB_TINTS.thinking, shadow: ORB_SHADOWS.thinking },
  speaking: { light: ORB_TINTS.speaking, shadow: ORB_SHADOWS.speaking },
};

export type OrbVolumes = { input?: number; output?: number };

/**
 * Live volume for Orbkit: listening drives `input` (user speech) from the
 * mic, speaking drives `output` (agent speech) from the reply. A silent reply
 * (no analyser) and the other states keep Orbkit's own synthesized motion.
 */
export function orbVolumes(state: VoiceOrbState, level: number): OrbVolumes | undefined {
  const v = readLevel(level);
  if (state === "listening") return { input: v };
  if (state === "speaking" && v > 0.02) return { output: 0.45 + v * 0.55 };
  return undefined;
}

/**
 * Level for the landscape glow. Listening follows the mic, speaking the
 * reply (or a soft synthetic pulse when the playback has no analyser),
 * thinking and idle stay low; the beam's own processing sweep shows thinking.
 */
export function glowLevel(state: VoiceOrbState, input: number, output: number, t: number): number {
  switch (state) {
    case "listening":
      return readLevel(input);
    case "speaking":
      if (output > 0.02) return readLevel(output);
      return 0.35 + 0.15 * Math.sin(t * 3.1) * Math.sin(t * 1.3 + 0.5);
    case "thinking":
      return 0.2;
    default:
      return 0;
  }
}

/**
 * Thinking sweep for the landscape glow (voice-glow `motion`): gathered
 * 0..1 into one beam that glides side to side, wider while it moves.
 */
export function sweepMotion(gather: number, t: number): { gather: number; offset: number; stretch: number; heldLevel: number } {
  const g = Math.min(1, Math.max(0, gather));
  const offset = 0.62 * Math.sin(t * 1.15);
  const speed = Math.abs(Math.cos(t * 1.15));
  return { gather: g, offset: offset * g, stretch: 0.35 * speed * g, heldLevel: 0.45 };
}