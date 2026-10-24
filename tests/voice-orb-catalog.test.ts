import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_VOICE_ORB_ID,
  isVoiceOrbId,
  MIT_ORBKIT_SLUGS,
  NON_COMMERCIAL_ORB_SLUGS,
  normalizeVoiceOrbId,
  normalizeVoiceSounds,
  parseVoiceOrbUpdate,
  VOICE_ORB_BASES,
  VOICE_ORB_IDS,
  VOICE_ORB_OPTIONS,
  voiceOrbOption,
} from "../lib/voice-orb-catalog.ts";
import { VOICE_ORB_LOOKS } from "../app/components/voice/voice-orb-looks.ts";
import { normalizeSettingsForTest } from "../lib/platform-settings.ts";

const orbFile = (base: string) => readFileSync(new URL(`../components/ui/${base}.tsx`, import.meta.url), "utf8");

/** The `colors: [...]` keys and `params: [...]` keys an Orbkit file declares. */
function declared(src: string) {
  const section = (name: string) => {
    const start = src.indexOf(`  ${name}: [`);
    assert.ok(start >= 0, `${name} section`);
    const end = src.indexOf("\n  ]", start);
    return [...src.slice(start, end).matchAll(/key: "([^"]+)"/g)].map((m) => m[1]);
  };
  return { colors: new Set(section("colors")), params: new Set(section("params")) };
}

describe("voice orb allowlist", () => {
  it("offers exactly 10 looks with unique ids and names", () => {
    assert.equal(VOICE_ORB_OPTIONS.length, 10);
    assert.equal(new Set(VOICE_ORB_IDS).size, 10);
    assert.equal(new Set(VOICE_ORB_OPTIONS.map((o) => o.name)).size, 10);
  });

  it("defaults to SHDR-21 and includes it", () => {
    assert.equal(DEFAULT_VOICE_ORB_ID, "shdr-21");
    assert.ok(isVoiceOrbId("shdr-21"));
  });

  it("uses only MIT Orbkit originals, never a non-commercial XorDev port", () => {
    for (const base of VOICE_ORB_BASES) {
      assert.ok((MIT_ORBKIT_SLUGS as readonly string[]).includes(base), base);
      assert.ok(!(NON_COMMERCIAL_ORB_SLUGS as readonly string[]).includes(base), base);
      const src = orbFile(base);
      assert.doesNotMatch(src, /XorDev|non-commercial/i, `${base} carries a non-commercial notice`);
      assert.match(src, /MIT License\.\s*\n \* Copyright \(c\) 2026 zzzzshawn/, `${base} MIT notice`);
    }
    for (const o of VOICE_ORB_OPTIONS) {
      assert.equal(o.license, "MIT");
      assert.ok((VOICE_ORB_BASES as readonly string[]).includes(o.base));
    }
  });

  it("has a lazy loader for every base and nothing else", () => {
    const src = readFileSync(new URL("../app/components/voice/orb-loaders.ts", import.meta.url), "utf8");
    const keys = [...src.matchAll(/^\s+"(shdr-\d+)": \(\) => import\("@\/components\/ui\/(shdr-\d+)"\)/gm)];
    assert.deepEqual(keys.map((m) => m[1]).sort(), [...VOICE_ORB_BASES].sort());
    for (const m of keys) assert.equal(m[1], m[2]);
  });

  it("tunes every look with only keys its orb declares, for all four states", () => {
    for (const o of VOICE_ORB_OPTIONS) {
      const look = VOICE_ORB_LOOKS[o.id];
      assert.ok(look, o.id);
      const { colors, params } = declared(orbFile(o.base));
      for (const s of ["idle", "listening", "thinking", "speaking"] as const) {
        const c = look.colors[s];
        assert.ok(c, `${o.id} ${s}`);
        for (const [k, v] of Object.entries(c)) {
          assert.ok(colors.has(k), `${o.id} colour ${k}`);
          assert.match(v, /^#[0-9a-f]{6}$/i);
        }
      }
      for (const preset of Object.values(look.statePresets ?? {})) {
        for (const k of Object.keys(preset ?? {})) assert.ok(params.has(k), `${o.id} param ${k}`);
      }
    }
  });

  it("keeps SHDR-21 on the brand tints", () => {
    assert.deepEqual(VOICE_ORB_LOOKS["shdr-21"].colors.idle, { light: "#87d539", shadow: "#5a8540" });
    assert.deepEqual(VOICE_ORB_LOOKS["shdr-21"].colors.speaking, { light: "#5ed42a", shadow: "#2f8a22" });
  });

  it("keeps listening / thinking / speaking green on every orb (no gold or orange)", () => {
    const hsl = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
      let h = 0;
      if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
      return { h: (h + 360) % 360, d, l };
    };
    for (const o of VOICE_ORB_OPTIONS) {
      for (const s of ["listening", "thinking", "speaking"] as const) {
        for (const [k, v] of Object.entries(VOICE_ORB_LOOKS[o.id].colors[s])) {
          const { h, d, l } = hsl(v);
          if (d < 0.04) continue; // white / grey
          // Pale cream-lime highlights may lean warm; everything else is green.
          const lo = l >= 0.88 ? 55 : 80;
          assert.ok(h >= lo && h <= 175, `${o.id} ${s} ${k} ${v} hue ${h.toFixed(0)}`);
        }
      }
    }
  });
});

