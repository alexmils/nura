import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendCtaToSections,
  normalizeBlogCta,
  parseBlogCta,
  serializeBlogCta,
} from "../lib/blog-cta.ts";

describe("blog CTA", () => {
  it("parses a directive paragraph", () => {
    const cta = parseBlogCta(
      '::cta {"template":"band","title":"Practice tonight","button":"Start","href":"/pricing"}'
    );
    assert.deepEqual(cta, {
      template: "band",
      title: "Practice tonight",
      body: undefined,
      button: "Start",
      href: "/pricing",
      background: undefined,
      text: undefined,
    });
  });

  it("ignores paragraphs that are not directives", () => {
    assert.equal(parseBlogCta("Just a normal paragraph"), null);
    assert.equal(parseBlogCta("::notacta {"), null);
    assert.equal(parseBlogCta("::cta not json"), null);
  });

  it("rejects unsafe links and colours", () => {
    const cta = normalizeBlogCta({
      title: "Hello",
      href: "javascript:alert(1)",
      background: "url(javascript:alert(1))",
      text: "red; background:url(x)",
    });
    assert.ok(cta);
    assert.equal(cta.href, undefined);
    assert.equal(cta.background, undefined);
    assert.equal(cta.text, undefined);
  });

  it("keeps https links and hex colours", () => {
    const cta = normalizeBlogCta({
      title: "Hello",
      href: "https://example.com/x",
      background: "#eaf4e2",
      text: "#2a3020",
    });
    assert.equal(cta?.href, "https://example.com/x");
    assert.equal(cta?.background, "#eaf4e2");
    assert.equal(cta?.text, "#2a3020");
  });

  it("round-trips through serialize", () => {
    const original = {
      template: "split" as const,
      title: "Between sessions",
      body: "Short practice.",
      button: "See prices",
      href: "/pricing",
      background: "#ffffff",
      text: "#141a12",
    };
    const text = serializeBlogCta(original);
    assert.deepEqual(parseBlogCta(text), original);
  });

  it("appends to the last section", () => {
    const sections = [
      { heading: "One", paragraphs: ["a"] },
      { heading: "Two", paragraphs: ["b"] },
    ];
    const next = appendCtaToSections(sections, "::cta {}");
    assert.deepEqual(next[1].paragraphs, ["b", "::cta {}"]);
    assert.deepEqual(next[0], sections[0]);
  });
});
