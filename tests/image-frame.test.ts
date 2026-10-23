import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatImagePosition, imagePosition, storedFrameStyle } from "../lib/image-position";
import { normalizeSection, sectionBackground } from "../lib/marketing-sections";
import { patchFramePath, readFramePath } from "../app/components/admin/frame-drag";

const src = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("per-image position/zoom (ported from alexandermils)", () => {
  it("parses and stores 'x y zoom', centre = nothing stored", () => {
    assert.deepEqual(imagePosition("40 70 1.3"), { x: 40, y: 70, zoom: 1.3 });
    assert.deepEqual(imagePosition("bad"), { x: 50, y: 50, zoom: 1 });
    assert.equal(formatImagePosition({ x: 50, y: 50, zoom: 1 }), "");
    assert.equal(formatImagePosition({ x: 120, y: -4, zoom: 9 }), "100 0 4");
    assert.equal(storedFrameStyle(""), undefined);
    assert.deepEqual(storedFrameStyle("40 70 1.3"), { objectPosition: "40% 70%", transform: "scale(1.3)", transformOrigin: "40% 70%" });
  });

  it("keeps bgImagePos on the section background and defaults stay untouched", () => {
    const img = "https://res.cloudinary.com/demo/image/upload/a.jpg";
    const out = normalizeSection("home-hero", { bgKind: "image", bgImage: img, bgImagePos: "30 80 1.5" }) as Record<string, unknown>;
    assert.equal(out.bgImagePos, "30 80 1.5");
    assert.equal(sectionBackground(out as never)?.imagePos, "30 80 1.5");
    const plain = normalizeSection("home-hero", { bgKind: "image", bgImage: img }) as Record<string, unknown>;
    assert.equal(plain.bgImagePos, undefined);
  });

  it("reads and patches top-level and list-item frame paths", () => {
    const config = { bgImage: "x", images: [{ image: "a" }, { image: "b" }] } as never;
    const a = patchFramePath(config, "bgImage", { x: 10, y: 20, zoom: 2 });
    assert.equal(readFramePath(a, "bgImage"), "10 20 2");
    const b = patchFramePath(a, "images.1.image", { x: 5, y: 5, zoom: 1 });
    assert.equal(readFramePath(b, "images.1.image"), "5 5 1");
    assert.equal(readFramePath(b, "images.0.image"), "");
    const c = patchFramePath(b, "bgImage", null);
    assert.equal(readFramePath(c, "bgImage"), "");
  });

  it("every editable image has Edit and renders its position on the site", () => {
    const ed = src("app/components/frontend/section-editor/MarketingSectionEditor.tsx");
    assert.match(ed, /<FrameDragPad \/>/);
    assert.match(ed, /frameField="bgImage"/);
    assert.match(ed, /frameField=\{names\.image\}/);
    assert.match(ed, /frameField=\{field\.key\}/);
    assert.match(ed, /prefix: `\$\{field\.key\}\.\$\{index\}\.`/);
    assert.match(src("app/components/frontend/HomeLandingV2.tsx"), /data-frame-key=\{frame\}\s+style=\{\{ \.\.\.fill, \.\.\.storedFrameStyle\(bg\.imagePos\) \}\}/);
    assert.match(src("app/components/frontend/section-editor/EditablePart.tsx"), /data-frame-key=\{frameKey\(id, "bgImage"\)\}/);
    assert.match(src("app/components/frontend/section-editor/PosterSection.tsx"), /data-frame-key=\{id \? frameKey\(id, "image"\) : undefined\}/);
    const cs = src("app/components/frontend/section-editor/CustomSection.tsx");
    assert.match(cs, /frameKey\(id, `images\.\$\{at\}\.image`\)/);
    assert.match(cs, /frameKey\(id, `items\.\$\{at\}\.mediaImage`\)/);
    const pad = src("app/components/admin/FrameDragPad.tsx");
    assert.match(pad, /addEventListener\("wheel", onWheel, \{ passive: false \}\)/);
    assert.match(pad, /setPointerCapture/);
  });
});
