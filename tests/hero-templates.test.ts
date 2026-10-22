import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HERO_TEMPLATES,
  fieldInTemplate,
  getSectionDef,
  heroInk,
  heroTemplate,
  normalizeSection,
} from "../lib/marketing-sections";

test("hero template defaults to Default and only accepts known values", () => {
  assert.equal(heroTemplate(normalizeSection("home-hero", {})), "default");
  assert.equal(heroTemplate(normalizeSection("home-hero", { template: "split" })), "split");
  assert.equal(normalizeSection("home-hero", { template: "nope" }).template, "default");
  assert.equal(HERO_TEMPLATES.length, 11);
});

test("each template keeps its own data when switching back and forth", () => {
  const saved = normalizeSection("home-hero", {
    template: "framed",
    sideMediaImage: "/marketing/landing/journal.jpg",
    sideMediaImagePos: "30 60 1.4",
    frameCaption: "Framed only",
    clipLabel: "Clip only",
  });
  const back = normalizeSection("home-hero", { ...saved, template: "split" });
  assert.equal(back.sideMediaImage, "/marketing/landing/journal.jpg");
  assert.equal(back.sideMediaImagePos, "30 60 1.4");
  assert.equal(back.frameCaption, "Framed only");
  assert.equal(back.clipLabel, "Clip only");
});

test("text colours accept hex only; blank means as designed", () => {
  const out = normalizeSection("home-hero", { headlineColor: "#112233", accentColor: "red", bodyColor: "" });
  assert.equal(out.headlineColor, "#112233");
  assert.equal(out.accentColor, "");
  assert.deepEqual(heroInk(out), { headline: "#112233", accent: "", body: "" });
});

test("template-only fields are scoped to their templates", () => {
  const def = getSectionDef("home-hero")!;
  const keys = (template: string) => def.fields.filter((field) => fieldInTemplate(field, template)).map((field) => field.key);
  assert.ok(keys("split").includes("sideMedia"));
  assert.ok(!keys("split").includes("clipMedia"));
  assert.ok(keys("spotlight").includes("clipMedia"));
  assert.ok(keys("editorial").includes("stats"));
  assert.ok(!keys("default").includes("stats"));
  assert.ok(keys("default").includes("title1"));
  assert.ok(keys("stage").includes("stageMedia"));
  assert.ok(keys("poster").includes("posterMedia"));
  assert.ok(keys("billboard").includes("billboardMedia"));
  assert.ok(!keys("minimal").includes("stageMedia"));
});

test("video playback choice survives normalization", () => {
  const on = normalizeSection("home-hero", { template: "billboard", billboardMediaAutoplay: "1" });
  assert.equal(on.billboardMediaAutoplay, "1");
  const off = normalizeSection("home-hero", { template: "billboard" });
  assert.equal(off.billboardMediaAutoplay, "0");
});
