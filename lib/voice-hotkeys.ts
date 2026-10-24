/**
 * Keyboard shortcuts while voice mode is open (desktop):
 *   S = end voice mode (same as the End voice button)
 *   M = mute / unmute the microphone (same as the mic button)
 * Case-insensitive. Ignored with Ctrl / Cmd / Alt held, on key repeat, during
 * IME composition, and while focus is in a text field or contenteditable.
 *
 * Pure (no DOM globals), so the rules are pinned by tests; VoiceStage wires it
 * to a window keydown listener that only exists while the stage is mounted.
 */

export type VoiceHotkeyAction = "end" | "toggleMute";

export interface VoiceHotkeyEvent {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

/** Input types that are buttons / toggles, not text entry. */
const NON_TEXT_INPUTS = new Set([
  "button", "checkbox", "radio", "range", "color", "file", "image", "reset", "submit",
]);

type ElementLike = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

/** True when the key press belongs to a text field the user is typing in. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as ElementLike;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el.type ?? el.getAttribute?.("type") ?? "text").toLowerCase();
    return !NON_TEXT_INPUTS.has(type);
  }
  if (typeof el.closest === "function") {
    if (el.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"]')) return true;
  }
  return false;
}

/** Letter the key stands for: the typed character, or the physical key on non-Latin layouts. */
function letterOf(e: VoiceHotkeyEvent): string | null {
  const key = (e.key ?? "").toLowerCase();
  if (/^[a-z]$/.test(key)) return key;
  const code = e.code ?? "";
  const m = /^Key([A-Z])$/.exec(code);
  return m ? m[1]!.toLowerCase() : null;
}

export function voiceHotkeyAction(
  e: VoiceHotkeyEvent,
  opts: { exiting?: boolean; canToggleMute?: boolean } = {}
): VoiceHotkeyAction | null {
  if (e.defaultPrevented || e.repeat || e.isComposing) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (opts.exiting) return null;
  if (isTypingTarget(e.target)) return null;
  const letter = letterOf(e);
  if (letter === "s") return "end";
  if (letter === "m") return opts.canToggleMute === false ? null : "toggleMute";
  return null;
}

/** Tooltip / title text for the two buttons (UI stays English). */
export const VOICE_HOTKEY_TITLES = {
  end: "End voice (S)",
  mute: "Mute (M)",
  unmute: "Unmute (M)",
} as const;
