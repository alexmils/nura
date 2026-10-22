import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BLOG_CATEGORIES } from "../lib/blog-categories";
import { HIDDEN_ITEM_KEY, normalizeSection, sectionList } from "../lib/marketing-sections";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("home topics emerge", () => {
  it("defaults list every guide topic in the original order", () => {
    const topics = sectionList(normalizeSection("home-topics", null), "topics");
    assert.deepEqual(topics.map((t) => t.id), BLOG_CATEGORIES.map((c) => c.slug));
    assert.deepEqual(topics.map((t) => t.label), BLOG_CATEGORIES.map((c) => c.name));
  });

  it("hidden topics leave the ring and a new order is kept", () => {
    const saved = BLOG_CATEGORIES.map((c) => ({ id: c.slug, label: c.name })).reverse();
    saved[0] = { ...saved[0], [HIDDEN_ITEM_KEY]: "1" } as (typeof saved)[number];
    const topics = sectionList(normalizeSection("home-topics", { topics: saved }), "topics");
    assert.equal(topics.length, BLOG_CATEGORIES.length - 1);
    assert.equal(topics[0]?.id, BLOG_CATEGORIES[BLOG_CATEGORIES.length - 2]?.slug);
  });

  it("ring spacing follows the shown count and the scroll drives one variable", () => {
    const tsx = src("app/components/frontend/SessionTopicsGrid.tsx");
    assert.match(tsx, /"--topics-n" as string\]: count/);
    assert.match(tsx, /"--topics-emerge": 1/);
    assert.match(tsx, /scrub: 0\.8/);
    assert.match(tsx, /prefers-reduced-motion: no-preference/);
    assert.match(tsx, /isA11yReduceMotionPreferred/);
  });

  it("static final layout without motion; sticky track only on desktop", () => {
    const css = src("app/components/frontend/session-topics-grid.css");
    assert.match(css, /--topics-emerge: 1;/);
    assert.match(css, /@media \(min-width: 861px\) and \(prefers-reduced-motion: no-preference\)/);
    assert.match(css, /position: sticky/);
    assert.match(css, /html\[data-a11y-motion="reduced"\]/);
  });
});
