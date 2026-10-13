import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blsPrefsStorageKey,
  blsSectionDefaultPatch,
  clearBlsPrefs,
  isDefaultBlsSettings,
  loadBlsPrefs,
  migrateVibrationMode,
  parseBlsSettings,
  saveBlsPrefs,
  blsBackgroundIsDark,
} from "../lib/bls-prefs.ts";
import {
  DEFAULT_BLS_SPEED_PRESETS,
  normalizeSpeedPresets,
  clampBlsSpeed,
  BLS_SPEED_MAX,
  BLS_SPEED_MIN,
} from "../lib/bls-speed.ts";
import {
  adjustRepeatMode,
  clampBlsRepeatsCount,
  parseRepeatMode,
  parseRepeatPresetValue,
  repeatsLimit,
  selectRepeatPreset,
  writeRepeatPreset,
} from "../lib/bls-repeats.ts";
import { edgeSound } from "../lib/bls-sounds.ts";
import { DEVICE_VIBRATE_MS } from "../lib/bls-vibrate.ts";
import { adjustBlsToolbarField } from "../lib/bls-toolbar-nav.ts";
import { RUMBLE_PROFILE, VIBRATION_INTENSITY } from "../lib/gamepad.ts";
import { DEFAULT_BLS } from "../lib/types.ts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("blsPrefsStorageKey", () => {
  it("scopes by user id", () => {
    assert.equal(blsPrefsStorageKey(null), "emdr_bls_prefs_v1:anon");
    assert.equal(blsPrefsStorageKey("u1"), "emdr_bls_prefs_v1:u1");
  });
});

describe("speed presets range", () => {
  it("allows 0.1 through 5", () => {
    assert.equal(BLS_SPEED_MIN, 0.1);
    assert.equal(BLS_SPEED_MAX, 5);
    assert.equal(clampBlsSpeed(0.05), 0.1);
    assert.equal(clampBlsSpeed(9), 5);
    assert.equal(clampBlsSpeed(1.25), 1.3);
  });

  it("migrates legacy 0.5/1/2 defaults to 0.1/1/5", () => {
    assert.deepEqual(normalizeSpeedPresets([0.5, 1, 2]), [
      ...DEFAULT_BLS_SPEED_PRESETS,
    ]);
    assert.deepEqual(DEFAULT_BLS.speedPresets, [0.1, 1, 5]);
  });

  it("keeps custom trios inside the new range", () => {
    assert.deepEqual(normalizeSpeedPresets([0.2, 1.5, 4]), [0.2, 1.5, 4]);
  });
});

describe("repeats", () => {
  it("parses string and number counts", () => {
    assert.equal(parseRepeatMode("24"), 24);
    assert.equal(parseRepeatMode(36), 36);
    assert.equal(parseRepeatMode("infinity"), "infinity");
    assert.equal(parseRepeatMode("12"), 12);
    assert.equal(parseRepeatMode("nope"), 24);
  });

  it("clamps and adjusts with arrows", () => {
    assert.equal(clampBlsRepeatsCount(0), 1);
    assert.equal(clampBlsRepeatsCount(2000), 999);
    assert.equal(adjustRepeatMode(24, 1), 25);
    assert.equal(adjustRepeatMode(24, -1), 23);
    assert.equal(adjustRepeatMode(1, -1), 1);
    assert.equal(adjustRepeatMode(999, 1), 999);
    assert.equal(adjustRepeatMode("infinity", -1), 24);
    assert.equal(adjustRepeatMode("infinity", 1), "infinity");
    assert.equal(repeatsLimit(24), 24);
    assert.equal(repeatsLimit("infinity"), Infinity);
  });

  it("treats a blank preset as unlimited and keeps two slots", () => {
    assert.equal(parseRepeatPresetValue(""), "infinity");
    assert.equal(parseRepeatPresetValue("45"), 45);
    assert.equal(parseRepeatPresetValue(null), "infinity");
    assert.equal(parseRepeatPresetValue("nope"), null);
    const selected = selectRepeatPreset([24, "infinity"], 1);
    assert.equal(selected.repeats, "infinity");
    assert.equal(selected.activeRepeatPreset, 1);
    const written = writeRepeatPreset([24, "infinity"], 0, 45);
    assert.deepEqual(written.repeatPresets, [45, "infinity"]);
    assert.equal(written.repeats, 45);
    assert.equal(written.activeRepeatPreset, 0);
  });
});

