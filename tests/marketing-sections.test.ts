import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faqPairs,
  normalizeSection,
  parseLinkLines,
  safeHref,
  sectionList,
  sectionText,
} from "../lib/marketing-sections.ts";

describe("marketing section copy", () => {
  it("keeps defaults and drops unknown keys", () => {
    const config = normalizeSection("home-pause", {
      title: "Start here",
      extra: "nope",
    });
    assert.equal(sectionText(config, "title"), "Start here");
    assert.equal(sectionText(config, "cta"), "Get started");
    assert.equal("extra" in config, false);
  });

  it("rejects unsafe links and caps text", () => {
    assert.equal(safeHref("javascript:alert(1)", "/learn"), "/learn");
    assert.equal(safeHref("/pricing", "/"), "/pricing");
    assert.equal(safeHref("https://nurahelp.com/faq", "/"), "https://nurahelp.com/faq");
    const config = normalizeSection("home-hero", {
      title: "x".repeat(800),
      cardHref: "javascript:alert(1)",
    });
    assert.ok(sectionText(config, "title").length <= 400);
    assert.equal(sectionText(config, "cardHref"), "/learn");
  });

  it("keeps a stage with its id when the row moves", () => {
    const config = normalizeSection("home-how", {
      stages: [
        { id: "rhythm", nav: "Pulse" },
        { id: "ground", nav: "Settle" },
      ],
    });
    const stages = sectionList(config, "stages");
    assert.equal(stages[0]?.id, "rhythm");
    assert.equal(stages[0]?.nav, "Pulse");
    assert.equal(stages[1]?.id, "ground");
    assert.equal(stages[1]?.nav, "Settle");
    assert.equal(stages.length, 4);
    assert.equal(stages[2]?.id, "checkin");
  });

  it("keeps an explicit empty list and restores a missing one", () => {
    const emptied = normalizeSection("home-faq", { items: [] });
    assert.equal(faqPairs(emptied).length, 0);
    const missing = normalizeSection("home-faq", {});
    assert.ok(faqPairs(missing).length > 0);
  });

  it("rejects a script url on an image or video slot", () => {
    const config = normalizeSection("home-hero", {
      heroImage: "javascript:alert(1)",
      heroKind: "video",
      heroVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    assert.equal(sectionText(config, "heroImage"), "/marketing/landing/support-talk.jpg");
    assert.equal(sectionText(config, "heroKind"), "video");
    assert.match(sectionText(config, "heroVideo"), /^https:\/\/www\.youtube\.com\//);
  });
  it("parses footer link lines", () => {
    const links = parseLinkLines("Blog|/blog\nBad\nOff|javascript:alert(1)");
    assert.deepEqual(links, [{ label: "Blog", href: "/blog" }]);
  });

  it("hides the editor unless the role is platform admin", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../app/components/frontend/section-editor/useIsPlatformAdmin.ts", import.meta.url),
        "utf8"
      )
    );
    assert.match(source, /platform_admin/);
    assert.match(source, /\(\) => false/);
  });
});
