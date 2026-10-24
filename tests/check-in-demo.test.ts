import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("How it works > Check in demo mirrors the app", () => {
  const tsx = read("app/components/frontend/SessionStageDemos.tsx");
  const css = read("app/components/frontend/check-in-demo.css");
  const check = tsx.slice(tsx.indexOf("export function CheckInDemo"), tsx.indexOf("type CloseScene"));

  it("set screen, then typing, then the question, looping", () => {
    assert.match(tsx, /export type CheckPhase = "set" \| "typing" \| "ask"/);
    assert.match(tsx, /export const CHECK_QUESTION = "What did you notice\?"/);
    const order = ['setPhase("set")', 'setPhase("typing")', 'setPhase("ask")'].map((s) => check.lastIndexOf(s));
    assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], "phase order");
    assert.match(check, /while \(!cancelled\)/);
  });

  it("no slider pill, rail, set label or SUD strip any more", () => {
    assert.doesNotMatch(check, /Set 3|paused|ssd-rail|ssd-set-label|ssd-sud|What do you notice now/i);
    assert.doesNotMatch(read("app/components/frontend/session-stage-demos.css"), /\.ssd-set\b|\.ssd-rail|\.ssd-sud/);
  });

  it("set surface looks like the app (white, #111 ball, soft shadow, ease-in-out sweep)", () => {
    assert.match(css, /\.ssd-setscreen \{[^}]*background: #ffffff/);
    assert.match(css, /\.ssd-setball \{[^}]*background: #111111/);
    assert.match(css, /animation: ssd-sweep [^;]*ease-in-out infinite/);
    assert.match(css, /@keyframes ssd-sweep/);
  });

  it("reduced motion: static check-in screen", () => {
    assert.match(check, /if \(reducedMotion\(\)\) \{\s*setPhase\("ask"\);/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("CSS lives in its own file, not globals.css", () => {
    assert.match(tsx, /import "\.\/check-in-demo\.css";/);
    assert.doesNotMatch(read("app/globals.css"), /ssd-setball|ssd-setscreen/);
  });

  it("short loop: question shows within ~3s, whole loop about 5-6s", () => {
    const num = (name: string) => Number((tsx.match(new RegExp(`export const ${name} = (\\d+);`)) ?? [])[1]);
    const pass = num("CHECK_PASS_MS");
    const passes = num("CHECK_SET_PASSES");
    const typing = num("CHECK_TYPING_MS");
    const ask = num("CHECK_ASK_MS");
    assert.equal(passes, 2);
    assert.ok(pass * passes + typing <= 3000, "question appears within 3s");
    const total = pass * passes + typing + ask;
    assert.ok(total >= 5000 && total <= 6000, `loop ${total}ms`);
    assert.match(css, /\.ssd-setscreen \{[^}]*transition:\s*opacity 0\.4s/);
  });

  it("question screen sits above the set screen and becomes visible after the set", () => {
    assert.match(css, /\.ssd-setscreen \{[^}]*z-index: 1/);
    assert.match(css, /\.ssd-guide \{[^}]*z-index: 2/);
    assert.match(css, /\.ssd--check:not\(\.is-set\) \.ssd-guide \{[^}]*opacity: 1;[^}]*visibility: visible/);
    assert.match(check, /\{phase === "ask" \? <AgentRow>\{CHECK_QUESTION\}<\/AgentRow> : null\}/);
  });

  it("starts at once when its stage is active", () => {
    assert.match(read("app/components/frontend/SessionPathSticky.tsx"), /<CheckInDemo forcePlay \/>/);
  });

  it("set screen shows a static copy of the app's BLS control bar", () => {
    const bar = tsx.slice(tsx.indexOf("function DemoBlsBar"), tsx.indexOf("export function CheckInDemo"));
    for (const label of ["Speed", "Repeats", "Stereo sound", "Animation", "Adjustments"]) {
      assert.ok(bar.includes(`label="${label}"`), label);
    }
    for (const v of [">0.1<", ">1<", ">5<", ">24<", "<InfinityIcon", "<VolumeX", "<Volume2", "<Circle", "<Square", "<SlidersHorizontal", "<ChevronDown"]) {
      assert.ok(bar.includes(v), v);
    }
    assert.doesNotMatch(bar, /<button|onClick/, "non-interactive");
    assert.match(check, /<DemoBlsBar \/>/);
    assert.match(css, /\.ssd-bls \{/);
  });
});