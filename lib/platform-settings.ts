import { ensureSchemaReady, getPool } from "@/lib/db";
import type { AiProvider, ConnectorConfig } from "@/lib/types";
import {
  DEFAULT_AI_CONNECTORS,
  DEFAULT_VOICE_CONNECTOR,
} from "@/lib/types";
import {
  DEFAULT_HELP_SETTINGS,
  normalizeHelpSettings,
  type HelpSettings,
} from "@/lib/help-settings";
import {
  DEFAULT_PLATFORM_ADS,
  normalizeAdsSettings,
  type PlatformAdsSettings,
} from "@/lib/ads";
import { BRAND_SPOKEN, BRAND_SUPPORT_EMAIL, chromeBrandName } from "@/lib/brand";
import {
  clampGuidedChatChromeId,
  DEFAULT_GUIDED_CHAT_CHROME_ID,
} from "@/lib/guided-chat-chrome";
import {
  clampFreeSessionChromeId,
  DEFAULT_FREE_SESSION_CHROME_ID,
} from "@/lib/free-session-chrome";
import {
  DEFAULT_PLATFORM_STRIPE,
  isStripeCredentialSetEmpty,
  normalizeStripeConfig,
  stripeFromEnvFallback,
  type PlatformStripeConfig,
} from "@/lib/stripe-config";
import {
  DEFAULT_PLATFORM_EMAIL,
  emailFromEnvFallback,
  isEmailConfigEmpty,
  normalizeEmailConfig,
  type PlatformEmailConfig,
} from "@/lib/email-config";
import {
  DEFAULT_PLATFORM_SEO,
  normalizeSeoConfig,
  type PlatformSeoConfig,
} from "@/lib/seo-config";
import {
  DEFAULT_PLATFORM_MCP,
  normalizeMcpConfig,
  type PlatformMcpConfig,
} from "@/lib/mcp-settings";
import { normalizeBrandAssetUrl } from "@/lib/brand-assets";

export type { HelpSettings };
export { DEFAULT_HELP_SETTINGS, normalizeHelpSettings };
export type { PlatformAdsSettings };
export { DEFAULT_PLATFORM_ADS, normalizeAdsSettings };
export type { PlatformStripeConfig, StripeCredentialSet } from "@/lib/stripe-config";
export {
  DEFAULT_PLATFORM_STRIPE,
  DEFAULT_STRIPE_CREDENTIALS,
  activeStripeCredentials,
  activeStripeEnv,
} from "@/lib/stripe-config";
export type { PlatformEmailConfig } from "@/lib/email-config";
export {
  DEFAULT_PLATFORM_EMAIL,
  normalizeEmailConfig,
} from "@/lib/email-config";
export type { PlatformSeoConfig } from "@/lib/seo-config";
export {
  DEFAULT_PLATFORM_SEO,
  normalizeSeoConfig,
} from "@/lib/seo-config";
export type { PlatformMcpConfig } from "@/lib/mcp-settings";
export { DEFAULT_PLATFORM_MCP, normalizeMcpConfig } from "@/lib/mcp-settings";

export type PlatformFeatureFlags = {
  voice: boolean;
  memory: boolean;
  blsVibration: boolean;
  sessionInterpreter: boolean;
};

export type PlatformAiConnectors = {
  deepseek: ConnectorConfig;
  openai: ConnectorConfig;
  claude: ConnectorConfig;
};

export type PlatformVoiceConfig = ConnectorConfig & { voiceId: string };

export type PlatformAiConfig = {
  defaultProvider: AiProvider;
  connectors: PlatformAiConnectors;
  voice: PlatformVoiceConfig;
};

export type PlatformSettings = {
  siteName: string;
  supportEmail: string;
  publicAppUrl: string;
  invitesEnabled: boolean;
  maintenanceMessage: string;
  fromName: string;
  fromAddress: string;
  /** Extra protocol notes appended to the session guide system prompt. */
  agentKnowledgeNotes: string;
  flags: PlatformFeatureFlags;
  ai: PlatformAiConfig;
  help: HelpSettings;
  ads: PlatformAdsSettings;
  stripe: PlatformStripeConfig;
  /** Delivery credentials (Brevo / Gmail) — Admin → Email. */
  email: PlatformEmailConfig;
  /** Public-site SEO + marketing tags — Admin → SEO. */
  seo: PlatformSeoConfig;
  /** Blog MCP access token — Admin → MCP. */
  mcp: PlatformMcpConfig;
  /**
   * Browser tab icon (jpeg/png/webp data URL, https, or path).
   * Empty → built-in `/icon.png`.
   */
  faviconUrl: string;
  /**
   * Wordmark for the /app (and admin) dark sidebar.
   * Empty → built-in white wave lockup.
   */
  appLogoUrl: string;
  /**
   * Guided chat chrome look (1–20) — avatar, bubbles, composer, Start voice.
   * Picked in Admin → Platform → General.
   */
  guidedChatChromeId: number;
  /**
   * Free session chrome look (1–10) — header, canvas, controls dock.
   * Picked in Admin → Platform → General.
   */
  freeSessionChromeId: number;
  /** Web Push VAPID for admin PWA (Help inbox). Env VAPID_* overrides when set. */
  adminPush: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };
};

