import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTypingTarget,
  VOICE_HOTKEY_TITLES,
  voiceHotkeyAction,
} from "../lib/voice-hotkeys.ts";

const body = { tagName: "BODY", closest: () => null };

describe("voice mode keyboard shortcuts", () => {
  it("S ends voice mode, case-insensitive", () => {
    assert.equal(voiceHotkeyAction({ key: "s", target: body }), "end");
    assert.equal(voiceHotkeyAction({ key: "S", target: body }), "end");
  });

  it("M toggles the mic, case-insensitive", () => {
    assert.equal(voiceHotkeyAction({ key: "m", target: body }), "toggleMute");
    assert.equal(voiceHotkeyAction({ key: "M", target: body }), "toggleMute");
  });

  it("other keys do nothing", () => {
    for (const key of ["a", "Enter", " ", "Escape", "1", "ArrowDown"]) {
      assert.equal(voiceHotkeyAction({ key, target: body }), null, key);
    }
  });

  it("ignores Ctrl / Cmd / Alt combinations (Ctrl+S, Cmd+M stay with the browser)", () => {
    assert.equal(voiceHotkeyAction({ key: "s", ctrlKey: true, target: body }), null);
    assert.equal(voiceHotkeyAction({ key: "s", metaKey: true, target: body }), null);
    assert.equal(voiceHotkeyAction({ key: "m", altKey: true, target: body }), null);
  });

  it("ignores key repeat, IME composition and handled events", () => {
    assert.equal(voiceHotkeyAction({ key: "s", repeat: true, target: body }), null);
    assert.equal(voiceHotkeyAction({ key: "m", repeat: true, target: body }), null);
    assert.equal(voiceHotkeyAction({ key: "s", isComposing: true, target: body }), null);
    assert.equal(voiceHotkeyAction({ key: "s", defaultPrevented: true, target: body }), null);
  });

  it("ignores typing in inputs, textareas and contenteditable", () => {
    const targets = [
      { tagName: "INPUT", type: "text" },
      { tagName: "INPUT", type: "search" },
      { tagName: "INPUT" },
      { tagName: "TEXTAREA" },
      { tagName: "SELECT" },
      { tagName: "DIV", isContentEditable: true },
      { tagName: "SPAN", closest: (sel: string) => (sel.includes("contenteditable") ? {} : null) },
    ];
    for (const target of targets) {
      assert.equal(voiceHotkeyAction({ key: "s", target }), null, JSON.stringify(target));
      assert.equal(voiceHotkeyAction({ key: "m", target }), null, JSON.stringify(target));
    }
    // A focused button or checkbox is not typing.
    assert.equal(isTypingTarget({ tagName: "BUTTON", closest: () => null }), false);
    assert.equal(isTypingTarget({ tagName: "INPUT", type: "checkbox" }), false);
    assert.equal(voiceHotkeyAction({ key: "s", target: { tagName: "BUTTON", closest: () => null } }), "end");
  });

  it("does nothing while voice mode is already ending (one end, one chime)", () => {
    assert.equal(voiceHotkeyAction({ key: "s", target: body }, { exiting: true }), null);
    assert.equal(voiceHotkeyAction({ key: "m", target: body }, { exiting: true }), null);
  });

  it("M is inactive when the mic button is replaced by Resume", () => {
    assert.equal(voiceHotkeyAction({ key: "m", target: body }, { canToggleMute: false }), null);
    assert.equal(voiceHotkeyAction({ key: "s", target: body }, { canToggleMute: false }), "end");
  });

  it("works on non-Latin keyboard layouts by physical key", () => {
    assert.equal(voiceHotkeyAction({ key: "\u0441", code: "KeyS", target: body }), "end");
    assert.equal(voiceHotkeyAction({ key: "\u043c", code: "KeyM", target: body }), "toggleMute");
  });

  it("exposes English tooltips", () => {
    assert.equal(VOICE_HOTKEY_TITLES.end, "End voice (S)");
    assert.equal(VOICE_HOTKEY_TITLES.mute, "Mute (M)");
    assert.equal(VOICE_HOTKEY_TITLES.unmute, "Unmute (M)");
  });
});
