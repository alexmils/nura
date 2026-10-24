/**
 * Composer dictation helpers (mic button in the guided chat).
 *
 * UI strings are English on purpose (the app chrome is always English).
 * Only the recogniser language follows the session, because that is what
 * makes the browser transcribe the words the person actually speaks.
 */

export type DictationState = "off" | "starting" | "listening";

export const COMPOSER_STRINGS = {
  startTalking: "Start talking\u2026",
  listening: "Listening\u2026",
  sessionClosed: "This session is closed",
  dictate: "Dictate",
  stopDictation: "Stop dictation",
} as const;

/**
 * Placeholder override while dictating. `heard` flips once speech is detected
 * or the first transcript arrives. Null when dictation is off, so the normal
 * composer placeholder applies.
 */
export function dictationPlaceholder(state: DictationState, heard: boolean): string | null {
  if (state === "off") return null;
  return heard ? COMPOSER_STRINGS.listening : COMPOSER_STRINGS.startTalking;
}

/** Region defaults for session codes whose bare tag recognisers handle badly. */
const SPEECH_LANG_TAGS: Record<string, string> = {
  en: "en-US",
  sr: "sr-RS",
  hr: "hr-HR",
  bs: "bs-BA",
  sl: "sl-SI",
  mk: "mk-MK",
  bg: "bg-BG",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  pt: "pt-PT",
  nl: "nl-NL",
  ru: "ru-RU",
  uk: "uk-UA",
  pl: "pl-PL",
  cs: "cs-CZ",
  sk: "sk-SK",
  ro: "ro-RO",
  hu: "hu-HU",
  el: "el-GR",
  tr: "tr-TR",
  sv: "sv-SE",
  da: "da-DK",
  nb: "nb-NO",
  fi: "fi-FI",
  he: "he-IL",
  ar: "ar-SA",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

/**
 * Language tag for the browser speech recogniser. The session language once
 * known; before that the browser's own language; never a blind en-US for a
 * person who speaks something else.
 */
export function dictationSpeechLang(
  sessionLanguage?: string | null,
  browserLanguage?: string | null
): string {
  const code = (sessionLanguage ?? "").trim();
  if (code) {
    if (code === "zh-Hant") return "zh-TW";
    if (code.includes("-")) return code;
    return SPEECH_LANG_TAGS[code.toLowerCase()] ?? code;
  }
  const browser = (browserLanguage ?? "").trim();
  return browser || "en-US";
}

/** Short, human message for a dictation failure (shown under the composer). */
export function dictationErrorMessage(code: string): string {
  switch (code) {
    case "unsupported":
      return "Dictation isn\u2019t supported in this browser. Try Chrome, Edge or Safari.";
    case "not-allowed":
      return "Microphone access is blocked. Allow the mic for this site and try again.";
    case "network":
      return "The browser\u2019s speech service could not be reached. Check your connection, or try Chrome or Edge.";
    default:
      // Engine messages talk about voice mode ("Tap Resume"); keep it generic.
      return "The microphone stopped. Tap the mic to try again.";
  }
}