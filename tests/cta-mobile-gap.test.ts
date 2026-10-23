import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatBlogDate } from "../lib/landing-blog";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("blog dates print the same day on the server and in every visitor time zone", () => {
  // 00:00Z is still the previous day west of UTC; a local-zone format failed hydration.
  assert.equal(formatBlogDate("2026-10-10T00:00:00.000Z"), "October 10, 2026");
  assert.match(read("lib/landing-blog.ts"), /timeZone: "UTC"/);
});

test("<html> tolerates the a11y bootstrap's data-a11y-* attributes (no hydration issue)", () => {
  assert.match(read("app/layout.tsx"), /<html\s+lang="en"\s+suppressHydrationWarning/);
});

test("phones: the closing CTA is sized by its card, with no blue blend over its media", () => {
  const css = read("app/components/frontend/landing-v2.css");
  const phones = css.slice(css.lastIndexOf("@media (max-width: 760px)"));
  assert.match(phones, /\.v2-close:not\(\.v2-close--showcase\)\s*\{\s*min-height: 0;/);
  assert.match(phones, /\.v2-close--media::before\s*\{\s*content: none;/);
  assert.match(read("app/components/frontend/HomeLandingV2.tsx"), /closeHasMedia \? " v2-close--media" : ""/);
  const show = read("app/components/frontend/cta-showcase.css");
  assert.doesNotMatch(show, /min-height: 88svh/);
});
