import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOG_BODY_MAX_CHARS,
  BLOG_TITLE_MAX,
  blogBodyLength,
  cleanCopy,
  defaultBlogCover,
  findBlsAcronym,
  hasBlsAcronym,
  isValidCoverUrl,
  parseSections,
  stripEmDash,
} from "../lib/blog-post-input.ts";

describe("blog post input", () => {
  it("replaces em dashes instead of shipping them", () => {
    assert.equal(stripEmDash("A set — a pause", ", "), "A set, a pause");
    assert.equal(
      cleanCopy("EMDR — what it is", "title"),
      "EMDR: what it is"
    );
    assert.equal(cleanCopy("Calm — always", "body"), "Calm, always");
    const cleaned = cleanCopy("Grief — no schedule", "body");
    assert.equal(cleaned.includes("—"), false);
  });

  it("detects the BLS acronym case-insensitively", () => {
    assert.equal(hasBlsAcronym("free BLS minutes"), true);
    assert.equal(hasBlsAcronym("bls bar"), true);
    assert.equal(hasBlsAcronym("self-guided set time"), false);
    // Must not fire on words that merely contain the letters.
    assert.equal(hasBlsAcronym("bolsters the response"), false);
  });

  it("flags the first offending field", () => {
    const base = {
      title: "Calm sets",
      description: "A guide",
      dek: "Short lead",
      sections: [{ heading: "Start", paragraphs: ["Ground first."] }],
    };
    assert.equal(findBlsAcronym(base), null);
    assert.equal(
      findBlsAcronym({ ...base, sections: [{ heading: "BLS basics", paragraphs: ["x"] }] }),
      "BLS basics"
    );
    assert.equal(findBlsAcronym({ ...base, description: "Free BLS time" }), "Free BLS time");
  });

  it("requires a real body and bounds its size", () => {
    assert.equal(parseSections([]).ok, false);
    assert.equal(parseSections("nope").ok, false);
    assert.equal(parseSections([{ heading: "", paragraphs: ["x"] }]).ok, false);
    assert.equal(parseSections([{ heading: "H", paragraphs: [] }]).ok, false);

    const ok = parseSections([
      { heading: "Grounding", paragraphs: ["Press into the floor.", "Name five things."] },
    ]);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.sections[0]!.heading, "Grounding");
      assert.equal(ok.sections[0]!.paragraphs.length, 2);
    }

    const tooManyParagraphs = parseSections([
      { heading: "H", paragraphs: Array.from({ length: 41 }, () => "p") },
    ]);
    assert.equal(tooManyParagraphs.ok, false);

    const huge = parseSections([
      { heading: "H", paragraphs: ["x".repeat(BLOG_BODY_MAX_CHARS + 1)] },
    ]);
    assert.equal(huge.ok, false);
    if (!huge.ok) assert.match(huge.error, /too long/);
  });

  it("bounds the title", () => {
    assert.ok(BLOG_TITLE_MAX > 0);
    const long = "x".repeat(BLOG_TITLE_MAX + 1);
    assert.equal(long.length > BLOG_TITLE_MAX, true);
  });

  it("computes body length across headings and paragraphs", () => {
    assert.equal(
      blogBodyLength([{ heading: "abc", paragraphs: ["de", "f"] }]),
      6
    );
  });

  it("accepts site paths and https covers, rejects the rest", () => {
    assert.equal(isValidCoverUrl(""), true);
    assert.equal(isValidCoverUrl("/marketing/landing/calm-water.jpg"), true);
    assert.equal(isValidCoverUrl("https://example.com/a.jpg"), true);
    assert.equal(isValidCoverUrl("//evil.example/a.jpg"), false);
    assert.equal(isValidCoverUrl("http://example.com/a.jpg"), false);
    assert.equal(isValidCoverUrl("javascript:alert(1)"), false);
  });

  it("always produces a usable fallback cover", () => {
    for (const slug of ["a", "grief-and-the-hard-days", "", "x".repeat(90)]) {
      const cover = defaultBlogCover(slug);
      assert.match(cover, /^\/marketing\/landing\/[a-z-]+\.jpg$/);
    }
    // Deterministic, so cards do not shuffle between renders.
    assert.equal(defaultBlogCover("same-slug"), defaultBlogCover("same-slug"));
  });
});
