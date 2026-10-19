import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BRAND_COLORS } from "../lib/brand.ts";

function channel(hex: string, index: number): number {
  const raw = hex.replace("#", "");
  const value = parseInt(raw.slice(index * 2, index * 2 + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => channel(hex, i));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function rootToken(css: string, name: string): string {
  const block = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, ":root");
  const found = block[1].match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(found, name);
  return found[1].toLowerCase();
}

describe("default palette contrast", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("keeps light text on the action fill at AA", () => {
    const accent = rootToken(css, "--accent");
    const onAccent = rootToken(css, "--on-accent");
    assert.equal(accent, "#4a7234");
    assert.ok(contrast(onAccent, accent) >= 4.5);
    assert.ok(contrast("#ffffff", accent) >= 4.5);
    assert.equal(BRAND_COLORS.action.toLowerCase(), accent);
  });

  it("keeps muted text at AA on paper and on the muted band", () => {
    const muted = rootToken(css, "--text-muted");
    assert.equal(muted, "#5a5c2b");
    assert.ok(contrast(muted, "#edf9ed") >= 4.5);
    assert.ok(contrast(muted, "#dcebc4") >= 4.5);
    assert.equal(BRAND_COLORS.olive.toLowerCase(), muted);
  });

  it("keeps field borders at the non-text AA floor", () => {
    const border = rootToken(css, "--border");
    assert.equal(border, "#5f8a4c");
    assert.ok(contrast(border, "#edf9ed") >= 3);
  });

  it("names pistachio and stars as tokens", () => {
    assert.equal(rootToken(css, "--pistachio"), "#c6d67e");
    assert.match(css, /--gold:\s*var\(--pistachio\)/);
    assert.equal(rootToken(css, "--star"), "#e8c547");
    assert.equal(BRAND_COLORS.earth.toLowerCase(), "#84b067");
  });
});
