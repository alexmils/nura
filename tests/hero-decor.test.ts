import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { normalizeSection, sectionDecor, BG_DECOR_KEY } from "../lib/marketing-sections";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("hero decorations follow the Background panel", () => {
  it("decorations only on the Default background, and can be switched off", () => {
    assert.equal(sectionDecor({}), true);
    assert.equal(sectionDecor({ [BG_DECOR_KEY]: "off" }), false);
    assert.equal(sectionDecor({ bgKind: "image", bgImage: "https://res.cloudinary.com/x/a.jpg" }), false);
    assert.equal(sectionDecor({ bgKind: "color", bgColor: "#123456" }), false);
  });

  it("persists the decorations toggle", () => {
    const out = normalizeSection("home-hero", { [BG_DECOR_KEY]: "off" }) as Record<string, unknown>;
    assert.equal(out[BG_DECOR_KEY], "off");
    const plain = normalizeSection("home-hero", {}) as Record<string, unknown>;
    assert.equal(plain[BG_DECOR_KEY], undefined);
  });

  it("sky and sun render only with decorations; custom backgrounds get the plain hero", () => {
    const c = src("app/components/frontend/HomeLandingV2.tsx");
    assert.match(c, /\{heroDecor \? <div className="v2-hero-sky" aria-hidden \/> : null\}/);
    assert.match(c, /\{heroDecor \? <div className="v2-hero-sun" aria-hidden \/> : null\}/);
    assert.match(c, /\$\{heroDecor \? "" : " v2-hero--plain"\}/);
    assert.match(c, /closeBg \? null : <span className="v2-close-tint"/);
    const css = src("app/components/frontend/landing-v2.css");
    assert.match(css, /\.v2-hero--plain \.v2-hero-photo \{[^}]*mask-image: none;/);
    assert.doesNotMatch(css, /\.v2-hero-(tint|scrim|flowers) \{/);
  });
});

describe("hero + trust strip are one unit", () => {
  it("renders the strip inside the hero when it is the next shown section", () => {
    const c = readFileSync(new URL("../app/components/frontend/HomeLandingV2.tsx", import.meta.url), "utf8");
    assert.match(c, /shownIds\[shownIds\.indexOf\("home-hero"\) \+ 1\] === "home-trust"/);
    assert.match(c, /"home-trust": trustInHero \? null :/);
    assert.match(c, /<div className="v2-hero-trust-slot">/);
    const css = readFileSync(new URL("../app/components/frontend/landing-v2.css", import.meta.url), "utf8");
    assert.match(css, /\.v2-hero--trust \{[^}]*min-height: 100svh;/);
  });
});
