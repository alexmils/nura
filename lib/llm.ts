import type { AiProvider } from "./types";
import type { LlmRuntimeConfig } from "./platform-settings";
import {
  recordLlmUsage,
  type LlmUsagePurpose,
} from "./llm-usage";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatCompletionMeta = {
  userId?: string | null;
  purpose?: LlmUsagePurpose;
};

/** Per-call output controls. Defaults keep the old guide behavior (512 tokens). */
export type ChatCompletionOptions = {
  /** Output token budget. Default 512 (2048 for gpt-5 hidden reasoning). */
  maxTokens?: number;
  /** Ask the provider for a JSON object (DeepSeek / OpenAI `response_format`). */
  json?: boolean;
  /**
   * Turn hidden reasoning off where the provider supports it (DeepSeek V4:
   * `thinking: {type: "disabled"}`). Reasoning tokens count against the output
   * budget, so a structured call can be cut off before its JSON is complete.
   */
  disableThinking?: boolean;
  /**
   * Skip the automatic usage row. The caller records it with
   * `recordCompletionUsage` once it knows the outcome (e.g. interpreter cutoff).
   */
  deferUsage?: boolean;
};

export type ChatCompletionResult = {
  text: string;
  /** Provider stop reason, normalized: "stop" | "length" | other | null. */
  finishReason: string | null;
  provider: AiProvider;
  model: string;
  usage: ParsedUsage | null;
};

type ParsedUsage = {
  promptTokens: number;
  completionTokens: number;
};

const PROVIDER_ORDER: AiProvider[] = ["deepseek", "openai", "claude"];

function envKeyFor(provider: AiProvider): string {
  const envKeys: Record<AiProvider, string | undefined> = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
  };
  return envKeys[provider]?.trim() || "";
}

/** Pick default provider if it has a key; otherwise first enabled connector with a key.
 *  Optional override: force provider and/or model (e.g. Help chat settings). */
export function resolveLlmProvider(
  settings: LlmRuntimeConfig,
  override?: { provider?: AiProvider | null; model?: string | null }
): {
  provider: AiProvider;
  key: string;
  model: string;
} | null {
  const modelOverride = override?.model?.trim() || "";
  const forced =
    override?.provider && PROVIDER_ORDER.includes(override.provider)
      ? override.provider
      : null;

  if (forced) {
    const cfg = settings.connectors[forced];
    if (!cfg || cfg.enabled === false) return null;
    const key = (cfg.apiKey || envKeyFor(forced)).trim();
    if (!key) return null;
    return {
      provider: forced,
      key,
      model: modelOverride || cfg.model,
    };
  }

  const preferred = settings.defaultAiProvider;
  const order: AiProvider[] = [
    preferred,
    ...PROVIDER_ORDER.filter((p) => p !== preferred),
  ];

  for (const provider of order) {
    const cfg = settings.connectors[provider];
    if (!cfg || cfg.enabled === false) continue;
    const key = (cfg.apiKey || envKeyFor(provider)).trim();
    if (!key) continue;
    return {
      provider,
      key,
      model: modelOverride || cfg.model,
    };
  }
  return null;
}

function parseOpenAiUsage(data: unknown): ParsedUsage | null {
  if (!data || typeof data !== "object") return null;
  const usage = (data as { usage?: Record<string, unknown> }).usage;
  if (!usage) return null;
  const prompt = Number(usage.prompt_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? 0);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  if (prompt <= 0 && completion <= 0) return null;
  return { promptTokens: prompt, completionTokens: completion };
}

function parseClaudeUsage(data: unknown): ParsedUsage | null {
  if (!data || typeof data !== "object") return null;
  const usage = (data as { usage?: Record<string, unknown> }).usage;
  if (!usage) return null;
  const prompt = Number(usage.input_tokens ?? 0);
  const completion = Number(usage.output_tokens ?? 0);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  if (prompt <= 0 && completion <= 0) return null;
  return { promptTokens: prompt, completionTokens: completion };
}

function trackUsage(
  meta: ChatCompletionMeta | undefined,
  provider: AiProvider,
  model: string,
  usage: ParsedUsage | null
) {
  if (!meta?.userId || !usage) return;
  void recordLlmUsage({
    userId: meta.userId,
    provider,
    model,
    purpose: meta.purpose ?? "guided_chat",
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  }).catch((err) => console.warn("[llm] usage record failed:", err));
}

/** Record usage for a call made with `deferUsage`, under the final purpose. */
export function recordCompletionUsage(
  meta: ChatCompletionMeta | undefined,
  result: Pick<ChatCompletionResult, "provider" | "model" | "usage">
) {
  trackUsage(meta, result.provider, result.model, result.usage);
}

/**
 * Request body pieces for an OpenAI-compatible chat call (DeepSeek, OpenAI).
 * Pure so tests can pin the interpreter's budget / JSON / thinking flags.
 */
