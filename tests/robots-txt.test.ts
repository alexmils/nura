import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AI_GROUNDING_USER_AGENTS,
  AI_TRAINING_USER_AGENTS,
  ROBOTS_CONTENT_SIGNAL,
  buildRobotsTxt,
} from "../lib/robots-txt.ts";
import { buildLlmsTxt } from "../lib/llms-txt.ts";

const origin = "https://nurahelp.com";

describe("robots.txt", () => {
  const body = buildRobotsTxt(origin);

  it("uses one User-agent: * group and skips redundant Allow lines", () => {
    const stars = body.match(/^User-agent: \*$/gm) || [];
    assert.equal(stars.length, 1);
    assert.match(body, /^Allow: \/$/m);
    assert.doesNotMatch(body, /^Allow: \/privacy$/m);
    assert.doesNotMatch(body, /^Allow: \/terms$/m);
    assert.match(body, /^Disallow: \/app$/m);
    assert.match(body, /^Disallow: \/admin$/m);
    assert.match(body, /^Disallow: \/api$/m);
    assert.match(body, /^Disallow: \/health$/m);
    assert.match(body, /^Disallow: \/entry$/m);
  });

  it("allows search and AI answers, forbids training", () => {
    assert.equal(ROBOTS_CONTENT_SIGNAL, "search=yes,ai-input=yes,ai-train=no");
    assert.match(body, new RegExp(`Content-Signal: ${ROBOTS_CONTENT_SIGNAL}`));
    assert.doesNotMatch(body, /ai-train=yes/);
  });

  it("opens grounding bots on public marketing pages only", () => {
    for (const agent of AI_GROUNDING_USER_AGENTS) {
      assert.match(body, new RegExp(`User-agent: ${agent}`));
    }
    const oai = body.slice(body.indexOf("User-agent: OAI-SearchBot"));
    const block = oai.slice(0, oai.indexOf("User-agent: PerplexityBot"));
    assert.match(block, /Allow: \/\$/);
    assert.match(block, /Allow: \/emdr/);
    assert.match(block, /Allow: \/about/);
    assert.match(block, /Allow: \/editorial/);
    assert.match(block, /Allow: \/learn/);
    assert.match(block, /Allow: \/knowledge/);
    assert.match(block, /Allow: \/pricing/);
    assert.match(block, /Allow: \/faq/);
    assert.match(block, /Allow: \/support/);
    assert.match(block, /Allow: \/blog/);
    assert.match(block, /Allow: \/changelog/);
    assert.match(block, /Allow: \/llms\.txt/);
    assert.match(block, /Allow: \/feed\.xml/);
    assert.match(block, /Allow: \/blog\/rss\.xml/);
    assert.match(block, /Disallow: \//);
    assert.doesNotMatch(block, /Allow: \/app/);
    assert.doesNotMatch(block, /Allow: \/privacy/);
    assert.doesNotMatch(block, /Allow: \/terms/);
  });

  it("keeps training crawlers fully disallowed", () => {
    for (const agent of AI_TRAINING_USER_AGENTS) {
      const start = body.indexOf(`User-agent: ${agent}`);
      assert.notEqual(start, -1, agent);
      const rest = body.slice(start);
      const next = rest.indexOf("\n\n");
      const block = next === -1 ? rest : rest.slice(0, next);
      assert.match(block, /Disallow: \//);
      assert.doesNotMatch(block, /Allow:/);
    }
  });

  it("points at the sitemap", () => {
    assert.match(body, /^Sitemap: https:\/\/nurahelp\.com\/sitemap\.xml$/m);
  });
});

describe("llms.txt", () => {
  const body = buildLlmsTxt(origin);

  it("invites crawl, index, ground, and cite — not training", () => {
    assert.match(body, /crawl/i);
    assert.match(body, /index/i);
    assert.match(body, /ground/i);
    assert.match(body, /cite/i);
    assert.match(body, /Do not train/);
    assert.doesNotMatch(body, /\bBLS\b/);
    assert.match(body, /nurahelp\.com\/emdr/);
    assert.match(body, /nurahelp\.com\/knowledge/);
    assert.match(body, /nurahelp\.com\/pricing/);
    assert.match(body, /nurahelp\.com\/faq/);
    assert.match(body, /nurahelp\.com\/support/);
    assert.match(body, /nurahelp\.com\/blog/);
    assert.match(body, /nurahelp\.com\/blog\/rss\.xml/);
    assert.match(body, /nurahelp\.com\/changelog/);
    assert.match(body, /nurahelp\.com\/editorial/);
    assert.match(body, /Do not fetch \/app/);
    assert.match(body, /\/health/);
    assert.match(body, /not therapy, diagnosis, or crisis care/);
    assert.doesNotMatch(body, /Self-help, not a licensed therapist/);
  });

  it("lists every public EMDR guide under /blog", () => {
    assert.match(body, /## EMDR guides/);
    assert.match(body, /nurahelp\.com\/blog\/what-is-emdr/);
    assert.match(body, /nurahelp\.com\/blog\/guided-vs-free-mode/);
    const articleLinks =
      body.match(/nurahelp\.com\/blog\/[a-z0-9-]+/g)?.filter(
        (u) => !u.endsWith("rss") && u !== "nurahelp.com/blog"
      ) ?? [];
    // Dedupe: title lines only under ## EMDR guides
    const unique = new Set(articleLinks);
    assert.ok(unique.size >= 18, `expected ≥18 article URLs, got ${unique.size}`);
  });
});
