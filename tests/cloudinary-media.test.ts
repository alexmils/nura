import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSiteMedia, signCloudinaryParams } from "../lib/cloudinary.ts";

describe("cloudinary media", () => {
  it("signs params the way Cloudinary expects", () => {
    const signature = signCloudinaryParams(
      { folder: "nura", timestamp: "1000" },
      "secret"
    );
    assert.equal(signature.length, 40);
    assert.equal(signature, signCloudinaryParams({ timestamp: "1000", folder: "nura" }, "secret"));
  });

  it("refuses a path outside the marketing folder", async () => {
    await assert.rejects(() => readSiteMedia("/marketing/../package.json"));
    await assert.rejects(() => readSiteMedia("https://evil.test/a.jpg"));
  });
});
