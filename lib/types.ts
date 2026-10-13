export type ProtocolPhase =
  | "intake"
  | "grounding"
  | "assessment"
  | "desensitization"
  | "installation"
  | "body_scan"
  | "closure";

export type AnimationMode = "dot" | "flash";
/**
 * How the set travels. `auto` follows the screen (wide = horizontal, tall = vertical).
 * `random` picks a new straight path at each end.
 */
export type AnimationPath =
  | "auto"
  | "horizontal"
  | "diagonal-up"
  | "diagonal-down"
  | "vertical"
  | "random";
/** Flash brightness. Standard brightens the flash color. Off uses that color as set. */
export type BrightenFlashes = "off" | "standard";
/** Synthesized stereo sounds. See `lib/bls-sounds.ts`. */
export type BlsSoundId =
  | "beep-g3"
  | "beep-c4"
  | "beep-a4"
  | "beep-c5"
  | "beep-c6"
  | "piano-g6"
  | "finger-snap"
  | "pink-noise"
  | "sticks"
  | "hi-hat";
/**
 * Old Adjustments sound values. `parseBlsSettings` maps them onto stereo ids.
 * Not written back to storage.
 */
export type LegacySoundMode = "mute" | "click" | "pulse" | "tone";
/** Finite pass count (1–999) or unlimited. */
export type RepeatMode = number | "infinity";
export type RepeatPresetIndex = 0 | 1;
/**
 * Off, then Subtle, Soft, Normal, and Hard.
 * Hard is the strongest pulse the device can play.
 * Legacy `none` migrates to `off`.
 */
export type VibrationMode = "off" | "subtle" | "soft" | "normal" | "hard";

/** Session start choice: pending until user picks guided or free. */
export type SessionKind = "pending" | "guided" | "free";

export type SpeedPresetIndex = 0 | 1 | 2;

export interface BlsSettings {
  speedPresets: [number, number, number];
  activeSpeedPreset: SpeedPresetIndex;
  /** Live repeat count. Always matches `repeatPresets[activeRepeatPreset]`. */
  repeats: RepeatMode;
  repeatPresets: [RepeatMode, RepeatMode];
  activeRepeatPreset: RepeatPresetIndex;
  setLengthSec: number;
  /** Silences the set. Preview buttons still play. */
  soundMuted: boolean;
  leftSound: BlsSoundId;
  rightSound: BlsSoundId;
  /** Swaps which sound plays on which end. Pan stays with the end. */
  reverseStereo: boolean;
  animation: AnimationMode;
  animationPath: AnimationPath;
  brightenFlashes: BrightenFlashes;
  /** Circle color. */
  ballColor: string;
  /** Flash color, used when brighten flashes is off. */
  flashColor: string;
  ballSize: number;
  background: string;
  vibration: VibrationMode;
}

export interface Thread {
  id: string;
  title: string;
  /** pending = start picker; guided = AI; free = BLS only. Locked after choice. */
  mode: SessionKind;
  phase: ProtocolPhase;
  target?: string;
  negativeCognition?: string;
  positiveCognition?: string;
  suds?: number;
  voc?: number;
  summary?: string;
  /** User-facing note under the session title (not AI clinical summary). */
  description?: string;
  /** True once Phase 1 intake for this thread agreed a starting target. */
  intakeComplete?: boolean;
  /**
   * Language the user writes in (set from their first message). Pins the
   * guide's reply language; `undefined` keeps the English default.
   */
  agentLanguage?: string;
  /**
   * Sets that ran to completion in this thread. A set stopped early does not
   * count: the guide uses this to know a set really happened.
   */
  setCount?: number;
  /**
   * How the most recent set ended. `stopped` means the user cut it short (or
   * something interrupted them) and the phase must not advance from it.
   */
  lastSetOutcome?: "completed" | "stopped";
  incomplete: boolean;
  /**
   * Set when account memory was extracted after guided closure.
   * Server-only for idempotency; may be omitted in older clients.
   */
  memoryExtractedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  role: "agent" | "user";
  content: string;
  createdAt: string;
}

/** How a memory note was created. */
export type MemorySource = "user" | "session" | "import";

export interface Memory {
  id: string;
  title: string;
  body: string;
  /** user = Settings form; session = closed guided extract; import = ChatGPT/Claude. */
  source: MemorySource;
  createdAt: string;
}

export type AiProvider = "deepseek" | "openai" | "claude";

export interface ConnectorConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

/** Per-user preferences only — AI/Voice API keys live in platform settings. */
export interface AppSettings {
  autoVoice: boolean;
}

export const DEFAULT_AI_CONNECTORS = {
  deepseek: { apiKey: "", model: "deepseek-v4-flash", enabled: true },
  // Chat-tuned (not gpt-5* reasoning): short protocol turns, temp control, low latency.
  openai: { apiKey: "", model: "gpt-4.1-mini", enabled: true },
  claude: { apiKey: "", model: "claude-3-5-haiku-latest", enabled: true },
} as const satisfies Record<AiProvider, ConnectorConfig>;

export const DEFAULT_VOICE_CONNECTOR = {
  apiKey: "",
  model: "eleven_multilingual_v2",
  enabled: true,
  voiceId: "EXAVITQu4vr4xnSDxMaL",
} satisfies ConnectorConfig & { voiceId: string };

export const DEFAULT_BLS: BlsSettings = {
  speedPresets: [0.1, 1.0, 5.0],
  activeSpeedPreset: 1,
  repeats: 24,
  repeatPresets: [24, "infinity"],
  activeRepeatPreset: 0,
  setLengthSec: 38,
  soundMuted: false,
  leftSound: "beep-a4",
  rightSound: "finger-snap",
  reverseStereo: false,
  animation: "dot",
  animationPath: "auto",
  brightenFlashes: "off",
  ballColor: "#111111",
  flashColor: "#111111",
  ballSize: 48,
  background: "#ffffff",
  vibration: "soft",
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoVoice: false,
};
