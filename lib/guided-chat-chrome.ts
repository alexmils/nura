/**
 * Guided chat chrome themes (avatar + bubbles + composer + Voice CTA).
 * Shared by design lab, Admin Platform picker, and AgentOverlay.
 * Colors stay on Nura pistachio tokens only.
 */

export const GUIDED_CHAT_CHROME_MIN = 1;
export const GUIDED_CHAT_CHROME_MAX = 20;
export const DEFAULT_GUIDED_CHAT_CHROME_ID = 1;

const CIRCLE = "/brand/nura-circle-variants";

export type GuidedChatTheme = {
  cardBg: string;
  text: string;
  muted: string;
  agentBg: string;
  agentBorder: string;
  agentText: string;
  userBg: string;
  userBorder: string;
  userText: string;
  userAvatarBg: string;
  userAvatarFg: string;
  speak: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  composerBg: string;
  composerBorder: string;
  mic: string;
  placeholder: string;
  voiceBg: string;
  voiceFg: string;
  voiceBorder: string;
};

export type GuidedChatChrome = {
  id: number;
  set: "A" | "B";
  title: string;
  note: string;
  avatar: string;
  theme: GuidedChatTheme;
};

export const DEFAULT_GUIDED_CHAT_THEME: GuidedChatTheme = {
  cardBg: "#ffffff",
  text: "#2A3020",
  muted: "#948F4E",
  agentBg: "color-mix(in srgb, #f7fdf7 82%, #c8d2c4 18%)",
  agentBorder: "color-mix(in srgb, #c8d2c4 55%, transparent)",
  agentText: "#2A3020",
  userBg: "color-mix(in srgb, #84B067 22%, #f7fdf7)",
  userBorder: "color-mix(in srgb, #84B067 40%, transparent)",
  userText: "#2A3020",
  userAvatarBg: "color-mix(in srgb, #84B067 18%, #edf9ed)",
  userAvatarFg: "#2A3020",
  speak: "#84B067",
  chipBg: "#ffffff",
  chipBorder: "color-mix(in srgb, #84B067 45%, transparent)",
  chipText: "#2A3020",
  composerBg: "#ffffff",
  composerBorder: "color-mix(in srgb, #2A3020 14%, transparent)",
  mic: "#2A3020",
  placeholder: "#948F4E",
  voiceBg: "#2A3020",
  voiceFg: "#C6D67E",
  voiceBorder: "none",
};

function withVoice(
  voiceBg: string,
  voiceFg: string,
  voiceBorder = "none",
  partial: Partial<GuidedChatTheme> = {}
): GuidedChatTheme {
  return {
    ...DEFAULT_GUIDED_CHAT_THEME,
    ...partial,
    voiceBg,
    voiceFg,
    voiceBorder,
  };
}

function entry(
  id: number,
  set: "A" | "B",
  title: string,
  note: string,
  avatar: string,
  theme: GuidedChatTheme
): GuidedChatChrome {
  return { id, set, title, note, avatar, theme };
}