export const DEFAULT_PLATFORM_AI: PlatformAiConfig = {
  // Prefer OpenAI chat models for guided EMDR; resolveLlmProvider falls back if no key.
  defaultProvider: "openai",
  connectors: {
    deepseek: { ...DEFAULT_AI_CONNECTORS.deepseek },
    openai: { ...DEFAULT_AI_CONNECTORS.openai },
    claude: { ...DEFAULT_AI_CONNECTORS.claude },
  },
  voice: { ...DEFAULT_VOICE_CONNECTOR },
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  siteName: "Nura",
  supportEmail: BRAND_SUPPORT_EMAIL,
  publicAppUrl: "",
  invitesEnabled: true,
  maintenanceMessage: "",
  fromName: "Nura",
  fromAddress: "hi@contact.nurahelp.com",
  agentKnowledgeNotes: "",
  flags: {
    voice: true,
    memory: true,
    blsVibration: true,
    sessionInterpreter: true,
  },
  ai: { ...DEFAULT_PLATFORM_AI, connectors: { ...DEFAULT_AI_CONNECTORS }, voice: { ...DEFAULT_VOICE_CONNECTOR } },
  help: { ...DEFAULT_HELP_SETTINGS },
  ads: { ...DEFAULT_PLATFORM_ADS },
  stripe: {
    demoMode: true,
    sandbox: { ...DEFAULT_PLATFORM_STRIPE.sandbox },
    live: { ...DEFAULT_PLATFORM_STRIPE.live },
  },
  email: { ...DEFAULT_PLATFORM_EMAIL },
  seo: { ...DEFAULT_PLATFORM_SEO, pages: {} },
  mcp: { ...DEFAULT_PLATFORM_MCP },
  faviconUrl: "",
  appLogoUrl: "",
  guidedChatChromeId: DEFAULT_GUIDED_CHAT_CHROME_ID,
  freeSessionChromeId: DEFAULT_FREE_SESSION_CHROME_ID,
  adminPush: { publicKey: "", privateKey: "", subject: "" },
};

/** Old user AppSettings mistakenly stored in app_settings (has autoVoice, no siteName). */
function isLegacyUserSettings(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  return "autoVoice" in o && !("siteName" in o);
}

function normalizeConnector(
  raw: Partial<ConnectorConfig> | undefined,
  fallback: ConnectorConfig,
  provider?: AiProvider
): ConnectorConfig {
  let model =
    typeof raw?.model === "string" && raw.model.trim()
      ? raw.model.trim()
      : fallback.model;
  // gpt-5* burns completion tokens on hidden reasoning and rejects temperature —
  // unsuitable for short guided EMDR turns.
  if (provider === "openai" && /^gpt-5/i.test(model)) {
    model = fallback.model;
  }
  return {
    apiKey: typeof raw?.apiKey === "string" ? raw.apiKey : fallback.apiKey,
    model,
    enabled: raw?.enabled !== false,
  };
}