describe("parseBlsSettings", () => {
  it("returns null for garbage", () => {
    assert.equal(parseBlsSettings(null), null);
    assert.equal(parseBlsSettings("x"), null);
    assert.equal(parseBlsSettings(42), null);
  });

  it("fills defaults for partial objects", () => {
    const parsed = parseBlsSettings({
      ballColor: "#00FF00",
      background: "#FF0000",
      ballSize: 48,
    });
    assert.ok(parsed);
    assert.equal(parsed!.ballColor, "#00ff00");
    assert.equal(parsed!.background, "#ff0000");
    assert.equal(parsed!.ballSize, 48);
    assert.equal(parsed!.soundMuted, DEFAULT_BLS.soundMuted);
    assert.equal(parsed!.leftSound, DEFAULT_BLS.leftSound);
    assert.equal(parsed!.rightSound, DEFAULT_BLS.rightSound);
    assert.equal(parsed!.animation, DEFAULT_BLS.animation);
    assert.equal(parsed!.animationPath, "auto");
    assert.equal(parsed!.repeats, DEFAULT_BLS.repeats);
    assert.deepEqual(parsed!.repeatPresets, [24, "infinity"]);
    assert.equal(parsed!.flashColor, DEFAULT_BLS.flashColor);
  });

  it("clamps speed, size, and rejects bad enums/colors", () => {
    const parsed = parseBlsSettings({
      speedPresets: [0.05, 9, 1.25],
      activeSpeedPreset: 1,
      ballSize: 999,
      ballColor: "red",
      background: "#fff",
      sound: "laser",
      animation: "spin",
      repeats: "bad",
      vibration: "mega",
      setLengthSec: 3,
    });
    assert.ok(parsed);
    assert.deepEqual(parsed!.speedPresets, [0.1, 5, 1.3]);
    assert.equal(parsed!.ballSize, 80);
    assert.equal(parsed!.ballColor, DEFAULT_BLS.ballColor);
    assert.equal(parsed!.background, DEFAULT_BLS.background);
    assert.equal(parsed!.soundMuted, DEFAULT_BLS.soundMuted);
    assert.equal(parsed!.leftSound, DEFAULT_BLS.leftSound);
    assert.equal(parsed!.animation, DEFAULT_BLS.animation);
    assert.equal(parsed!.repeats, DEFAULT_BLS.repeats);
    assert.equal(parsed!.vibration, DEFAULT_BLS.vibration);
    assert.equal(parsed!.setLengthSec, 10);
  });

  it("migrates legacy speed defaults and accepts numeric repeats", () => {
    const parsed = parseBlsSettings({
      speedPresets: [0.5, 1.0, 2.0],
      activeSpeedPreset: 1,
      repeats: "36",
      setLengthSec: 38,
      sound: "click",
      animation: "dot",
      ballColor: "#22c55e",
      ballSize: 48,
      background: "#ef4444",
      vibration: "soft",
    });
    assert.ok(parsed);
    assert.deepEqual(parsed!.speedPresets, [0.1, 1, 5]);
    assert.equal(parsed!.repeats, 36);
    assert.deepEqual(parsed!.repeatPresets, [36, "infinity"]);
    assert.equal(parsed!.activeRepeatPreset, 0);
    assert.equal(parsed!.soundMuted, false);
    assert.equal(parsed!.leftSound, "finger-snap");
    assert.equal(parsed!.rightSound, "finger-snap");
    assert.equal(parsed!.vibration, "soft");
    assert.equal(parsed!.animationPath, "auto");
  });

  it("migrates legacy sound and vibration values", () => {
    const pulse = parseBlsSettings({ sound: "pulse", vibration: "hard" });
    assert.equal(pulse!.leftSound, "beep-g3");
    assert.equal(pulse!.rightSound, "beep-g3");
    assert.equal(pulse!.soundMuted, false);
    assert.equal(pulse!.vibration, "hard");

    const tone = parseBlsSettings({ sound: "tone", vibration: "none" });
    assert.equal(tone!.leftSound, "beep-a4");
    assert.equal(tone!.rightSound, "beep-a4");
    assert.equal(tone!.vibration, "off");

    const muted = parseBlsSettings({ sound: "mute" });
    assert.equal(muted!.soundMuted, true);
    assert.equal(muted!.leftSound, DEFAULT_BLS.leftSound);
    assert.equal(muted!.rightSound, DEFAULT_BLS.rightSound);

    assert.equal(migrateVibrationMode("subtle"), "subtle");
    assert.equal(migrateVibrationMode("hard"), "hard");
    assert.equal(migrateVibrationMode("mega"), "soft");
  });

  it("keeps Hard as the strongest vibration and persists it", () => {
    const parsed = parseBlsSettings({ vibration: "hard" });
    assert.equal(parsed!.vibration, "hard");

    const stored = memoryStorage();
    saveBlsPrefs("user-1", { ...DEFAULT_BLS, vibration: "hard" }, stored);
    assert.equal(loadBlsPrefs("user-1", stored).vibration, "hard");

    const normal = RUMBLE_PROFILE.normal;
    const hard = RUMBLE_PROFILE.hard;
    assert.ok(normal && hard);
    assert.equal(hard.weakMagnitude, 1);
    assert.equal(hard.strongMagnitude, 1);
    assert.ok(hard.weakMagnitude > normal.weakMagnitude);
    assert.ok(hard.strongMagnitude >= normal.strongMagnitude);
    assert.ok(hard.duration > normal.duration);
    assert.equal(VIBRATION_INTENSITY.hard, 1);
    assert.ok(VIBRATION_INTENSITY.hard >= VIBRATION_INTENSITY.normal);

    const normalOn = Array.isArray(DEVICE_VIBRATE_MS.normal)
      ? DEVICE_VIBRATE_MS.normal.filter((_, i) => i % 2 === 0).reduce((sum, ms) => sum + ms, 0)
      : DEVICE_VIBRATE_MS.normal;
    const hardOn = Array.isArray(DEVICE_VIBRATE_MS.hard)
      ? DEVICE_VIBRATE_MS.hard.filter((_, i) => i % 2 === 0).reduce((sum, ms) => sum + ms, 0)
      : DEVICE_VIBRATE_MS.hard;
    assert.ok(hardOn > normalOn);

    const stepped = adjustBlsToolbarField(
      { ...DEFAULT_BLS, vibration: "normal" },
      "vibration",
      1
    );
    assert.equal(stepped.vibration, "hard");
  });

  it("keeps explicit stereo presets and a blank unlimited slot", () => {
    const parsed = parseBlsSettings({
      repeats: 12,
      repeatPresets: [45, ""],
      activeRepeatPreset: 1,
      soundMuted: false,
      leftSound: "beep-c5",
      rightSound: "hi-hat",
      reverseStereo: true,
      animationPath: "diagonal-up",
      brightenFlashes: "standard",
      flashColor: "#ABCDEF",
      vibration: "subtle",
    });
    assert.ok(parsed);
    assert.deepEqual(parsed!.repeatPresets, [45, "infinity"]);
    assert.equal(parsed!.activeRepeatPreset, 1);
    assert.equal(parsed!.repeats, "infinity");
    assert.equal(parsed!.leftSound, "beep-c5");
    assert.equal(parsed!.rightSound, "hi-hat");
    assert.equal(parsed!.reverseStereo, true);
    assert.equal(parsed!.animationPath, "diagonal-up");
    assert.equal(parsed!.brightenFlashes, "standard");
    assert.equal(parsed!.flashColor, "#abcdef");
    assert.equal(parsed!.vibration, "subtle");
  });

  it("accepts a full custom Look + dock prefs", () => {
    const custom = {
      speedPresets: [0.1, 1.0, 5.0] as [number, number, number],
      activeSpeedPreset: 1 as const,
      repeats: 24,
      setLengthSec: 38,
      soundMuted: false,
      leftSound: "beep-a4" as const,
      rightSound: "sticks" as const,
      reverseStereo: false,
      animation: "dot" as const,
      animationPath: "horizontal" as const,
      brightenFlashes: "off" as const,
      ballColor: "#22c55e",
      flashColor: "#111111",
      background: "#ef4444",
      ballSize: 48,
      vibration: "soft" as const,
      repeatPresets: [24, "infinity"] as [number, "infinity"],
      activeRepeatPreset: 0 as const,
    };
    const parsed = parseBlsSettings(custom);
    assert.deepEqual(parsed, {
      ...custom,
      ballColor: "#22c55e",
      background: "#ef4444",
    });
    assert.equal(isDefaultBlsSettings(parsed!), false);
  });
});

