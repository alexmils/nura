import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customIdsIn, defaultLayout, normalizeLayout } from "../lib/marketing-layout";
import {
  CODE_SECTION_IDS,
  getSectionDef,
  isCodeSectionId,
  isCustomSectionId,
  normalizeSection,
  sectionText,
} from "../lib/marketing-sections";

const POSTER = "custom-poster-heal0001";
const FILM = "custom-video-film0001";
const HEAL_IMAGE = "https://res.cloudinary.com/zdq2rh8t/image/upload/v1792499404/nura/marketing/dmtqkn0drnotsf1pdoug.jpg";

describe("code-defined home sections (Heal poster + film)", () => {
  it("are registered in code and keep the custom id shape", () => {
    assert.deepEqual([...CODE_SECTION_IDS].sort(), [POSTER, FILM].sort());
    for (const id of CODE_SECTION_IDS) {
      assert.ok(isCustomSectionId(id), id);
      assert.ok(isCodeSectionId(id), id);
      assert.ok(getSectionDef(id), id);
    }
    assert.equal(getSectionDef(POSTER)?.name, "Home: Heal poster");
    assert.equal(isCodeSectionId("custom-poster-abcdefgh"), false);
  });

  it("an empty-DB home layout shows both, in order, right after the how-it-works intro", () => {
    const ids = defaultLayout("home").sections.map((entry) => entry.id);
    const intro = ids.indexOf("home-how-intro");
    assert.ok(intro >= 0);
    assert.deepEqual(ids.slice(intro, intro + 4), ["home-how-intro", POSTER, FILM, "home-how"]);
    assert.ok(defaultLayout("home").sections.every((entry) => !entry.hidden));
    assert.deepEqual(customIdsIn(defaultLayout("home")), [POSTER, FILM]);
  });

  it("a saved layout without them gets them back in place", () => {
    const layout = normalizeLayout("home", {
      sections: [{ id: "home-hero" }, { id: "home-trust" }, { id: "home-how-intro" }, { id: "home-how" }],
    });
    const ids = layout.sections.map((entry) => entry.id);
    assert.deepEqual(ids.slice(0, 5), ["home-hero", "home-trust", "home-how-intro", POSTER, FILM]);
  });

  it("normalizeSection with no row returns the stored content", () => {
    const poster = normalizeSection(POSTER, null);
    assert.equal(sectionText(poster, "word"), "Heal");
    assert.equal(sectionText(poster, "line"), "Healing is not linear");
    assert.equal(sectionText(poster, "note"), "- Find your calm -");
    assert.equal(sectionText(poster, "image"), HEAL_IMAGE);
    const film = normalizeSection(FILM, null);
    assert.equal(sectionText(film, "mediaKind"), "image");
    assert.equal(sectionText(film, "mediaImage"), HEAL_IMAGE);
    assert.equal(
      sectionText(film, "mediaVideo"),
      "https://res.cloudinary.com/zdq2rh8t/video/upload/v1792501843/nura/marketing/bfslcwafuriry9uas76d.mp4"
    );
  });

  it("saved edits still override the code defaults", () => {
    const poster = normalizeSection(POSTER, { word: "Rest" });
    assert.equal(sectionText(poster, "word"), "Rest");
    assert.equal(sectionText(poster, "line"), "Healing is not linear");
  });
});