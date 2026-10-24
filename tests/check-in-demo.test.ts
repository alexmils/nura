import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("How it works > Check in demo replicates the app", () => {
  const tsx = read("app/components/frontend/SessionStageDemos.tsx");
  const css = read("app/components/frontend/check-in-demo.css");
  const check = tsx.slice(tsx.indexOf("export function CheckInDemo"), tsx.indexOf("type CloseScene"));
  const bar = tsx.slice(tsx.indexOf("function DemoBlsGroup"), tsx.indexOf("function ChatAvatar"));
  const num = (name: string) => Number((tsx.match(new RegExp(`export const ${name} = (\\d+);`)) ?? [])[1]);

  it("set screen is a scaled virtual desktop screen (1280px) with one transform", () => {
    assert.equal(num("CHECK_VIRTUAL_W"), 1280);
    assert.match(css, /\.ssd-app \{[^}]*width: 1280px;[^}]*transform: scale\(var\(--ssd-scale/);
    assert.match(tsx, /setProperty\("--ssd-scale"/);
    assert.match(css, /\.ssd-frame\.ssd-checkin \{\s*zoom: 1;/);
  });

  it("ball matches BallCanvas defaults and sweeps ease-in-out, 2 passes", () => {
    assert.match(css, /\.ssd-setball \{[^}]*width: 48px;[^}]*background: #111111/);
    assert.match(css, /animation: ssd-sweep [^;]*ease-in-out infinite/);
    assert.equal(num("CHECK_SET_PASSES"), 2);
  });

  it("control bar reuses the real BlsToolbar classes, docked full width, left-aligned", () => {
    for (const cls of ["bls-bar", "bls-panel", "bls-group", "bls-seg", "bls-seg-btn", "bls-seg-btn-active", "bls-group-label", "bls-collapse-btn"]) {
      assert.ok(bar.includes(cls), cls);
    }
    for (const label of ["Speed", "Repeats", "Stereo sound", "Animation", "Adjustments"]) {
      assert.ok(bar.includes(`label="${label}"`), label);
    }
    for (const v of [">0.1<", ">5<", "bls-seg-btn-active\">1<", "bls-seg-btn-active\">24<", "<InfinityIcon", "<VolumeX", "<Volume2", "<Circle", "<Square", "<SlidersHorizontal", "<ChevronDown"]) {
      assert.ok(bar.includes(v), v);
    }
    assert.doesNotMatch(bar, /<button|onClick/, "non-interactive");
    assert.match(css, /\.ssd-app-dock \{[^}]*left: 0;[^}]*right: 0;[^}]*bottom: 0;[^}]*padding: 0 0\.75rem 0\.9rem/);
    assert.doesNotMatch(css, /\.ssd-bls|justify-content: center;[^}]*\.bls-panel/);
    // Phone viewport keeps the desktop bar inside the replica.
    assert.match(css, /@media \(max-width: 767px\) \{\s*\.ssd-app \.bls-bar/);
  });

  it("check-in conversation follows the set, with typing before agent lines", () => {
    assert.match(tsx, /export const CHECK_QUESTION = "What did you notice\?"/);
    for (const text of ["CHECK_QUESTION", "My chest feels a bit lighter.", "how disturbing does it feel now?", 'text: "4"', "another set."]) {
      assert.ok(tsx.includes(text), text);
    }
    assert.match(check, /agent-chat-bubble agent-chat-bubble--agent/);
    assert.match(check, /agent-chat-bubble agent-chat-bubble--user/);
    assert.match(check, /if \(line\.role === "agent"\) \{\s*setTyping\(true\);/);
    const setAt = check.lastIndexOf('setPhase("set")');
    const chatAt = check.lastIndexOf('setPhase("chat")');
    assert.ok(setAt > 0 && chatAt > setAt);
    assert.match(check, /while \(!cancelled\)/);
  });

  it("loop is about 11-14s, question within ~3.5s", () => {
    const set = num("CHECK_PASS_MS") * num("CHECK_SET_PASSES");
    const firstQuestion = set + num("CHECK_FADE_MS") + num("CHECK_TYPING_MS");
    assert.ok(firstQuestion <= 3500, `question at ${firstQuestion}ms`);
    const holds = [...tsx.matchAll(/holdMs: (\d+)/g)].map((m) => Number(m[1]));
    const agents = (tsx.match(/\{ role: "agent"/g) ?? []).length;
    const total = set + num("CHECK_FADE_MS") + holds.reduce((a, b) => a + b, 0) + agents * num("CHECK_TYPING_MS");
    assert.ok(total >= 11000 && total <= 14000, `loop ${total}ms`);
  });

  it("agent avatar is not stretched by .fe-spath-media img (the green bars)", () => {
    assert.match(read("app/components/frontend/section-editor/section-editor.css"), /\.fe-spath-media img,[^{]*\{\s*position: absolute;\s*inset: 0;/);
    assert.match(css, /\.ssd--check \.agent-chat-row img\.ssd-chat-avatar \{[^}]*position: static;[^}]*inset: auto;[^}]*width: var\(--ssd-chat-avatar/);
    assert.match(check, /className=\{`agent-chat-row agent-chat-row--agent\$\{state\}`\}>\s*<ChatAvatar \/>/);
    assert.match(tsx, /className="avatar-img avatar-sm avatar-guide ssd-chat-avatar"/);
    assert.doesNotMatch(css + check, /shimmer|glow|streaming/i);
  });

  it("chat is large and readable: ~17px text, ~40px avatar, ~78% column, sized by card width", () => {
    assert.match(css, /\.ssd-guide \{[^}]*container-type: inline-size;/);
    assert.match(css, /--ssd-chat-fs: clamp\(12px, 1\.95cqw, 17px\)/);
    assert.match(css, /--ssd-chat-avatar: clamp\(26px, 4\.4cqw, 40px\)/);
    assert.match(css, /\.ssd-chat-messages\.agent-chat-messages \{[^}]*width: min\(78%, 46rem\)/);
    assert.match(css, /\.ssd--check \.agent-chat-text \{[^}]*font-size: var\(--ssd-chat-fs\)/);
    assert.doesNotMatch(css + tsx, /--ssd-chat-scale|CHECK_CHAT_VIRTUAL_W/);
    // 1.95cqw of an ~875px desktop card is ~17px.
    assert.ok(Math.abs(875 * 0.0195 - 17) < 0.2);
    assert.match(css, /\.ssd--check:not\(\.is-set\) \.ssd-app-dock \{[^}]*opacity: 0;[^}]*visibility: hidden/);
  });

  it("conversation is centered with space reserved; overflow slides up instead of cutting", () => {
    assert.match(check, /CHECK_SCRIPT\.map\(\(line, i\)/);
    assert.match(check, /" is-pending"/);
    assert.match(css, /\.agent-chat-row\.is-pending \{\s*visibility: hidden;/);
    assert.match(css, /margin-block: auto;/);
    assert.match(check, /--ssd-chat-shift/);
    assert.match(css, /transform: translateY\(var\(--ssd-chat-shift, 0px\)\);\s*transition: transform 0\.45s ease;/);
    assert.match(css, /\.ssd-typing \{[^}]*min-height: 1\.5em;/);
  });

  it("chat sits above the set screen and becomes visible after the set", () => {
    assert.match(css, /\.ssd-guide \{[^}]*z-index: 2/);
    assert.match(css, /\.ssd--check:not\(\.is-set\) \.ssd-guide \{[^}]*opacity: 1;[^}]*visibility: visible/);
  });

  it("reduced motion: the full conversation, static", () => {
    assert.match(check, /if \(reducedMotion\(\)\) \{\s*setPhase\("chat"\);\s*setTyping\(false\);\s*setShown\(CHECK_SCRIPT\.length\);/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("starts at once when its stage is active; CSS only in its own file", () => {
    assert.match(read("app/components/frontend/SessionPathSticky.tsx"), /<CheckInDemo forcePlay \/>/);
    assert.match(tsx, /import "\.\/check-in-demo\.css";/);
    assert.doesNotMatch(read("app/globals.css"), /ssd-setball|ssd-app/);
  });
});