/** All 20 selectable chrome looks (platform setting). */
export const GUIDED_CHAT_CHROMES: GuidedChatChrome[] = [
  entry(
    1,
    "A",
    "Current",
    "A sage · ink + pistachio wave",
    `${CIRCLE}/A-white-on-sage-128.png`,
    withVoice("#2A3020", "#C6D67E")
  ),
  entry(
    2,
    "A",
    "Recommended",
    "C sidebar · sage + white wave",
    `${CIRCLE}/C-white-on-sidebar-128.png`,
    withVoice("#84B067", "#FFFFFF")
  ),
  entry(
    3,
    "A",
    "Soft pair",
    "A sage · sage + white wave",
    `${CIRCLE}/A-white-on-sage-128.png`,
    withVoice("#84B067", "#FFFFFF")
  ),
  entry(
    4,
    "A",
    "Outline voice",
    "A sage · white fill + sage border",
    `${CIRCLE}/A-white-on-sage-128.png`,
    withVoice("#FFFFFF", "#84B067", "1.5px solid #84B067")
  ),
  entry(
    5,
    "A",
    "Ink family",
    "C sidebar · ink + pistachio wave",
    `${CIRCLE}/C-white-on-sidebar-128.png`,
    withVoice("#2A3020", "#C6D67E")
  ),
  entry(
    6,
    "A",
    "Deep ink mark",
    "D ink · sage + white wave",
    `${CIRCLE}/D-white-on-ink-128.png`,
    withVoice("#84B067", "#FFFFFF")
  ),
  entry(
    7,
    "A",
    "Mint mark",
    "N ink on mint · sage + white wave",
    `${CIRCLE}/N-ink-on-mint-128.png`,
    withVoice("#84B067", "#FFFFFF")
  ),
  entry(
    8,
    "A",
    "Pistachio mark",
    "H black on pistachio · sage + white",
    `${CIRCLE}/H-black-on-pistachio-128.png`,
    withVoice("#84B067", "#FFFFFF")
  ),
  entry(
    9,
    "A",
    "Olive mark",
    "E white on olive · sage + white",
    `${CIRCLE}/E-white-on-olive-128.png`,
    withVoice("#84B067", "#FFFFFF")
  ),
  entry(
    10,
    "A",
    "Pistachio CTA",
    "C sidebar · pistachio fill + ink wave",
    `${CIRCLE}/C-white-on-sidebar-128.png`,
    withVoice("#C6D67E", "#2A3020")
  ),
  entry(
    11,
    "B",
    "Clinic paper",
    "Page mint · ink text · sage Voice · C",
    `${CIRCLE}/C-white-on-sidebar-128.png`,
    withVoice("#84B067", "#FFFFFF", "none", {
      cardBg: "#EDF9ED",
      agentBg: "#FFFFFF",
      agentBorder: "color-mix(in srgb, #84B067 28%, transparent)",
      userBg: "#A4EDA5",
      userBorder: "color-mix(in srgb, #84B067 35%, transparent)",
      userAvatarBg: "#84B067",
      userAvatarFg: "#FFFFFF",
      speak: "#3D4129",
      chipBorder: "#84B067",
      composerBorder: "color-mix(in srgb, #3D4129 18%, transparent)",
      mic: "#3D4129",
    })
  ),
  entry(
    12,
    "B",
    "Sage wash",
    "Strong sage user · cool agent · A · sage Voice",
    `${CIRCLE}/A-white-on-sage-128.png`,
    withVoice("#84B067", "#FFFFFF", "none", {
      agentBg: "#F3F6F1",
      agentBorder: "#D5DED0",
      userBg: "color-mix(in srgb, #84B067 38%, #FFFFFF)",
      userBorder: "#84B067",
      userAvatarBg: "#C6D67E",
      chipBg: "color-mix(in srgb, #84B067 12%, #FFFFFF)",
      chipBorder: "#84B067",
      composerBg: "#F7FDF7",
      composerBorder: "#84B067",
      mic: "#84B067",
      placeholder: "#6F7A52",
    })
  ),
  entry(
    13,
    "B",
    "Ink on mint",
    "Paper agent · darker copy · pistachio Voice",
    `${CIRCLE}/N-ink-on-mint-128.png`,
    withVoice("#C6D67E", "#2A3020", "none", {
      text: "#1E2418",
      muted: "#6B6740",
      agentBg: "#A4EDA5",
      agentBorder: "color-mix(in srgb, #84B067 40%, transparent)",
      agentText: "#1E2418",
      userBg: "#EDF9ED",
      userBorder: "#C6D67E",
      userText: "#1E2418",
      userAvatarBg: "#3D4129",
      userAvatarFg: "#C6D67E",
      speak: "#2A3020",
      chipBg: "#EDF9ED",
      chipBorder: "#3D4129",
      composerBorder: "#3D4129",
      placeholder: "#5C5840",
    })
  ),
  entry(
    14,
    "B",
    "Sidebar calm",
    "Sidebar chips · C · sage Voice",
    `${CIRCLE}/C-white-on-sidebar-128.png`,
    withVoice("#84B067", "#FFFFFF", "none", {
      cardBg: "#FAFCF8",
      agentBg: "#FFFFFF",
      agentBorder: "color-mix(in srgb, #3D4129 12%, transparent)",
      userBg: "color-mix(in srgb, #3D4129 8%, #EDF9ED)",
      userBorder: "color-mix(in srgb, #3D4129 20%, transparent)",
      userAvatarBg: "#3D4129",
      userAvatarFg: "#FFFFFF",
      chipBg: "#3D4129",
      chipBorder: "#3D4129",
      chipText: "#EDF9ED",
      composerBorder: "color-mix(in srgb, #3D4129 22%, transparent)",
      mic: "#3D4129",
    })
  ),
  entry(
    15,
    "B",
    "Olive quiet",
    "Olive muted · E · outline Voice",
    `${CIRCLE}/E-white-on-olive-128.png`,
    withVoice("#FFFFFF", "#948F4E", "1.5px solid #948F4E", {
      cardBg: "#F6F5EF",
      agentBg: "#EFEDE3",
      agentBorder: "color-mix(in srgb, #948F4E 35%, transparent)",
      userBg: "color-mix(in srgb, #948F4E 22%, #FFFFFF)",
      userBorder: "#948F4E",
      userAvatarBg: "#948F4E",
      userAvatarFg: "#FFFFFF",
      speak: "#948F4E",
      chipBorder: "#948F4E",
      composerBorder: "color-mix(in srgb, #948F4E 45%, transparent)",
      mic: "#948F4E",
    })
  ),
  entry(
    16,
    "B",
    "High contrast",
    "Sage user bubble · D · ink Voice + mint wave",
    `${CIRCLE}/D-white-on-ink-128.png`,
    withVoice("#2A3020", "#A4EDA5", "none", {
      muted: "#5A5640",
      agentBg: "#EDF9ED",
      agentBorder: "#2A3020",
      userBg: "#84B067",
      userBorder: "#6F9A58",
      userText: "#FFFFFF",
      userAvatarBg: "#2A3020",
      userAvatarFg: "#C6D67E",
      speak: "#2A3020",
      chipBorder: "#2A3020",
      composerBorder: "#2A3020",
      placeholder: "#5A5640",
    })
  ),
  entry(
    17,
    "B",
    "Filled chips",
    "Sage chips · mint agent · H · sage Voice",
    `${CIRCLE}/H-black-on-pistachio-128.png`,
    withVoice("#84B067", "#FFFFFF", "none", {
      agentBg: "#EDF9ED",
      agentBorder: "transparent",
      userBg: "#C6D67E",
      userBorder: "transparent",
      userAvatarBg: "#A4EDA5",
      chipBg: "#84B067",
      chipBorder: "#84B067",
      chipText: "#FFFFFF",
      composerBg: "#EDF9ED",
      composerBorder: "transparent",
      placeholder: "#6B7348",
    })
  ),
  entry(
    18,
    "B",
    "Mint composer",
    "Paper composer · O · ink Voice + mint wave",
    `${CIRCLE}/O-mint-on-ink-128.png`,
    withVoice("#2A3020", "#A4EDA5", "none", {
      agentBg: "#F4F7F2",
      agentBorder: "#D0D9CC",
      userBg: "color-mix(in srgb, #A4EDA5 55%, #FFFFFF)",
      userBorder: "#A4EDA5",
      userAvatarBg: "#EDF9ED",
      userAvatarFg: "#3D4129",
      chipBorder: "#A4EDA5",
      chipText: "#3D4129",
      composerBg: "#A4EDA5",
      composerBorder: "color-mix(in srgb, #84B067 40%, transparent)",
      placeholder: "#3D4129",
    })
  ),
  entry(
    19,
    "B",
    "Soft dual",
    "Gray-mint agent · sage user · A · outline Voice",
    `${CIRCLE}/A-white-on-sage-128.png`,
    withVoice("#FFFFFF", "#84B067", "1.5px solid #84B067", {
      agentBg: "#EEF1EC",
      agentBorder: "#D2D8CE",
      userBg: "color-mix(in srgb, #84B067 28%, #FFFFFF)",
      userBorder: "color-mix(in srgb, #84B067 50%, transparent)",
      userAvatarBg: "color-mix(in srgb, #84B067 25%, #FFFFFF)",
      speak: "#6F9A58",
      chipBorder: "#B5C4AE",
      chipText: "#3D4129",
      composerBorder: "#C5CFC0",
      mic: "#6F7A68",
      placeholder: "#8A917C",
    })
  ),
  entry(
    20,
    "B",
    "Brand punch",
    "Sidebar chips · Paper user · C · pistachio Voice",
    `${CIRCLE}/C-white-on-sidebar-128.png`,
    withVoice("#C6D67E", "#2A3020", "none", {
      muted: "#3D4129",
      agentBg: "#EDF9ED",
      agentBorder: "#3D4129",
      userBg: "#A4EDA5",
      userBorder: "#84B067",
      userAvatarBg: "#84B067",
      userAvatarFg: "#FFFFFF",
      speak: "#3D4129",
      chipBg: "#3D4129",
      chipBorder: "#3D4129",
      chipText: "#C6D67E",
      composerBorder: "#3D4129",
      mic: "#3D4129",
      placeholder: "#5C6148",
    })
  ),
];

