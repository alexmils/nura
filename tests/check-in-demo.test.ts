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
});