describe("load/save/clearBlsPrefs", () => {
  it("round-trips through storage and clears on reset", () => {
    const store = memoryStorage();
    const custom = {
      ...DEFAULT_BLS,
      speedPresets: [0.1, 1.0, 5.0] as [number, number, number],
      ballColor: "#22c55e",
      background: "#ef4444",
      ballSize: 48,
    };
    saveBlsPrefs("user-a", custom, store);
    const loaded = loadBlsPrefs("user-a", store);
    assert.equal(loaded.ballColor, "#22c55e");
    assert.equal(loaded.background, "#ef4444");

    clearBlsPrefs("user-a", store);
    const after = loadBlsPrefs("user-a", store);
    assert.equal(isDefaultBlsSettings(after), true);
  });

  it("keeps anon and user keys separate", () => {
    const store = memoryStorage();
    saveBlsPrefs(null, { ...DEFAULT_BLS, background: "#111111" }, store);
    saveBlsPrefs("u2", { ...DEFAULT_BLS, background: "#abcdef" }, store);
    assert.equal(loadBlsPrefs(null, store).background, "#111111");
    assert.equal(loadBlsPrefs("u2", store).background, "#abcdef");
  });
});

describe("stereo edge and section defaults", () => {
  it("pans the chosen sound and can swap the pair", () => {
    assert.deepEqual(edgeSound("left", "beep-a4", "finger-snap", false), {
      id: "beep-a4",
      pan: -1,
    });
    assert.deepEqual(edgeSound("right", "beep-a4", "finger-snap", true), {
      id: "beep-a4",
      pan: 1,
    });
  });

  it("restores one section at a time", () => {
    const sound = blsSectionDefaultPatch("sound");
    assert.equal(sound.leftSound, "beep-a4");
    assert.equal(sound.rightSound, "finger-snap");
    assert.equal(sound.soundMuted, false);
    assert.equal(sound.reverseStereo, false);
    const repeats = blsSectionDefaultPatch("repeats");
    assert.deepEqual(repeats.repeatPresets, [24, "infinity"]);
    assert.equal(repeats.repeats, 24);
    const look = blsSectionDefaultPatch("look");
    assert.equal(look.flashColor, "#111111");
    assert.equal(look.ballColor, "#111111");
  });
});

describe("isDefaultBlsSettings", () => {
  it("matches DEFAULT_BLS", () => {
    assert.equal(isDefaultBlsSettings(DEFAULT_BLS), true);
    assert.equal(
      isDefaultBlsSettings({ ...DEFAULT_BLS, ballColor: "#000001" }),
      false
    );
  });
});

describe("blsBackgroundIsDark", () => {
  it("classifies white/mint as light and red/black as dark", () => {
    assert.equal(blsBackgroundIsDark("#ffffff"), false);
    assert.equal(blsBackgroundIsDark("#dff5e0"), false);
    assert.equal(blsBackgroundIsDark("#ef4444"), true);
    assert.equal(blsBackgroundIsDark("#000000"), true);
    assert.equal(blsBackgroundIsDark("nope"), false);
  });
});