export function clampGuidedChatChromeId(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_GUIDED_CHAT_CHROME_ID;
  return Math.min(
    GUIDED_CHAT_CHROME_MAX,
    Math.max(GUIDED_CHAT_CHROME_MIN, Math.round(n))
  );
}

export function resolveGuidedChatChrome(id: unknown): GuidedChatChrome {
  const n = clampGuidedChatChromeId(id);
  return (
    GUIDED_CHAT_CHROMES.find((c) => c.id === n) ?? GUIDED_CHAT_CHROMES[0]!
  );
}

/** CSS custom properties for `.agent-overlay` / lab cards. */
export function guidedChatChromeCssVars(
  theme: GuidedChatTheme
): Record<string, string> {
  return {
    "--gc-card-bg": theme.cardBg,
    "--gc-text": theme.text,
    "--gc-muted": theme.muted,
    "--gc-agent-bg": theme.agentBg,
    "--gc-agent-border": theme.agentBorder,
    "--gc-agent-text": theme.agentText,
    "--gc-user-bg": theme.userBg,
    "--gc-user-border": theme.userBorder,
    "--gc-user-text": theme.userText,
    "--gc-user-avatar-bg": theme.userAvatarBg,
    "--gc-user-avatar-fg": theme.userAvatarFg,
    "--gc-speak": theme.speak,
    "--gc-chip-bg": theme.chipBg,
    "--gc-chip-border": theme.chipBorder,
    "--gc-chip-text": theme.chipText,
    "--gc-composer-bg": theme.composerBg,
    "--gc-composer-border": theme.composerBorder,
    "--gc-mic": theme.mic,
    "--gc-placeholder": theme.placeholder,
    "--gc-voice-bg": theme.voiceBg,
    "--gc-voice-fg": theme.voiceFg,
    "--gc-voice-border": theme.voiceBorder,
  };
}
