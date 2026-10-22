import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildFolderTree } from "../lib/cloudinary-library";
import { cleanLabelName, mediaAssetKey } from "../lib/media-labels";

const src = (p: string) => readFileSync(path.join(__dirname, "..", p), "utf8");

describe("Cloudinary picker (alexandermils port)", () => {
  it("builds the sidebar folder tree from a flat folders/search list", () => {
    const tree = buildFolderTree([
      { name: "samples", path: "samples" },
      { name: "food", path: "samples/food" },
      { name: "animals", path: "samples/animals" },
      { name: "marketing", path: "nura/marketing" },
    ]);
    assert.deepEqual(tree.map((n) => n.path), ["nura", "samples"]);
    assert.deepEqual(tree[1]!.children.map((n) => n.name), ["animals", "food"]);
    assert.equal(tree[0]!.children[0]!.path, "nura/marketing");
  });

  it("keys labels on asset_id with a public-id fallback, and cleans names", () => {
    assert.equal(mediaAssetKey({ assetId: "abc", publicId: "x/y" }), "abc");
    assert.equal(mediaAssetKey({ publicId: "x/y" }), "pid:x/y");
    assert.equal(cleanLabelName("  Hero   images "), "Hero images");
    assert.equal(cleanLabelName(""), null);
    assert.equal(cleanLabelName("x".repeat(61)), null);
  });

  it("has the sidebar, filter, upload, labels and paged data layer", () => {
    const picker = src("app/components/admin/CloudinaryPicker.tsx");
    for (const needle of ["Folders", "Labels", "Filter by folder or name", "Upload from this computer", "/api/admin/cloudinary/folders", "/api/admin/cloudinary/upload", "/api/admin/cloudinary/move", "/api/admin/media-labels", 'paged: "1"']) {
      assert.ok(picker.includes(needle), needle);
    }
  });

  it("guards every picker route for platform admins", () => {
    const roots = ["app/api/admin/cloudinary", "app/api/admin/media-labels"];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(path.join(__dirname, "..", dir))) {
        const rel = `${dir}/${f}`;
        if (statSync(path.join(__dirname, "..", rel)).isDirectory()) walk(rel);
        else if (f === "route.ts") files.push(rel);
      }
    };
    roots.forEach(walk);
    assert.ok(files.length >= 7);
    for (const f of files) {
      const body = src(f);
      const handlers = body.match(/export async function (GET|POST|PATCH|DELETE|PUT)/g) ?? [];
      const guards = body.match(/requirePlatformAdmin\(\)/g) ?? [];
      assert.ok(guards.length >= handlers.length, f);
      // The settings route (cloudinary/route.ts) accepts the secret as input; the picker routes never touch it.
      if (f !== "app/api/admin/cloudinary/route.ts") assert.ok(!/apiSecret/.test(body), `${f} never handles the secret`);
    }
  });
});