export function openAiCompatibleBodyExtras(
  provider: "deepseek" | "openai",
  model: string,
  opts?: ChatCompletionOptions
): Record<string, unknown> {
  // gpt-5* models reject max_tokens and non-default temperature.
  // They also spend completion budget on hidden reasoning_tokens, so keep
  // headroom so message.content is not empty (finish_reason: length).
  const isOpenAiGpt5 = provider === "openai" && /^gpt-5/i.test(model);
  const budget = opts?.maxTokens ?? (isOpenAiGpt5 ? 2048 : 512);
  const out: Record<string, unknown> =
    provider === "openai"
      ? { max_completion_tokens: budget }
      : { max_tokens: budget };
  if (!isOpenAiGpt5) out.temperature = 0.4;
  if (opts?.json) out.response_format = { type: "json_object" };
  if (opts?.disableThinking && provider === "deepseek") {
    out.thinking = { type: "disabled" };
  }
  return out;
}

export async function chatCompletion(
  settings: LlmRuntimeConfig,
  messages: ChatMessage[],
  meta?: ChatCompletionMeta & {
    provider?: AiProvider | null;
    model?: string | null;
  }
): Promise<string> {
  return (await chatCompletionDetailed(settings, messages, meta)).text;
}

export async function chatCompletionDetailed(
  settings: LlmRuntimeConfig,
  messages: ChatMessage[],
  meta?: ChatCompletionMeta & {
    provider?: AiProvider | null;
    model?: string | null;
  },
  opts?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const resolved = resolveLlmProvider(settings, {
    provider: meta?.provider,
    model: meta?.model,
  });
  if (!resolved) {
    throw new Error(
      "No API key configured for any AI provider (check Admin → AI & Voice)"
    );
  }

  const { provider, key, model } = resolved;

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts?.maxTokens ?? 512,
        system: messages.find((m) => m.role === "system")?.content ?? "",
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const usage = parseClaudeUsage(data);
    if (!opts?.deferUsage) trackUsage(meta, provider, model, usage);
    const stop = typeof data.stop_reason === "string" ? data.stop_reason : null;
    return {
      text: data.content?.[0]?.text ?? "",
      finishReason: stop === "max_tokens" ? "length" : stop === "end_turn" ? "stop" : stop,
      provider,
      model,
      usage,
    };
  }

  const baseUrl =
    provider === "deepseek"
      ? "https://api.deepseek.com"
      : "https://api.openai.com/v1";

  const extras = openAiCompatibleBodyExtras(provider, model, opts);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...extras,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const usage = parseOpenAiUsage(data);
  if (!opts?.deferUsage) trackUsage(meta, provider, model, usage);
  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    finishReason:
      typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
    provider,
    model,
    usage,
  };
}

export async function synthesizeSpeech(
  settings: LlmRuntimeConfig,
  text: string,
  options?: { voiceId?: string; userId?: string | null }
): Promise<ArrayBuffer | null> {
  const cfg = settings.connectors.elevenlabs;
  const key = cfg.apiKey || process.env.ELEVENLABS_API_KEY || "";
  if (!key) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const voiceId =
    options?.voiceId?.trim() || cfg.voiceId || "EXAVITQu4vr4xnSDxMaL";
  const model = cfg.model || "eleven_multilingual_v2";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": key,
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: model,
      }),
    }
  );
  if (!res.ok) return null;

  // ElevenLabs bills per character — store as prompt_tokens for admin cost mix.
  const charCount = Array.from(trimmed).length;
  const userId = options?.userId?.trim();
  if (userId && charCount > 0) {
    void recordLlmUsage({
      userId,
      provider: "elevenlabs",
      model,
      purpose: "voice",
      promptTokens: charCount,
      completionTokens: 0,
    }).catch((err) => console.warn("[llm] voice usage record failed:", err));
  }

  return res.arrayBuffer();
}

/** True when speech-to-text can run (same ElevenLabs key as the guide's voice). */
export function speechToTextConfigured(settings: LlmRuntimeConfig): boolean {
  return Boolean(settings.connectors.elevenlabs.apiKey || process.env.ELEVENLABS_API_KEY);
}

/**
 * Transcribe one recorded utterance (voice mode on iOS and browsers without
 * the Web Speech API). Returns null when STT is not configured.
 */
export async function transcribeSpeech(
  settings: LlmRuntimeConfig,
  audio: Blob,
  options?: { filename?: string; language?: string | null }
): Promise<{ text: string } | null> {
  const key = settings.connectors.elevenlabs.apiKey || process.env.ELEVENLABS_API_KEY || "";
  if (!key) return null;
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("file", audio, options?.filename || "speech.webm");
  const lang = options?.language?.trim().toLowerCase().split(/[-_]/)[0];
  if (lang && /^[a-z]{2,3}$/.test(lang)) form.append("language_code", lang);
  form.append("tag_audio_events", "false");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });
  if (!res.ok) throw new Error(`STT failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}