describe("voice orb id validation", () => {
  it("normalizes unknown or hostile values to the default", () => {
    for (const bad of [undefined, null, 3, {}, "", "shdr-01", "shdr-22", "../shdr-21", "shdr-21 ", "SHDR-99"]) {
      const n = normalizeVoiceOrbId(bad);
      assert.ok(isVoiceOrbId(n));
    }
    assert.equal(normalizeVoiceOrbId("shdr-01"), "shdr-21");
    assert.equal(normalizeVoiceOrbId(" SHDR-13 "), "shdr-13");
    assert.equal(voiceOrbOption("nope").id, "shdr-21");
  });

  it("isVoiceOrbId is exact", () => {
    assert.ok(isVoiceOrbId("shdr-16-mint"));
    assert.ok(!isVoiceOrbId("SHDR-16"));
    assert.ok(!isVoiceOrbId("shdr-01"));
    assert.ok(!isVoiceOrbId(21));
  });

  it("parses admin updates strictly", () => {
    assert.deepEqual(parseVoiceOrbUpdate({ orbId: "shdr-13" }), { ok: true, update: { orbId: "shdr-13" } });
    assert.deepEqual(parseVoiceOrbUpdate({ sounds: false }), { ok: true, update: { sounds: false } });
    assert.deepEqual(parseVoiceOrbUpdate({ orbId: "shdr-32", sounds: true }), {
      ok: true,
      update: { orbId: "shdr-32", sounds: true },
    });
    for (const bad of [null, [], "shdr-13", {}, { orbId: "shdr-01" }, { orbId: "x" }, { sounds: "yes" }, { orbId: 13 }]) {
      assert.equal(parseVoiceOrbUpdate(bad).ok, false, JSON.stringify(bad));
    }
  });

  it("sounds default on", () => {
    assert.equal(normalizeVoiceSounds(undefined), true);
    assert.equal(normalizeVoiceSounds("false"), true);
    assert.equal(normalizeVoiceSounds(false), false);
  });

  it("platform settings normalize voiceOrbId and voiceSounds", () => {
    const empty = normalizeSettingsForTest({ siteName: "Nura" });
    assert.equal(empty.voiceOrbId, "shdr-21");
    assert.equal(empty.voiceSounds, true);
    const set = normalizeSettingsForTest({ siteName: "Nura", voiceOrbId: "shdr-29", voiceSounds: false });
    assert.equal(set.voiceOrbId, "shdr-29");
    assert.equal(set.voiceSounds, false);
    const hostile = normalizeSettingsForTest({ siteName: "Nura", voiceOrbId: "shdr-05" });
    assert.equal(hostile.voiceOrbId, "shdr-21");
  });
});