function normalizeAi(raw: unknown): PlatformAiConfig {
  const r =
    raw && typeof raw === "object"
      ? (raw as Partial<PlatformAiConfig> & {
          defaultAiProvider?: AiProvider;
          connectors?: Partial<PlatformAiConnectors> & {
            elevenlabs?: PlatformVoiceConfig;
          };
        })
      : {};

  const provider =
    r.defaultProvider === "openai" ||
    r.defaultProvider === "claude" ||
    r.defaultProvider === "deepseek"
      ? r.defaultProvider
      : r.defaultAiProvider === "openai" ||
          r.defaultAiProvider === "claude" ||
          r.defaultAiProvider === "deepseek"
        ? r.defaultAiProvider
        : DEFAULT_PLATFORM_AI.defaultProvider;

  const voiceRaw = r.voice ?? r.connectors?.elevenlabs;
  const voiceBase = DEFAULT_VOICE_CONNECTOR;

  return {
    defaultProvider: provider,
    connectors: {
      deepseek: normalizeConnector(
        r.connectors?.deepseek,
        DEFAULT_AI_CONNECTORS.deepseek,
        "deepseek"
      ),
      openai: normalizeConnector(
        r.connectors?.openai,
        DEFAULT_AI_CONNECTORS.openai,
        "openai"
      ),
      claude: normalizeConnector(
        r.connectors?.claude,
        DEFAULT_AI_CONNECTORS.claude,
        "claude"
      ),
    },
    voice: {
      ...normalizeConnector(voiceRaw, voiceBase),
      voiceId:
        typeof voiceRaw?.voiceId === "string" && voiceRaw.voiceId.trim()
          ? voiceRaw.voiceId.trim()
          : voiceBase.voiceId,
    },
  };
}

function normalizeSettings(raw: unknown): PlatformSettings {
  if (!raw || typeof raw !== "object" || isLegacyUserSettings(raw)) {
    return {
      ...DEFAULT_PLATFORM_SETTINGS,
      ai: {
        ...DEFAULT_PLATFORM_AI,
        connectors: { ...DEFAULT_AI_CONNECTORS },
        voice: { ...DEFAULT_VOICE_CONNECTOR },
      },
      help: { ...DEFAULT_HELP_SETTINGS },
      ads: { ...DEFAULT_PLATFORM_ADS },
      stripe: {
        demoMode: true,
        sandbox: { ...DEFAULT_PLATFORM_STRIPE.sandbox },
        live: { ...DEFAULT_PLATFORM_STRIPE.live },
      },
      email: { ...DEFAULT_PLATFORM_EMAIL },
      seo: { ...DEFAULT_PLATFORM_SEO, pages: {} },
    };
  }
  const r = raw as Partial<PlatformSettings> & {
    defaultAiProvider?: AiProvider;
    connectors?: PlatformAiConnectors & { elevenlabs?: PlatformVoiceConfig };
  };
  return {
    siteName: chromeBrandName(r.siteName) || BRAND_SPOKEN,
    supportEmail: r.supportEmail?.trim() ?? "",
    publicAppUrl: r.publicAppUrl?.trim() ?? "",
    invitesEnabled: r.invitesEnabled !== false,
    maintenanceMessage: r.maintenanceMessage?.trim() ?? "",
    fromName: chromeBrandName(r.fromName) || BRAND_SPOKEN,
    fromAddress: r.fromAddress?.trim() || DEFAULT_PLATFORM_SETTINGS.fromAddress,
    agentKnowledgeNotes:
      typeof r.agentKnowledgeNotes === "string"
        ? r.agentKnowledgeNotes.slice(0, 4000)
        : "",
    flags: {
      voice: r.flags?.voice !== false,
      memory: r.flags?.memory !== false,
      blsVibration: r.flags?.blsVibration !== false,
      sessionInterpreter: r.flags?.sessionInterpreter !== false,
    },
    ai: normalizeAi(r.ai ?? r),
    help: normalizeHelpSettings(
      (r as Partial<PlatformSettings>).help ?? DEFAULT_HELP_SETTINGS
    ),
    ads: normalizeAdsSettings(
      (r as Partial<PlatformSettings>).ads ?? DEFAULT_PLATFORM_ADS
    ),
    stripe: normalizeStripeConfig((r as Partial<PlatformSettings>).stripe),
    email: normalizeEmailConfig((r as Partial<PlatformSettings>).email),
    seo: normalizeSeoConfig((r as Partial<PlatformSettings>).seo),
    mcp: normalizeMcpConfig((r as Partial<PlatformSettings>).mcp),
    faviconUrl: normalizeBrandAssetUrl(r.faviconUrl),
    appLogoUrl: normalizeBrandAssetUrl(r.appLogoUrl),
    guidedChatChromeId: clampGuidedChatChromeId(r.guidedChatChromeId),
    freeSessionChromeId: clampFreeSessionChromeId(r.freeSessionChromeId),
    adminPush: normalizeAdminPush(
      (r as Partial<PlatformSettings>).adminPush
    ),
  };
}

