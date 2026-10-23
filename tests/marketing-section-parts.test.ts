import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLINICAL_INTRO_ARTICLE,
  EMDR_GUIDE_ARTICLE,
  EMDR_INTRO_ARTICLE,
  LIMITS_ARTICLE,
  SAFETY_ARTICLE,
} from "../lib/marketing-articles.ts";
import { MARKETING_PAGES } from "../lib/marketing-layout.ts";
import {
  articleSlotIds,
  getSectionDef,
  hasSectionParts,
  isMarketingSectionId,
  isSectionOn,
  MARKETING_SECTIONS,
  normalizeSection,
  sectionBackground,
  sectionList,
  sectionText,
  slotMedia,
} from "../lib/marketing-sections.ts";
import { parseArticle } from "../lib/rich-article.ts";

describe("one panel per visual section", () => {
  it("article pieces render the same blocks as the whole article", () => {
    const cases: [string, string][] = [
      ["safety-page", SAFETY_ARTICLE],
      ["limits-page", LIMITS_ARTICLE],
      ["clinical-intro", CLINICAL_INTRO_ARTICLE],
      ["emdr-intro", EMDR_INTRO_ARTICLE],
      ["emdr-guide", EMDR_GUIDE_ARTICLE],
    ];
    for (const [base, whole] of cases) {
      const ids = articleSlotIds(base);
      assert.ok(ids.length > 1, base);
      assert.equal(ids[0], base);
      const blocks = ids.flatMap((id) => parseArticle(sectionText(normalizeSection(id, null), "body")));
      assert.deepEqual(blocks, parseArticle(whole), base);
    }
  });

  it("article pieces are page slots in reading order", () => {
    const safety = MARKETING_PAGES.safety.slots.map((slot) => slot.id);
    assert.deepEqual(safety, [...articleSlotIds("safety-page"), "page-cta-safety"]);
    const emdr = MARKETING_PAGES.emdr.slots.map((slot) => slot.id);
    assert.equal(emdr.indexOf("emdr-compare"), articleSlotIds("emdr-intro").length);
  });

  it("splits how-it-works into its own sections with plain names", () => {
    for (const id of ["home-how", "home-how-stages", "home-how-rhythm", "home-how-ground", "home-how-between", "home-how-languages"]) {
      const def = getSectionDef(id);
      assert.ok(def, id);
      assert.ok(!def.fields.some((field) => field.label === "Copy"), id);
    }
    assert.ok(hasSectionParts("home-how"));
    assert.deepEqual(getSectionDef("home-how")?.fields.map((field) => field.key), ["badge", "intro1", "intro2", "intro3"]);
    const between = normalizeSection("home-how-between", null);
    assert.equal(sectionText(between, "betweenKicker"), "Between sessions");
    assert.equal(sectionText(between, "betweenCtaHref"), "/app/create-account");
    assert.equal(sectionText(between, "betweenAccent"), "Self-guided");

    // Rhythm cards: an icon per card plus the big image/video frame, both in
    // the rhythm panel (where their placeholders render).
    const rhythmDef = getSectionDef("home-how-rhythm");
    assert.ok(rhythmDef);
    assert.deepEqual(rhythmDef.fields.map((field) => field.key), ["rhythm", "rhythmMedia"]);
    const rhythmField = rhythmDef.fields.find((field) => field.key === "rhythm");
    const rhythmChildren = rhythmField?.kind === "list" ? rhythmField.fields : [];
    assert.deepEqual(rhythmChildren.map((field) => field.key), ["icon", "label", "hint"]);
    assert.equal(rhythmChildren.find((field) => field.key === "icon")?.kind, "image");
    assert.equal(rhythmDef.fields.find((field) => field.key === "rhythmMedia")?.kind, "media");
    const rhythm = normalizeSection("home-how-rhythm", null);
    assert.equal(sectionText(rhythm, "rhythmMediaKind"), "image");
    const cards = sectionList(rhythm, "rhythm");
    assert.equal(cards.length, 3);
    assert.equal(cards[0]?.label, "Eyes");
    assert.equal(cards[0]?.icon, "");
  });

  it("Ground first: all three visuals take an Animation / Image / Video slot", () => {
    const def = getSectionDef("home-how-ground");
    assert.ok(def);
    assert.deepEqual(def.fields.map((field) => field.key), ["groundMedia", "ground"]);
    const top = def.fields.find((field) => field.key === "groundMedia");
    assert.equal(top?.kind, "media");
    assert.equal(top?.kind === "media" ? top.defaultLabel : "", "Animation");
    const list = def.fields.find((field) => field.key === "ground");
    const children = list?.kind === "list" ? list.fields : [];
    assert.deepEqual(children.map((field) => field.key), ["title", "line", "media"]);
    const cardMediaField = children.find((field) => field.key === "media");
    assert.equal(cardMediaField?.kind === "media" ? cardMediaField.defaultLabel : "", "Animation");

    // Default (and old saved configs without the keys): animation everywhere.
    const plain = normalizeSection("home-how-ground", null);
    assert.equal(sectionText(plain, "groundMediaKind"), "none");
    assert.equal(slotMedia(plain, "groundMedia"), null);
    const legacy = normalizeSection("home-how-ground", {
      ground: [
        { id: "safe", title: "Safe place first.", line: "Feet on the floor." },
        { id: "cold", title: "No cold starts.", line: "Intake first." },
      ],
    });
    for (const card of sectionList(legacy, "ground")) {
      assert.equal(card.mediaKind, "none");
      assert.equal(slotMedia(card, "media"), null);
    }

    // Saved media survives normalizing (what the save route stores).
    const saved = normalizeSection("home-how-ground", {
      groundMediaKind: "image",
      groundMediaImage: "/media/start.png",
      groundMediaAlt: "Start a session",
      ground: [
        { id: "safe", title: "Safe place first.", line: "Feet.", mediaKind: "video", mediaVideo: "/media/safe.mp4" },
        { id: "cold", title: "No cold starts.", line: "Intake.", mediaKind: "image", mediaImage: "" },
      ],
    });
    assert.deepEqual(slotMedia(saved, "groundMedia"), {
      kind: "image",
      image: "/media/start.png",
      video: "",
      poster: "",
      alt: "Start a session",
    });
    const [safe, cold] = sectionList(saved, "ground");
    assert.equal(slotMedia(safe, "media")?.kind, "video");
    assert.equal(slotMedia(safe, "media")?.video, "/media/safe.mp4");
    // Image chosen but no file: falls back to the animation.
    assert.equal(slotMedia(cold, "media"), null);
  });

  it("stage and rhythm media offer the built-in animation as the default", () => {
    const stagesDef = getSectionDef("home-how-stages");
    const stagesField = stagesDef?.fields.find((field) => field.key === "stages");
    const stageMedia = stagesField?.kind === "list" ? stagesField.fields.find((field) => field.key === "media") : undefined;
    assert.equal(stageMedia?.kind === "media" ? stageMedia.defaultLabel : "", "Animation");
    const rhythmMedia = getSectionDef("home-how-rhythm")?.fields.find((field) => field.key === "rhythmMedia");
    assert.equal(rhythmMedia?.kind === "media" ? rhythmMedia.defaultLabel : "", "Animation");
    // A saved stage image keeps rendering (Close gently's photo).
    const stages = normalizeSection("home-how-stages", {
      stages: [{ id: "close", nav: "Close gently", mediaKind: "image", mediaImage: "/media/meadow.jpg" }],
    });
    const close = sectionList(stages, "stages").find((stage) => stage.id === "close");
    assert.equal(slotMedia(close, "media")?.image, "/media/meadow.jpg");
  });

  it("every section id is unique", () => {
    const ids = MARKETING_SECTIONS.map((def) => def.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("keeps the section switch, except where a block cannot hide", () => {
    assert.equal(isSectionOn(normalizeSection("home-faq", { _off: "1" })), false);
    assert.equal(isSectionOn(normalizeSection("home-faq", { _off: "yes" })), true);
    assert.equal(isSectionOn(normalizeSection("footer-links", { _off: "1" })), true);
  });
});

describe("sign-in background", () => {
  it("is an editable section with only the shared Background panel", () => {
    const def = getSectionDef("auth-login");
    assert.ok(def);
    assert.equal(def.name, "Sign-in: background");
    assert.deepEqual(def.fields, []);
    assert.equal(def.noHide, true);
    assert.equal(isMarketingSectionId("auth-login"), true);
  });

  it("keeps an image or video and rejects unsafe media", () => {
    const image = normalizeSection("auth-login", {
      bgKind: "image",
      bgImage: "/icon.svg",
      bgOverlay: "20",
      bgTone: "dark",
    });
    const bg = sectionBackground(image);
    assert.equal(bg?.kind, "image");
    assert.equal(bg?.image, "/icon.svg");
    assert.equal(bg?.overlay, 20);
    assert.equal(bg?.tone, "dark");

    const unsafe = sectionBackground(
      normalizeSection("auth-login", {
        bgKind: "video",
        bgVideo: "javascript:alert(1)",
      })
    );
    assert.equal(unsafe, null);
  });
});

describe("section background", () => {
  it("adds nothing when unset", () => {
    const config = normalizeSection("home-faq", null);
    assert.equal("bgKind" in config, false);
    assert.equal(sectionBackground(config), null);
  });

  it("keeps a colour and rejects a bad one", () => {
    const ok = sectionBackground(normalizeSection("home-faq", { bgKind: "color", bgColor: "#12AB34" }));
    assert.equal(ok?.kind, "color");
    assert.equal(ok?.color, "#12ab34");
    const bad = sectionBackground(normalizeSection("home-faq", { bgKind: "color", bgColor: "red;x" }));
    assert.equal(bad?.color, "#ffffff");
  });

  it("drops unsafe media and clamps the overlay", () => {
    const config = normalizeSection("pricing-cta", {
      bgKind: "video",
      bgVideo: "javascript:alert(1)",
      bgOverlay: "500",
    });
    assert.equal(sectionText(config, "bgVideo"), "");
    assert.equal(sectionText(config, "bgOverlay"), "90");
    assert.equal(sectionBackground(config), null);
    const image = sectionBackground(
      normalizeSection("pricing-cta", { bgKind: "image", bgImage: "https://res.cloudinary.com/x/a.jpg", bgTone: "dark" })
    );
    assert.equal(image?.kind, "image");
    assert.equal(image?.tone, "dark");
    assert.equal(image?.overlay, 40);
  });

  it("works on article pieces and added sections too", () => {
    const id = articleSlotIds("limits-page")[2]!;
    assert.equal(sectionBackground(normalizeSection(id, { bgKind: "color", bgColor: "#000000" }))?.color, "#000000");
    assert.equal(
      sectionBackground(normalizeSection("custom-text-abcdefgh", { bgKind: "color", bgColor: "#eeeeee" }))?.kind,
      "color"
    );
  });
});