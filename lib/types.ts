export type ProtocolPhase =
  | "intake"
  | "grounding"
  | "assessment"
  | "desensitization"
  | "installation"
  | "body_scan"
  | "closure";

export type AnimationMode = "dot" | "flash";
export type SoundMode = "mute" | "click" | "pulse" | "tone";
/** Finite pass count (1–999) or unlimited. */
export type RepeatMode = number | "infinity";
export type VibrationMode = "none" | "soft" | "hard";

/** Session start choice: pending until user picks guided or free. */
export type SessionKind = "pending" | "guided" | "free";

export type SpeedPresetIndex = 0 | 1 | 2;

export interface BlsSettings {
  speedPresets: [number, number, number];
  activeSpeedPreset: SpeedPresetIndex;
  repeats: RepeatMode;
  setLengthSec: number;
  sound: SoundMode;
  animation: AnimationMode;
  ballColor: string;
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
  setLengthSec: 38,
  sound: "click",
  animation: "dot",
  ballColor: "#111111",
  ballSize: 48,
  background: "#ffffff",
  vibration: "soft",
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoVoice: false,
};