function normalizeAdminPush(raw: unknown): PlatformSettings["adminPush"] {
  if (!raw || typeof raw !== "object") {
    return { publicKey: "", privateKey: "", subject: "" };
  }
  const r = raw as Partial<PlatformSettings["adminPush"]>;
  return {
    publicKey: typeof r.publicKey === "string" ? r.publicKey.trim() : "",
    privateKey: typeof r.privateKey === "string" ? r.privateKey.trim() : "",
    subject: typeof r.subject === "string" ? r.subject.trim() : "",
  };
}

/** Test helper — same as save/load normalization. */
export function normalizeSettingsForTest(raw: unknown): PlatformSettings {
  return normalizeSettings(raw);
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{ json: unknown }>(
    "SELECT json FROM app_settings WHERE id = 1"
  );
  if (!rows[0]) {
    const seeded = {
      ...DEFAULT_PLATFORM_SETTINGS,
      ai: {
        ...DEFAULT_PLATFORM_AI,
        connectors: { ...DEFAULT_AI_CONNECTORS },
        voice: { ...DEFAULT_VOICE_CONNECTOR },
      },
      stripe: stripeFromEnvFallback({
        demoMode: true,
        sandbox: { ...DEFAULT_PLATFORM_STRIPE.sandbox },
        live: { ...DEFAULT_PLATFORM_STRIPE.live },
      }),
      email: emailFromEnvFallback({ ...DEFAULT_PLATFORM_EMAIL }),
    };
    await savePlatformSettings(seeded);
    return normalizeSettings(seeded);
  }
  let settings = normalizeSettings(rows[0].json);
  const raw = rows[0].json as Partial<PlatformSettings> | null;
  const missingSender =
    isLegacyUserSettings(rows[0].json) ||
    !raw ||
    typeof raw !== "object" ||
    !String((raw as PlatformSettings).fromAddress ?? "").trim();
  const rawStripe = raw && typeof raw === "object" ? raw.stripe : null;
  const legacyFlatStripe =
    !!rawStripe &&
    typeof rawStripe === "object" &&
    !("sandbox" in rawStripe) &&
    !("live" in rawStripe);
  const stripeEmpty =
    isStripeCredentialSetEmpty(settings.stripe.sandbox) &&
    isStripeCredentialSetEmpty(settings.stripe.live);
  const stripeBootstrapped = stripeEmpty
    ? stripeFromEnvFallback(settings.stripe)
    : settings.stripe;
  const needsStripePersist =
    legacyFlatStripe ||
    (stripeEmpty &&
      (!isStripeCredentialSetEmpty(stripeBootstrapped.sandbox) ||
        !isStripeCredentialSetEmpty(stripeBootstrapped.live)));
  if (needsStripePersist) {
    settings = { ...settings, stripe: stripeBootstrapped };
  }
  const rawEmail = raw && typeof raw === "object" ? raw.email : null;
  const emailMissing = !rawEmail || typeof rawEmail !== "object";
  const emailEmpty = isEmailConfigEmpty(settings.email);
  const emailBootstrapped = emailEmpty
    ? emailFromEnvFallback(settings.email)
    : settings.email;
  const needsEmailPersist =
    emailMissing ||
    (emailEmpty && !isEmailConfigEmpty(emailBootstrapped));
  if (needsEmailPersist) {
    settings = { ...settings, email: emailBootstrapped };
  }
  if (missingSender || needsStripePersist || needsEmailPersist) {
    await savePlatformSettings(settings);
  }
  return settings;
}

export async function savePlatformSettings(
  settings: PlatformSettings
): Promise<PlatformSettings> {
  await ensureSchemaReady();
  const normalized = normalizeSettings(settings);
  await getPool().query(
    `INSERT INTO app_settings (id, json) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json`,
    [JSON.stringify(normalized)]
  );
  return normalized;
}

export async function getPublicAppUrl(): Promise<string> {
  const settings = await getPlatformSettings();
  if (settings.publicAppUrl.trim()) {
    return settings.publicAppUrl.replace(/\/$/, "");
  }
  return (process.env.APP_URL ?? "http://localhost:3471").replace(/\/$/, "");
}

/** Runtime shape used by chatCompletion / synthesizeSpeech. */
export type LlmRuntimeConfig = {
  defaultAiProvider: AiProvider;
  connectors: PlatformAiConnectors & {
    elevenlabs: PlatformVoiceConfig;
  };
};

export async function getLlmRuntimeConfig(): Promise<LlmRuntimeConfig> {
  const platform = await getPlatformSettings();
  return {
    defaultAiProvider: platform.ai.defaultProvider,
    connectors: {
      ...platform.ai.connectors,
      elevenlabs: platform.ai.voice,
    },
  };
}
